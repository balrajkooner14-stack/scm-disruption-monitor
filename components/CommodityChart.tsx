"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { CommodityResult } from "@/app/api/market-data/route"
import type { IndustrySector } from "@/lib/profile"
import MarketRow from "@/components/MarketRow"
import { ui } from "@/lib/ui"

interface CommodityChartProps {
  commodities: CommodityResult[]
  lastUpdated: string
}

const SECTOR_COMMODITY_MAP: Partial<Record<IndustrySector, string[]>> = {
  Automotive:        ["Copper", "Crude Oil"],
  Electronics:       ["Copper", "Natural Gas"],
  Pharmaceuticals:   ["Crude Oil", "Natural Gas"],
  Retail:            ["Crude Oil", "Wheat"],
  "Food & Beverage": ["Wheat", "Crude Oil"],
  Apparel:           ["Crude Oil"],
  Aerospace:         ["Crude Oil", "Copper"],
  Industrial:        ["Copper", "Crude Oil", "Natural Gas"],
}

export default function CommodityChart({ commodities, lastUpdated }: CommodityChartProps) {
  const { profile } = useCompanyProfile()
  const relevantFor = profile ? (SECTOR_COMMODITY_MAP[profile.sector] ?? []) : []

  const date = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const units = commodities.map(c => `${c.name.toLowerCase()} ${c.unit}`).join(" · ")

  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-3">
        <h2 className={ui.h2}>Commodity prices</h2>
        <span className="text-xs text-ink-3">Yahoo Finance · {date}</span>
      </div>

      {commodities.length === 0 ? (
        <p className={`${ui.emptyText} py-4 border-t border-line-soft`}>No commodity data available.</p>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[380px]">
            {commodities.map(c => (
              <MarketRow
                key={c.id}
                item={c}
                highlight={relevantFor.includes(c.name) ? "Your sector" : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {units && <p className="pt-2.5 text-xs text-ink-3">{units}</p>}
    </section>
  )
}
