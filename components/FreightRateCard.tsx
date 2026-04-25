"use client"

import type { FreightRate } from "@/app/api/market-data/route"

interface FreightRateCardProps {
  rates: FreightRate[]
  lastUpdated: string
}

export default function FreightRateCard({ rates, lastUpdated }: FreightRateCardProps) {
  const fmt = new Intl.NumberFormat("en-US")
  const date = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🚢</span>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Container Freight Rates
          </h2>
        </div>
        <span className="text-xs text-slate-600">As of {date}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rates.map((r) => (
          <div
            key={r.lane}
            className="bg-slate-900/60 border border-slate-700 rounded-lg p-3"
          >
            <p className="text-xs text-slate-500 mb-2 leading-tight">{r.lane}</p>
            <div className="flex items-end justify-between">
              <span className="text-lg font-bold text-white">
                ${fmt.format(r.rate)}
                <span className="text-xs text-slate-500 font-normal ml-1">
                  {r.unit}
                </span>
              </span>
              <span
                className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                  r.trend === "up"
                    ? "text-red-400 bg-red-900/30"
                    : r.trend === "down"
                      ? "text-green-400 bg-green-900/30"
                      : "text-slate-400 bg-slate-700/30"
                }`}
              >
                {r.trend === "up" ? "▲" : r.trend === "down" ? "▼" : "—"}{" "}
                {Math.abs(r.change).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Static index benchmarks · Rising rates (▲) signal congestion or capacity crunch
      </p>
    </div>
  )
}
