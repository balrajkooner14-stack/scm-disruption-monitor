"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { calculateConcentrationRisk } from "@/lib/concentrationRisk"
import { ui } from "@/lib/ui"

// Scale segments sized to the HHI thresholds: 0–1,500 / 1,500–2,500 /
// 2,500–5,000 / 5,000–10,000.
const SCALE = [
  { width: "15%", color: "#DCE5DE", label: "Diversified" },
  { width: "10%", color: "#F0DDB8", label: "Moderate" },
  { width: "25%", color: "#E8B99E", label: "Concentrated" },
  { width: "50%", color: "#D9906C", label: "Critical" },
]

const sentenceCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

export default function ConcentrationRiskCard() {
  const { profile, isLoaded } = useCompanyProfile()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isLoaded || !profile || profile.suppliers.length === 0) return null

  const result = calculateConcentrationRisk(profile.suppliers)

  const markerLeft = `${Math.min(99.5, (result.hhi / 10000) * 100)}%`

  return (
    <section className={`${ui.card} flex flex-col gap-3.5`}>
      <h2 className={ui.h3}>Supplier concentration</h2>

      <div className="flex items-baseline gap-2">
        <span className="font-serif text-5xl leading-none text-ink">{result.hhi.toLocaleString()}</span>
        <span className={ui.meta}>HHI / 10,000</span>
      </div>

      {/* HHI scale */}
      <div className="flex flex-col gap-1.5">
        <div className="flex h-2 rounded-full overflow-hidden">
          {SCALE.map(seg => (
            <div key={seg.label} style={{ width: seg.width, backgroundColor: seg.color }} />
          ))}
        </div>
        <div className="relative h-3" aria-hidden="true">
          <div className="absolute top-0 h-3 w-0.5 bg-ink" style={{ left: markerLeft }} />
        </div>
        <div className="flex justify-between text-[11px] text-ink-3">
          {SCALE.map(seg => <span key={seg.label}>{seg.label}</span>)}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">
        <span className="font-semibold text-ink">{sentenceCase(result.label)}</span>
        {" "}across {result.supplierCount} supplier{result.supplierCount !== 1 ? "s" : ""}. {result.description}
      </p>

      {result.hasEnoughData && result.breakdown.largestCountryShare > 40 && (
        <p className={ui.meta}>
          Largest single country:{" "}
          <span className="font-semibold text-ink">
            {result.breakdown.largestSingleCountry} {result.breakdown.largestCountryShare}%
          </span>
        </p>
      )}

      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className={`${ui.btnGhost} self-start -ml-2`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={isExpanded ? "rotate-180" : ""}>
          <path d="M6 9 L12 15 L18 9" />
        </svg>
        {isExpanded ? "Hide breakdown" : "Show breakdown"}
      </button>

      {isExpanded && (
        <div className={`${ui.divider} pt-4 space-y-4`}>
          {result.breakdown.byCountry.length > 0 && (
            <div className="space-y-2">
              <p className={ui.eyebrow}>By country</p>
              {result.breakdown.byCountry.map(c => (
                <div key={c.country} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">{c.country}</span>
                    <span className="font-semibold text-ink tabular-nums">{c.totalShare}%</span>
                  </div>
                  <div className="h-1.5 bg-paper-sunk rounded-full overflow-hidden">
                    <div className="h-1.5 rounded-full bg-ink" style={{ width: `${c.totalShare}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {result.breakdown.byRegion.length > 0 && (
            <div className="space-y-2">
              <p className={ui.eyebrow}>By region</p>
              {result.breakdown.byRegion.map(r => (
                <div key={r.region} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-ink-2">
                      {r.region} · {r.supplierCount} supplier{r.supplierCount !== 1 ? "s" : ""}
                    </span>
                    <span className="font-semibold text-ink tabular-nums">{r.totalShare}%</span>
                  </div>
                  <div className="h-1.5 bg-paper-sunk rounded-full overflow-hidden">
                    <div className="h-1.5 rounded-full bg-ink" style={{ width: `${r.totalShare}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className={`${ui.cardInner} space-y-1`}>
            <p className="text-xs font-semibold text-ink">Recommendation</p>
            <p className="text-sm leading-relaxed text-ink-2">{result.recommendation}</p>
          </div>

          <p className="text-xs text-ink-3">
            HHI = Herfindahl-Hirschman Index · Standard measure of market
            concentration · Used by supply chain risk professionals globally ·
            Updates automatically as you edit your supplier profile
          </p>
        </div>
      )}
    </section>
  )
}
