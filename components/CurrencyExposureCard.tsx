"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { currencyCodesForCountries } from "@/lib/currencyMapping"
import type { CommodityResult } from "@/app/api/market-data/route"
import MarketRow from "@/components/MarketRow"
import { ui } from "@/lib/ui"

interface CurrencyExposureCardProps {
  currencies: CommodityResult[]
  lastUpdated: string
}

export default function CurrencyExposureCard({ currencies, lastUpdated }: CurrencyExposureCardProps) {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded) return null
  if (!profile || profile.suppliers.length === 0) return null

  const relevantCodes = currencyCodesForCountries(profile.suppliers.map(s => s.country))
  const relevant = currencies.filter(c => relevantCodes.has(c.id.replace("=X", "")))

  if (relevant.length === 0) return null

  const date = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const units = Array.from(new Set(relevant.map(c => c.unit))).join(" · ")

  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1">
        <h2 className={ui.h2}>Currency exposure</h2>
        <span className="text-xs text-ink-3">Yahoo Finance · {date}</span>
      </div>
      <p className={`${ui.meta} pb-3`}>
        Rates for currencies used by your supplier countries — swings here change your landed cost even when nothing else does.
      </p>

      <div className="overflow-x-auto">
        <div className="min-w-[380px]">
          {relevant.map(c => (
            <MarketRow key={c.id} item={c} />
          ))}
        </div>
      </div>

      {units && <p className="pt-2.5 text-xs text-ink-3">{units}</p>}
    </section>
  )
}
