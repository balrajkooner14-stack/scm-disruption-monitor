import type { DisruptionEvent } from "./types"
import type { CompanyProfile, ProductLine, Supplier } from "./profile"
import type { OnboardingDraft, OnboardingExtras } from "./onboarding"
import { draftToExtras, onboardingToProfile } from "./onboarding"
import { textMentionsCountry } from "./countries"
import { matchEventsToPorts, portName } from "./ports"
import { bySeverityThenDate, compareDateDesc } from "./eventOrder"
import { scoreEventsForProfile, type ScoredEvent } from "./scoreEvents"
import { findSinglePointsOfFailure } from "./supplyChainGraph"

// Pure functions behind every live right-hand panel in sign-up and onboarding
// (spec section 7). They only select and arrange real events and the user's
// own answers. Event text is used verbatim; nothing here invents a claim.

export { bySeverityThenDate }

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

// Categories that hit everything in a region, not just the named place.
const REGION_WIDE_CATEGORIES = new Set(["Weather", "Port", "Labor"])

/**
 * How an event touches a supplier: "country" when the headline names its
 * country, "region" when it's a weather/port/labor event in its region, else
 * null. Severity 1 (monitor) events never count as active.
 */
export function supplierEventMatch(supplier: SupplierLike, event: DisruptionEvent): "country" | "region" | null {
  if (event.severity < 2) return null
  if (countrySeen(event, supplier.country)) return "country"
  if (event.region === supplier.region && REGION_WIDE_CATEGORIES.has(event.category)) return "region"
  return null
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
  matchedBy: "country" | "region"
}

/** Best event for the "Now watching" card: country match > region match, then severity, then newest. */
export function supplierTeaser(suppliers: SupplierLike[], events: DisruptionEvent[]): SupplierTeaser | null {
  let best: SupplierTeaser | null = null
  const rank = (t: SupplierTeaser) => (t.matchedBy === "country" ? 1 : 0)
  for (const event of events) {
    for (const supplier of suppliers) {
      const matchedBy = supplierEventMatch(supplier, event)
      if (!matchedBy) continue
      const candidate = { event, supplier, matchedBy }
      if (
        !best ||
        rank(candidate) > rank(best) ||
        (rank(candidate) === rank(best) &&
          (event.severity > best.event.severity ||
            (event.severity === best.event.severity && compareDateDesc(event, best.event) < 0)))
      ) {
        best = candidate
      }
    }
  }
  return best
}

// ── Stock with as-of dates ──────────────────────────────────────────────────

function parseLocalDate(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole calendar days from a YYYY-MM-DD date to `now` (local), never negative. */
export function daysSinceLocalDate(ymd: string, now: Date = new Date()): number | null {
  const d = parseLocalDate(ymd)
  if (!d) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000))
}

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
      body: `${stock} days of stock against a ${lead}-day lead time from ${supplier.name}, while ${supplier.region} has active disruptions.`,
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
  const scored: ScoredEvent[] = scoreEventsForProfile(events, profile)
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
