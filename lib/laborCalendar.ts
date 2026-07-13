import type { TradeLane } from "@/lib/profile"

export interface LaborContract {
  union: string
  counterparty: string
  ports: string
  tradeLanesAffected: TradeLane[]
  contractExpirationDate: string // ISO date
  sourceUrl: string
  sourceLabel: string
  lastVerified: string // ISO date — when a human last checked this against the source
  notes: string
}

// Verified against multiple trade-press sources — not estimated. Both
// major US port labor contracts were freshly renewed as long-term deals,
// so neither shows as imminent right now; this is stated plainly rather
// than oversold. Revisit and re-verify as these dates approach.
export const LABOR_CONTRACTS: LaborContract[] = [
  {
    union: "ILWU",
    counterparty: "PMA",
    ports: "29 West Coast ports",
    tradeLanesAffected: ["Asia-Pacific to US West Coast", "Intra-Asia"],
    contractExpirationDate: "2028-07-01",
    sourceUrl: "https://www.supplychaindive.com/news/ilwu-vote-ratify-6-year-contract-pma-west-coast-ports-strike-fears/692544/",
    sourceLabel: "Supply Chain Dive",
    lastVerified: "2026-07-13",
    notes: "6-year contract ratified August 2023, retroactive to July 1, 2022.",
  },
  {
    union: "ILA",
    counterparty: "USMX",
    ports: "East Coast and Gulf Coast ports",
    tradeLanesAffected: ["Europe to US", "Asia-Pacific to US East Coast"],
    contractExpirationDate: "2030-09-30",
    sourceUrl: "https://gcaptain.com/done-deal-historic-ila-usmx-contract-brings-six-years-of-labor-peace-to-east-and-gulf-coast-ports/",
    sourceLabel: "gCaptain",
    lastVerified: "2026-07-13",
    notes: "6-year Master Contract signed March 11, 2025, effective October 1, 2024.",
  },
]

export function daysUntil(isoDate: string): number {
  const target = new Date(isoDate).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
}

export function contractsWithinWindow(
  tradeLanes: TradeLane[],
  windowDays: number = 180
): LaborContract[] {
  return LABOR_CONTRACTS.filter(
    c =>
      c.tradeLanesAffected.some(l => tradeLanes.includes(l)) &&
      daysUntil(c.contractExpirationDate) <= windowDays
  )
}
