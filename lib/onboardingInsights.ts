import type { DisruptionEvent } from "./types"
import type { CompanyProfile, ProductLine, Supplier } from "./profile"
import type { OnboardingDraft, OnboardingExtras } from "./onboarding"
import { draftToExtras, onboardingToProfile } from "./onboarding"
import { textMentionsCountry } from "./countries"
import { matchEventsToPorts, portName } from "./ports"
import { bySeverityThenDate, compareDateDesc } from "./eventOrder"
import { daysSinceLocalDate } from "./asOfDates"
import { scoreEventsForProfile, type ScoredEvent } from "./scoreEvents"
import { findSinglePointsOfFailure } from "./supplyChainGraph"

// Pure functions behind every live right-hand panel in sign-up and onboarding
// (spec section 7). They only select and arrange real events and the user's
// own answers. Event text is used verbatim; nothing here invents a claim.

export { bySeverityThenDate, daysSinceLocalDate }

type SupplierLike = Pick<Supplier, "id" | "name" | "country" | "region">

// ── Sign-in panel ───────────────────────────────────────────────────────────

/**
 * The sign-in panel's headline tiles: the highest-severity events with
 * distinct categories, topped up with the next most severe events when
 * fewer than `count` categories are present.
 */
export function pickHeadlineEvents(events: DisruptionEvent[], count = 3): DisruptionEvent[] {
  const sorted = bySeverityThenDate(events)
  const picked: DisruptionEvent[] = []
  const seenCategories = new Set<string>()
  for (const e of sorted) {
    if (picked.length >= count) break
    if (seenCategories.has(e.category)) continue
    seenCategories.add(e.category)
    picked.push(e)
  }
  for (const e of sorted) {
    if (picked.length >= count) break
    if (!picked.includes(e)) picked.push(e)
  }
  return picked
}

// ── Supplier exposure ───────────────────────────────────────────────────────

/** The headline names this country (or an alias) as a whole term. */
export function countrySeen(event: DisruptionEvent, country: string): boolean {
  return textMentionsCountry(event.title, country)
}

/**
 * Whether an event touches a supplier: "country" when the event is severity 2+
 * and its headline names the supplier's country (or an alias), else null.
 * There is deliberately no same-region fallback (owner decision, Oct 2026): a
 * region like "Asia Pacific" is too wide — a Japanese vessel-sanctions story
 * used to read as "TSMC is in the affected region".
 */
export function supplierEventMatch(supplier: SupplierLike, event: DisruptionEvent): "country" | null {
  if (event.severity < 2) return null
  return countrySeen(event, supplier.country) ? "country" : null
}

export function supplierHasActiveEvent(supplier: SupplierLike, events: DisruptionEvent[]): boolean {
  return events.some(e => supplierEventMatch(supplier, e) !== null)
}

/** Events that are active for at least one of these suppliers. */
export function activeEventsForSuppliers(suppliers: SupplierLike[], events: DisruptionEvent[]): DisruptionEvent[] {
  return events.filter(e => suppliers.some(s => supplierEventMatch(s, e) !== null))
}

export interface SupplierTeaser {
  event: DisruptionEvent
  supplier: SupplierLike
  matchedBy: "country"
}

/** Best event for the "Now watching" card: higher severity, then newest. */
export function supplierTeaser(suppliers: SupplierLike[], events: DisruptionEvent[]): SupplierTeaser | null {
  let best: SupplierTeaser | null = null
  for (const event of events) {
    for (const supplier of suppliers) {
      if (!supplierEventMatch(supplier, event)) continue
      if (
        !best ||
        event.severity > best.event.severity ||
        (event.severity === best.event.severity && compareDateDesc(event, best.event) < 0)
      ) {
        best = { event, supplier, matchedBy: "country" }
      }
    }
  }
  return best
}

// ── Port watch ──────────────────────────────────────────────────────────────

/** Port watch headline (spec 6.5) from selected ports and how many have news. */
export function portWatchHeadline(selected: number, withNews: number): string {
  if (selected === 0) return "Pick your ports to see what's happening there."
  if (withNews === 0) return "Nothing reported at your ports today."
  if (withNews === selected) {
    if (selected === 1) return "Your entry point has something going on this week."
    return `${selected === 2 ? "Both" : "All"} of your entry points have something going on this week.`
  }
  return `${withNews} of your ${selected} entry points have something going on this week.`
}

// ── Stock with as-of dates ──────────────────────────────────────────────────

/**
 * Days of stock left for a product, counted down from its as-of date when
 * one is recorded. null when the stock level was never entered.
 */
export function stockDaysRemaining(
  product: ProductLine,
  extras: OnboardingExtras | null | undefined,
  now: Date = new Date(),
): number | null {
  if (extras?.inventoryUnknown?.includes(product.id)) return null
  const asOf = extras?.inventoryAsOf?.[product.id]
  const elapsed = asOf ? daysSinceLocalDate(asOf, now) ?? 0 : 0
  return Math.max(0, product.inventoryDaysOnHand - elapsed)
}

// ── Product insight ("found while you typed") ───────────────────────────────

export interface ProductInsight {
  rule: 1 | 2 | 3
  productId: string
  supplierId: string
  headline: string
  body: string
}

/** Spec 7 productInsight, on a saved profile + extras. */
export function productInsightForProfile(
  profile: CompanyProfile,
  extras: OnboardingExtras | null | undefined,
  events: DisruptionEvent[],
  now: Date = new Date(),
): ProductInsight | null {
  const supplierById = new Map(profile.suppliers.map(s => [s.id, s]))
  const spofIds = new Set(
    findSinglePointsOfFailure(profile).filter(r => r.isSinglePointOfFailure).map(r => r.productLineId),
  )

  const rows = profile.productLines
    .map(p => {
      const supplier = p.primarySupplierId ? supplierById.get(p.primarySupplierId) : undefined
      if (!supplier) return null
      const stock = stockDaysRemaining(p, extras, now)
      const lead = supplier.leadTimeDays > 0 ? supplier.leadTimeDays : null
      return { p, supplier, stock, lead, active: supplierHasActiveEvent(supplier, events), spof: spofIds.has(p.id) }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  // Rule 1: stock at or under the lead time while the supplier has an active event.
  const tight = rows
    .filter(r => r.active && r.stock !== null && r.lead !== null && r.stock <= r.lead)
    .sort((a, b) => (a.stock as number) - (a.lead as number) - ((b.stock as number) - (b.lead as number)))
  if (tight.length > 0) {
    const { p, supplier, stock, lead } = tight[0]
    return {
      rule: 1,
      productId: p.id,
      supplierId: supplier.id,
      headline: `${p.name} is your tightest spot.`,
      body: `${stock} days of stock against a ${lead}-day lead time from ${supplier.name}, while ${supplier.country} has active disruptions.`,
    }
  }

  const oneSource = (r: (typeof rows)[number]) => `${r.p.name} has one source: ${r.supplier.name}, in ${r.supplier.country}.`

  // Rule 2: single source whose supplier has an active event (lowest stock first).
  const exposed = rows
    .filter(r => r.spof && r.active)
    .sort((a, b) => (a.stock ?? Infinity) - (b.stock ?? Infinity))
  if (exposed.length > 0) {
    const r = exposed[0]
    const body =
      r.stock !== null && r.lead !== null
        ? `With ${r.stock} days of stock against a ${r.lead}-day lead time, a disruption there would leave a gap. You can name a backup later.`
        : "A disruption there would leave a gap. You can name a backup later."
    return { rule: 2, productId: r.p.id, supplierId: r.supplier.id, headline: oneSource(r), body }
  }

  // Rule 3: any single-source product.
  const single = rows.find(r => r.spof)
  if (single) {
    return {
      rule: 3,
      productId: single.p.id,
      supplierId: single.supplier.id,
      headline: oneSource(single),
      body: "A backup supplier lets Foreglow tell you when you can switch. You can add one later.",
    }
  }
  return null
}

/** Spec 7 productInsight, on the in-progress draft. */
export function productInsight(
  draft: OnboardingDraft,
  events: DisruptionEvent[],
  now: Date = new Date(),
): ProductInsight | null {
  return productInsightForProfile(onboardingToProfile(draft, now), draftToExtras(draft, now), events, now)
}

// ── First light cards (finish screen) ───────────────────────────────────────

export interface FirstLightCard {
  key: string
  tone: "critical" | "warning" | "positive"
  label: string
  title: string
  body: string
}

export const QUIET_CARD: FirstLightCard = {
  key: "quiet",
  tone: "positive",
  label: "ALL QUIET",
  title: "Nothing urgent for your network today",
  body: "Foreglow will flag the moment something changes.",
}

/**
 * Up to three cards for the finish screen (spec 7): one "decide this week"
 * card, then "watch" cards preferring events at the user's entry ports, then
 * at most one quiet card to fill. Zero real cards → only the quiet card.
 */
export function firstLightCards(
  profile: CompanyProfile,
  extras: OnboardingExtras | null | undefined,
  events: DisruptionEvent[],
  now: Date = new Date(),
): FirstLightCard[] {
  const scored: ScoredEvent[] = scoreEventsForProfile(events, profile, extras?.entryPorts)
  const used = new Set<string>()
  const cards: FirstLightCard[] = []

  // Card 1
  const insight = productInsightForProfile(profile, extras, events, now)
  if (insight && (insight.rule === 1 || insight.rule === 2)) {
    cards.push({ key: `insight:${insight.productId}`, tone: "critical", label: "DECIDE THIS WEEK", title: insight.headline, body: insight.body })
  } else {
    const critical = scored.find(e => e.severity === 3 && e.isProfileMatch)
    if (critical) {
      used.add(critical.id)
      cards.push({ key: `event:${critical.id}`, tone: "critical", label: "DECIDE THIS WEEK", title: critical.title, body: critical.relevanceReason })
    }
  }

  // Cards 2–3: entry-port events first (warning severity and up), then profile matches.
  const watch: FirstLightCard[] = []
  const tone = (e: DisruptionEvent) => (e.severity === 3 ? "critical" : "warning") as FirstLightCard["tone"]
  const portMatches = matchEventsToPorts(events, extras?.entryPorts ?? [])
  // Most severe matching event per port, then ports ordered by that event.
  const portCandidates = Object.entries(portMatches)
    .flatMap(([portId, list]) => list.filter(e => e.severity >= 2).slice(0, 1).map(e => ({ portId, e })))
    .sort((a, b) => b.e.severity - a.e.severity || compareDateDesc(a.e, b.e))
  for (const { portId, e } of portCandidates) {
    if (watch.length >= 2) break
    if (used.has(e.id)) continue
    used.add(e.id)
    watch.push({ key: `port:${portId}:${e.id}`, tone: tone(e), label: "WATCH", title: portName(portId), body: e.title })
  }
  for (const e of scored) {
    if (watch.length >= 2) break
    if (!e.isProfileMatch || used.has(e.id)) continue
    used.add(e.id)
    watch.push({ key: `event:${e.id}`, tone: tone(e), label: "WATCH", title: e.title, body: e.relevanceReason })
  }
  cards.push(...watch)

  if (cards.length < 3) cards.push(QUIET_CARD)
  return cards
}
