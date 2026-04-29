"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { calculateConcentrationRisk } from "@/lib/concentrationRisk"

export default function ConcentrationRiskCard() {
  const { profile, isLoaded } = useCompanyProfile()
  const [isExpanded, setIsExpanded] = useState(false)

  if (!isLoaded || !profile || profile.suppliers.length === 0) return null

  const result = calculateConcentrationRisk(profile.suppliers)

  return (
    <div
      className={`border rounded-xl overflow-hidden ${
        result.level === "critical" || result.level === "concentrated"
          ? `${result.bgClass} ${result.borderClass}`
          : "bg-slate-800 border-slate-700"
      }`}
    >
      {/* Main row — always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-4">
          {/* HHI Score */}
          <div className="text-left">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-0.5">
              Network HHI Score
            </p>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black ${result.colorClass}`}>
                {result.hhi.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500">/ 10,000</span>
            </div>
          </div>

          {/* Vertical divider */}
          <div className="w-px h-10 bg-slate-700" />

          {/* Label + description */}
          <div className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${result.bgClass} ${result.borderClass} ${result.colorClass}`}
              >
                {result.label}
              </span>
              <span className="text-xs text-slate-500">
                {result.supplierCount} supplier
                {result.supplierCount !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-xs text-slate-400 text-left max-w-sm">
              {result.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {result.hasEnoughData &&
            result.breakdown.largestCountryShare > 40 && (
              <div className="text-right hidden sm:block">
                <p className="text-xs text-slate-500">Largest single country</p>
                <p className={`text-sm font-bold ${result.colorClass}`}>
                  {result.breakdown.largestSingleCountry}{" "}
                  {result.breakdown.largestCountryShare}%
                </p>
              </div>
            )}
          <span className="text-slate-500 text-xs">
            {isExpanded ? "▲" : "▼"}
          </span>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-slate-700 px-5 py-4 space-y-4">
          {/* HHI scale visual */}
          <div>
            <p className="text-xs text-slate-500 mb-2">
              Concentration scale (HHI)
            </p>
            <div className="relative h-2 rounded-full overflow-hidden flex">
              <div className="flex-1 bg-green-900" />
              <div className="flex-1 bg-amber-900" />
              <div className="flex-1 bg-orange-900" />
              <div className="flex-1 bg-red-900" />
              {/* Position marker */}
              <div
                className="absolute top-0 w-0.5 h-full bg-white rounded-full"
                style={{
                  left: `${Math.min(99, (result.hhi / 10000) * 100)}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-600 mt-1">
              <span>0 Diversified</span>
              <span>1,500</span>
              <span>2,500</span>
              <span>5,000</span>
              <span>10,000 Critical</span>
            </div>
          </div>

          {/* Country breakdown */}
          {result.breakdown.byCountry.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                By country
              </p>
              <div className="space-y-2">
                {result.breakdown.byCountry.map(c => (
                  <div key={c.country}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-300">{c.country}</span>
                      <span
                        className={`font-bold ${
                          c.totalShare > 40
                            ? "text-red-400"
                            : c.totalShare > 25
                            ? "text-amber-400"
                            : "text-green-400"
                        }`}
                      >
                        {c.totalShare}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${
                          c.totalShare > 40
                            ? "bg-red-500"
                            : c.totalShare > 25
                            ? "bg-amber-500"
                            : "bg-green-500"
                        }`}
                        style={{ width: `${c.totalShare}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Region breakdown */}
          {result.breakdown.byRegion.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                By region
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {result.breakdown.byRegion.map(r => (
                  <div
                    key={r.region}
                    className="bg-slate-700/50 border border-slate-700 rounded-lg px-3 py-2 text-center"
                  >
                    <p className="text-xs text-slate-400 mb-0.5">{r.region}</p>
                    <p
                      className={`text-sm font-bold ${
                        r.totalShare > 50
                          ? "text-red-400"
                          : r.totalShare > 30
                          ? "text-amber-400"
                          : "text-green-400"
                      }`}
                    >
                      {r.totalShare}%
                    </p>
                    <p className="text-xs text-slate-600">
                      {r.supplierCount} supplier
                      {r.supplierCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div
            className={`rounded-lg px-4 py-3 border ${
              result.level === "diversified"
                ? "bg-green-950 border-green-800"
                : result.level === "moderate"
                ? "bg-amber-950 border-amber-800"
                : "bg-red-950 border-red-800"
            }`}
          >
            <p className={`text-xs font-semibold mb-1 ${result.colorClass}`}>
              Recommendation
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              {result.recommendation}
            </p>
          </div>

          <p className="text-xs text-slate-600">
            HHI = Herfindahl-Hirschman Index · Standard measure of market
            concentration · Used by supply chain risk professionals globally ·
            Updates automatically as you edit your supplier profile
          </p>
        </div>
      )}
    </div>
  )
}
