import type {
  CompanyProfile,
  IndustrySector,
  ProductLine,
  Supplier,
  SupplyRegion,
  TradeLane,
  TransportMode,
} from "./profile"
import { countryToSupplyRegion, findCountry } from "./countries"
import { matchSupplierByName, wholeNumberShares } from "./importCalculations"

// v5.1 onboarding data model (spec 4.3–4.5). CompanyProfile (lib/profile.ts)
// is unchanged; everything new lives in OnboardingExtras, stored in the
// profiles.onboarding column (signed in) or localStorage (guests).
// onboardingToProfile() is the only place onboarding answers become a profile.

// ── Extras ──────────────────────────────────────────────────────────────────

export type OnboardingRole = "procurement" | "operations" | "planning" | "executive"
export type OnboardingPath = "import" | "manual" | "sample"

export interface OnboardingExtras {
  version: 1
  role?: OnboardingRole
  entryPorts?: string[]                    // PORTS ids, or "custom:<name>"
  inventoryAsOf?: Record<string, string>   // productLine.id → YYYY-MM-DD of the stock count
  inventoryUnknown?: string[]              // productLine ids where stock was skipped
  reorderPointDefaulted?: string[]         // productLine ids whose reorder point was set = lead time
  leadTimeUnknown?: string[]               // supplier ids with no lead time entered
  primaryMarketsDerived?: boolean          // true when primaryMarkets came from HQ, not the user
  path?: OnboardingPath
  startedAt?: string
  completedAt?: string
  checklistInitial?: string[]              // checklist item ids open at completion (for "N of M done")
  checklistDismissedAt?: string
  morningEmail?: boolean                   // stored only; no sending yet
}

export const EMPTY_EXTRAS: OnboardingExtras = { version: 1 }

export const EXTRAS_STORAGE_KEY = "scm_onboarding"
export const DRAFT_STORAGE_KEY = "scm_onboarding_draft"

export const MAX_SUPPLIERS = 10
export const MAX_PRODUCTS = 5

// ── Chip options ────────────────────────────────────────────────────────────

export type RevenueRange = CompanyProfile["revenueRange"]

export const SECTOR_CHIPS: { label: string; value: IndustrySector }[] = [
  { label: "Electronics & components", value: "Electronics" },
  { label: "Automotive", value: "Automotive" },
  { label: "Industrial parts", value: "Industrial" },
  { label: "Apparel & footwear", value: "Apparel" },
  { label: "Consumer & retail goods", value: "Retail" },
  { label: "Food & beverage", value: "Food & Beverage" },
  { label: "Pharma & medical", value: "Pharmaceuticals" },
  { label: "Aerospace", value: "Aerospace" },
  { label: "Something else", value: "Other" },
]

export const REVENUE_CHIPS: { label: string; value: RevenueRange }[] = [
  { label: "Under $10M", value: "$0–$10M" },
  { label: "$10M–$100M", value: "$10M–$100M" },
  { label: "$100M–$1B", value: "$100M–$1B" },
  { label: "$1B+", value: "$1B+" },
]

export const ROLE_CHIPS: { label: string; value: OnboardingRole }[] = [
  { label: "Procurement / sourcing", value: "procurement" },
  { label: "Supply chain / operations", value: "operations" },
  { label: "Planning / inventory", value: "planning" },
  { label: "Owner / executive", value: "executive" },
]

export const TRANSPORT_CHIPS: { label: string; value: TransportMode }[] = [
  { label: "Ocean", value: "Ocean Freight" },
  { label: "Truck", value: "Truck" },
  { label: "Air", value: "Air Freight" },
  { label: "Rail", value: "Rail" },
]

export const SUPPLY_SUGGESTIONS = [
  "Semiconductors", "Batteries", "Contract assembly", "Sensors", "PCB assembly",
  "Plastics & resins", "Steel & metals", "Textiles", "Packaging", "Chemicals",
]

// ── Draft (in-progress flow state, autosaved to scm_onboarding_draft) ───────

export type OnboardingStep =
  | "path" | "company" | "suppliers" | "ports" | "products" | "import" | "finish"

export interface DraftSupplier {
  id: string
  name: string
  country: string
  category: string
  leadTimeDays?: number
  /** Real share from an imported file; typed-in rows leave it unset (even split). */
  sharePercent?: number
}

export interface DraftProduct {
  id: string
  name: string
  supplierId?: string
  stockDays?: number
  asOf?: string        // YYYY-MM-DD; defaults to today
  stockLater?: boolean // "Add later" toggled on
  /** Real reorder point from an imported file; otherwise defaulted to the lead time. */
  reorderPointDays?: number
}

export interface OnboardingDraft {
  version: 1
  path?: OnboardingPath
  step: OnboardingStep
  startedAt: string
  company: {
    name: string
    hqCountry: string
    sector?: IndustrySector
    revenueRange?: RevenueRange
    role?: OnboardingRole
  }
  suppliers: DraftSupplier[]
  entryPorts: string[]
  transport: TransportMode[]
  products: DraftProduct[]
}

export function emptyDraft(now: Date = new Date()): OnboardingDraft {
  return {
    version: 1,
    step: "path",
    startedAt: now.toISOString(),
    company: { name: "", hqCountry: "" },
    suppliers: [],
    entryPorts: [],
    transport: [],
    products: [],
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Local calendar date as YYYY-MM-DD (what a date input holds). */
export function localISODate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** A supplier row counts once it has a name and a country we recognise. */
export function isValidDraftSupplier(s: DraftSupplier): boolean {
  return s.name.trim().length > 0 && countryToSupplyRegion(s.country) !== null
}

export function validDraftSuppliers(draft: OnboardingDraft): DraftSupplier[] {
  return draft.suppliers.filter(isValidDraftSupplier).slice(0, MAX_SUPPLIERS)
}

export function validDraftProducts(draft: OnboardingDraft): DraftProduct[] {
  return draft.products.filter(p => p.name.trim().length > 0).slice(0, MAX_PRODUCTS)
}

function hasStock(p: DraftProduct): boolean {
  return !p.stockLater && typeof p.stockDays === "number" && Number.isFinite(p.stockDays) && p.stockDays >= 0
}

function hasReorderPoint(p: DraftProduct): boolean {
  return typeof p.reorderPointDays === "number" && Number.isFinite(p.reorderPointDays) && p.reorderPointDays > 0
}

function hasLeadTime(s: DraftSupplier): boolean {
  return typeof s.leadTimeDays === "number" && Number.isFinite(s.leadTimeDays) && s.leadTimeDays > 0
}

// ── Trade lanes from entry ports (spec 4.4.1) ───────────────────────────────

const WEST_COAST = ["la-lb", "oakland", "seattle-tacoma"]
const EAST_COAST = ["ny-nj", "savannah", "charleston"]
const EUROPE_TO_US = ["ny-nj", "savannah", "charleston", "houston"]
const LATAM_TO_US = ["houston", "laredo"]

/**
 * Trade lanes implied by the entry ports and supplier regions. The scorer
 * already matches lane keywords ("long beach", "savannah"...), so this gives
 * port answers relevance today without touching lib/scoreEvents.ts.
 *
 * Deviation from the spec table: a supplier in Mexico counts toward the Latin
 * America lane. lib/countries.ts files Mexico under North America (matching
 * the event feeds), but goods from Mexico cross at Laredo/Houston all the same.
 */
export function deriveTradeLanes(
  entryPorts: string[],
  suppliers: Pick<Supplier, "region" | "country">[],
): TradeLane[] {
  const regions = new Set<string>(suppliers.map(s => s.region))
  const fromMexico = suppliers.some(s => findCountry(s.country)?.name === "Mexico")
  const asia = regions.has("Asia Pacific")
  const europe = regions.has("Europe")
  const latam = regions.has("Latin America") || fromMexico
  const has = (ids: string[]) => entryPorts.some(p => ids.includes(p))

  const lanes = new Set<TradeLane>()
  if (entryPorts.length > 0) {
    if (asia && has(WEST_COAST)) lanes.add("Asia-Pacific to US West Coast")
    if (asia && has(EAST_COAST)) lanes.add("Asia-Pacific to US East Coast")
    if (europe && has(EUROPE_TO_US)) lanes.add("Europe to US")
    if (latam && has(LATAM_TO_US)) lanes.add("Latin America to US")
  } else {
    if (asia) lanes.add("Asia-Pacific to US West Coast")
    if (europe) lanes.add("Europe to US")
    if (latam) lanes.add("Latin America to US")
  }
  if (regions.has("Middle East") && europe) lanes.add("Middle East to Europe")
  return Array.from(lanes)
}

// ── Draft → CompanyProfile + extras (spec 4.4) ──────────────────────────────

/**
 * The CompanyProfile for a draft. Unknown values become 0 (the profile type
 * requires numbers) and are recorded in the extras from draftToExtras(), so
 * nothing downstream mistakes a skipped answer for a real zero.
 */
export function onboardingToProfile(draft: OnboardingDraft, now: Date = new Date()): CompanyProfile {
  const draftSuppliers = validDraftSuppliers(draft)
  // Keep real shares only when every supplier has one (an imported file);
  // a partial set would no longer add up, so fall back to an even split.
  const realShares = draftSuppliers.length > 0 && draftSuppliers.every(s => (s.sharePercent ?? 0) > 0)
  const evenShares = wholeNumberShares(draftSuppliers.length)

  const suppliers: Supplier[] = draftSuppliers.map((s, i) => {
    const country = findCountry(s.country)
    return {
      id: s.id,
      name: s.name.trim(),
      country: country?.name ?? s.country.trim(),
      region: (country?.region ?? "Asia Pacific") as SupplyRegion, // valid rows always have a country
      category: s.category.trim(),
      sharePercent: realShares ? (s.sharePercent as number) : evenShares[i],
      leadTimeDays: hasLeadTime(s) ? Math.round(s.leadTimeDays as number) : 0,
    }
  })
  const supplierIds = new Set(suppliers.map(s => s.id))
  const leadById = new Map(suppliers.map(s => [s.id, s.leadTimeDays]))

  const productLines: ProductLine[] = validDraftProducts(draft).map(p => {
    const primarySupplierId = p.supplierId && supplierIds.has(p.supplierId) ? p.supplierId : undefined
    const lead = primarySupplierId ? leadById.get(primarySupplierId) ?? 0 : 0
    return {
      id: p.id,
      name: p.name.trim(),
      inventoryDaysOnHand: hasStock(p) ? Math.round(p.stockDays as number) : 0,
      reorderPointDays: hasReorderPoint(p) ? Math.round(p.reorderPointDays as number) : lead > 0 ? lead : 0,
      ...(primarySupplierId ? { primarySupplierId } : {}),
    }
  })

  const hqRegion = countryToSupplyRegion(draft.company.hqCountry)
  const nowIso = now.toISOString()

  return {
    companyName: draft.company.name.trim(),
    headquartersCountry: findCountry(draft.company.hqCountry)?.name ?? draft.company.hqCountry.trim(),
    sector: draft.company.sector ?? "Other",
    revenueRange: draft.company.revenueRange ?? "$0–$10M",
    primaryMarkets: hqRegion ? [hqRegion] : [],
    suppliers,
    productLines,
    painPoints: [],
    transportModes: Array.from(new Set(draft.transport)),
    tradeLanes: deriveTradeLanes(draft.entryPorts, suppliers),
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

/** The extras that go with onboardingToProfile(draft). Caller adds completedAt/checklist fields. */
export function draftToExtras(draft: OnboardingDraft, now: Date = new Date()): OnboardingExtras {
  const suppliers = validDraftSuppliers(draft)
  const supplierById = new Map(suppliers.map(s => [s.id, s]))
  const products = validDraftProducts(draft)
  const today = localISODate(now)

  const inventoryAsOf: Record<string, string> = {}
  const inventoryUnknown: string[] = []
  const reorderPointDefaulted: string[] = []
  for (const p of products) {
    if (hasStock(p)) inventoryAsOf[p.id] = p.asOf || today
    else inventoryUnknown.push(p.id)
    const supplier = p.supplierId ? supplierById.get(p.supplierId) : undefined
    if (!hasReorderPoint(p) && supplier && hasLeadTime(supplier)) reorderPointDefaulted.push(p.id)
  }

  return {
    version: 1,
    ...(draft.company.role ? { role: draft.company.role } : {}),
    entryPorts: [...draft.entryPorts],
    inventoryAsOf,
    inventoryUnknown,
    reorderPointDefaulted,
    leadTimeUnknown: suppliers.filter(s => !hasLeadTime(s)).map(s => s.id),
    primaryMarketsDerived: true,
    ...(draft.path ? { path: draft.path } : {}),
    startedAt: draft.startedAt,
  }
}

// ── Prefill and display helpers ─────────────────────────────────────────────

const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "gmx.com", "gmx.net", "yandex.com", "zoho.com",
  "mail.com", "fastmail.com", "hey.com", "comcast.net", "att.net", "verizon.net",
])

/**
 * A company-name guess from a work email's domain ("dana@meridian-electronics.com"
 * → "Meridian Electronics"). Null for public mail providers.
 */
export function companyFromEmail(email: string | null | undefined): string | null {
  const domain = email?.split("@")[1]?.trim().toLowerCase()
  if (!domain || PUBLIC_EMAIL_DOMAINS.has(domain)) return null
  const label = domain.split(".")[0]
  if (!label) return null
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/** First name from OAuth metadata (full_name or name), else null. */
export function firstNameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  const raw = (typeof meta?.full_name === "string" && meta.full_name) || (typeof meta?.name === "string" && meta.name) || ""
  const first = raw.trim().split(/\s+/)[0]
  return first || null
}

export function roleLabel(role: OnboardingRole | undefined): string | null {
  return ROLE_CHIPS.find(r => r.value === role)?.label ?? null
}

/**
 * Tab-separated rows pasted from a spreadsheet → supplier cells in table
 * order (name, country, what they supply, lead time). Rows without a name
 * are dropped, and a header row ("Supplier", "Name", "Vendor") is skipped.
 */
export function parsePastedSupplierRows(text: string): { name: string; country: string; category: string; lead: string }[] {
  const rows = text
    .split(/\r?\n/)
    .map(line => line.split("\t"))
    .map(([name = "", country = "", category = "", lead = ""]) => ({
      name: name.trim(),
      country: country.trim(),
      category: category.trim(),
      lead: lead.replace(/[^\d]/g, ""),
    }))
    .filter(r => r.name)
  if (rows.length && /^(supplier|name|vendor)s?$/i.test(rows[0].name)) rows.shift()
  return rows
}

const LEGAL_SUFFIX = /^(co|company|inc|incorporated|llc|l\.l\.c|ltd|limited|corp|corporation|gmbh|plc|s\.a|sa|ag|bv|b\.v|pty|pte)\.?$/i

/**
 * Company name without legal suffixes, for "First light, {name}." —
 * "Meridian Electronics Co." → "Meridian Electronics" (descriptive words like
 * "Electronics" stay). Falls back to the full name if nothing would be left.
 */
export function shortCompanyName(name: string): string {
  const words = name.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean)
  while (words.length > 1 && LEGAL_SUFFIX.test(words[words.length - 1])) words.pop()
  return words.join(" ") || name.trim()
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Finish-screen sub-line (spec 6.8), omitting clauses that are zero. */
export function watchingSentence(counts: { suppliers: number; countries: number; ports: number; products: number }): string {
  const clauses: string[] = []
  if (counts.suppliers > 0) {
    clauses.push(
      `${plural(counts.suppliers, "supplier", "suppliers")}` +
        (counts.countries > 0 ? ` in ${plural(counts.countries, "country", "countries")}` : ""),
    )
  }
  if (counts.ports > 0) clauses.push(plural(counts.ports, "entry point", "entry points"))
  if (counts.products > 0) clauses.push(plural(counts.products, "product line", "product lines"))
  if (clauses.length === 0) return "Foreglow is now watching today's news for you."
  const list = clauses.length === 1 ? clauses[0] : `${clauses.slice(0, -1).join(", ")} and ${clauses[clauses.length - 1]}`
  return `Foreglow is now watching ${list}. Here's what it sees today.`
}

// ── Spreadsheet import → draft rows (spec 6.7) ──────────────────────────────

/** Structural subset of the import API's ImportedSupplier / ImportedProductLine. */
export interface ImportedSupplierLike {
  name: string
  country: string
  category: string
  sharePercent: number
  leadTimeDays: number
}
export interface ImportedProductLike {
  name: string
  inventoryDaysOnHand: number
  reorderPointDays: number
  primarySupplierName?: string
}

/**
 * Imported rows as onboarding draft rows. Countries are canonicalised when
 * recognised and left as typed otherwise (the review flags them). Imported
 * stock has no count date, so it's taken as of `today`; products without a
 * stock value are marked "add later". Capped at the profile limits.
 */
export function importResultToDraft(
  suppliers: ImportedSupplierLike[],
  products: ImportedProductLike[],
  today: string,
  newId: () => string,
): { suppliers: DraftSupplier[]; products: DraftProduct[] } {
  const draftSuppliers: DraftSupplier[] = suppliers.slice(0, MAX_SUPPLIERS).map(s => {
    const lead = Math.round(Number(s.leadTimeDays))
    const share = Number(s.sharePercent)
    return {
      id: newId(),
      name: (s.name ?? "").trim(),
      country: findCountry(s.country ?? "")?.name ?? (s.country ?? "").trim(),
      category: (s.category ?? "").trim(),
      ...(lead > 0 ? { leadTimeDays: lead } : {}),
      ...(share > 0 ? { sharePercent: share } : {}),
    }
  })
  const names = draftSuppliers.map(s => s.name)
  const draftProducts: DraftProduct[] = products.slice(0, MAX_PRODUCTS).map(p => {
    const stock = Math.round(Number(p.inventoryDaysOnHand))
    const reorder = Math.round(Number(p.reorderPointDays))
    const idx = p.primarySupplierName ? matchSupplierByName(p.primarySupplierName, names) : -1
    return {
      id: newId(),
      name: (p.name ?? "").trim(),
      ...(idx >= 0 ? { supplierId: draftSuppliers[idx].id } : {}),
      ...(stock > 0 ? { stockDays: stock, asOf: today } : { stockLater: true }),
      ...(reorder > 0 ? { reorderPointDays: reorder } : {}),
    }
  })
  return { suppliers: draftSuppliers, products: draftProducts }
}

// ── /profile save → extras (spec 8.2, 8.3) ──────────────────────────────────

/**
 * The extras to store after /profile saves a profile.
 * - Stock dates: a product whose stock changed is dated today unless the user
 *   picked a "counted on" date; an unchanged product keeps its date, and if it
 *   never had one it keeps the date of the previous save — otherwise saving
 *   any field would silently reset every product's countdown.
 * - "Unknown"/"defaulted" lists drop entries the user has now filled in.
 * - Entry ports and role are replaced when the form passes them.
 */
export function extrasAfterProfileSave(args: {
  extras: OnboardingExtras | null
  before: CompanyProfile | null
  after: CompanyProfile
  asOfEdits: Record<string, string>
  entryPorts?: string[]
  role?: OnboardingRole | null
  now?: Date
}): OnboardingExtras {
  const { extras, before, after, asOfEdits } = args
  const now = args.now ?? new Date()
  const today = localISODate(now)
  const prevSaveDate = before?.updatedAt ? localISODate(new Date(before.updatedAt)) : today
  const beforeById = new Map((before?.productLines ?? []).map(p => [p.id, p]))
  const productIds = new Set(after.productLines.map(p => p.id))
  const supplierIds = new Set(after.suppliers.map(s => s.id))

  const inventoryAsOf: Record<string, string> = {}
  const stockTouched = new Set<string>()
  const reorderTouched = new Set<string>()
  for (const p of after.productLines) {
    const old = beforeById.get(p.id)
    const stockChanged = !old || old.inventoryDaysOnHand !== p.inventoryDaysOnHand
    if (stockChanged || asOfEdits[p.id]) stockTouched.add(p.id)
    if (!old || old.reorderPointDays !== p.reorderPointDays) reorderTouched.add(p.id)
    inventoryAsOf[p.id] =
      asOfEdits[p.id] ?? (stockChanged ? today : extras?.inventoryAsOf?.[p.id] ?? prevSaveDate)
  }

  const marketsChanged =
    !!before && JSON.stringify([...before.primaryMarkets].sort()) !== JSON.stringify([...after.primaryMarkets].sort())

  const next: OnboardingExtras = {
    ...(extras ?? EMPTY_EXTRAS),
    version: 1,
    inventoryAsOf,
    inventoryUnknown: (extras?.inventoryUnknown ?? []).filter(id => productIds.has(id) && !stockTouched.has(id)),
    reorderPointDefaulted: (extras?.reorderPointDefaulted ?? []).filter(id => productIds.has(id) && !reorderTouched.has(id)),
    leadTimeUnknown: (extras?.leadTimeUnknown ?? []).filter(
      id => supplierIds.has(id) && !(after.suppliers.find(s => s.id === id)!.leadTimeDays > 0),
    ),
  }
  if (extras?.primaryMarketsDerived !== undefined) next.primaryMarketsDerived = extras.primaryMarketsDerived && !marketsChanged
  if (args.entryPorts) next.entryPorts = [...args.entryPorts]
  if (args.role !== undefined) {
    if (args.role) next.role = args.role
    else delete next.role
  }
  return next
}
