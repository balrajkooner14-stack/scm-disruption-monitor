import type { TradeLane, CompanyProfile } from "@/lib/profile"

export type StructuralRiskType = "Chokepoint" | "Single-Source Material" | "Capacity Concentration"
export type StructuralRiskSeverity = "Watch" | "Elevated" | "Critical"

export interface StructuralRisk {
  id: string
  name: string
  riskType: StructuralRiskType
  affectedCategories?: string[] // matched against Supplier.category by word-token overlap, e.g. "Semiconductors"
  affectedTradeLanes?: TradeLane[]
  description: string
  sourceUrl: string
  sourceLabel: string
  lastVerified: string // ISO date — when a human last checked this against the source
  severity: StructuralRiskSeverity
}

// Verified against primary/trade-press sources on 2026-08-09 — not estimated.
// These are standing structural exposures (chokepoints, single-source
// materials, capacity concentration), distinct from the reactive
// GDELT/GDACS/NOAA event feed. Revisit and re-verify periodically, same
// discipline as lib/laborCalendar.ts.
export const STRUCTURAL_RISKS: StructuralRisk[] = [
  {
    id: "strait-of-hormuz",
    name: "Strait of Hormuz",
    riskType: "Chokepoint",
    affectedTradeLanes: ["Middle East to Europe"],
    description:
      "About 20% of global petroleum liquids consumption and roughly 25% of all seaborne-traded oil transits this single strait, along with over 20% of global LNG trade (mostly from Qatar). No alternate maritime route exists for Persian Gulf exporters.",
    sourceUrl: "https://www.eia.gov/international/content/analysis/special_topics/World_Oil_Transit_Chokepoints/",
    sourceLabel: "U.S. Energy Information Administration",
    lastVerified: "2026-08-09",
    severity: "Elevated",
  },
  {
    id: "taiwan-semiconductor-concentration",
    name: "Taiwan / TSMC Advanced-Node Semiconductor Concentration",
    riskType: "Capacity Concentration",
    affectedCategories: ["Semiconductors", "Chips", "Electronics"],
    description:
      "TSMC alone produces over 90% of the world's most advanced logic chips (sub-7nm). Meaningful production capacity outside Taiwan isn't expected until 2028 or later, leaving no near-term alternate source for leading-edge chip supply.",
    sourceUrl: "https://simplywall.st/stocks/us/semiconductors/nyse-tsm/taiwan-semiconductor-manufacturing/news/tsmc-supply-chain-risks-and-valuation-tensions-draw-investor",
    sourceLabel: "Simply Wall St",
    lastVerified: "2026-08-09",
    severity: "Critical",
  },
  {
    id: "nitto-boseki-glass-fiber",
    name: "Nitto Boseki (Nittobo) Low-Loss Glass Fiber Cloth",
    riskType: "Single-Source Material",
    affectedCategories: ["Glass fiber", "Fiberglass", "PCB substrate", "Electronic cloth"],
    description:
      "Nittobo holds roughly 90% global share of T-glass and 60-70% of NER-glass (low-Dk) fiberglass cloth used in AI server PCB substrates. Production is already running at full capacity 24/7, with no meaningful relief expected before mid-2027 — Nvidia, Apple, AMD, and Google are all competing directly for allocation.",
    sourceUrl: "https://www.tomshardware.com/tech-industry/artificial-intelligence/glass-cloth-could-be-the-next-great-ai-shortage-as-major-manufacturers-scramble-to-secure-critical-material-japanese-manufacturer-courted-by-apple-nvidia-google-and-amazon",
    sourceLabel: "Tom's Hardware",
    lastVerified: "2026-08-09",
    severity: "Critical",
  },
  {
    id: "dram-memory-capacity-concentration",
    name: "DRAM / HBM Memory Capacity Concentration",
    riskType: "Capacity Concentration",
    affectedCategories: ["Memory", "DRAM", "Semiconductors", "Electronics components"],
    description:
      "Samsung, SK hynix, and Micron are reallocating DRAM/NAND capacity toward higher-margin HBM for AI accelerators. SK hynix reported its 2026 HBM/DRAM/NAND capacity as essentially sold out, and Samsung has warned of significant shortages persisting through at least 2027.",
    sourceUrl: "https://www.tomshardware.com/tech-industry/artificial-intelligence/samsung-and-sk-hynix-warn-ai-driven-memory-shortages-could-last-until-2027-and-beyond-as-hbm-demand-explodes-customers-already-reserving-supply-years-ahead-while-the-wider-dram-market-begins-to-tighten",
    sourceLabel: "Tom's Hardware",
    lastVerified: "2026-08-09",
    severity: "Critical",
  },
]

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2))
}

function categoryTokensOverlap(supplierCategory: string, keyword: string): boolean {
  const a = tokenize(supplierCategory)
  const b = tokenize(keyword)
  return Array.from(a).some(t => b.has(t))
}

export function relevantStructuralRisks(profile: CompanyProfile): StructuralRisk[] {
  return STRUCTURAL_RISKS.filter(risk => {
    const tradeLaneMatch = risk.affectedTradeLanes?.some(l => profile.tradeLanes.includes(l)) ?? false
    const categoryMatch =
      risk.affectedCategories?.some(keyword =>
        profile.suppliers.some(s => categoryTokensOverlap(s.category, keyword))
      ) ?? false
    return tradeLaneMatch || categoryMatch
  })
}
