"use client"

import { DisruptionEvent } from "@/lib/types"

interface KPIBarProps {
  events: DisruptionEvent[]
  kpiFilter: string | null
  onKpiFilter: (filter: string | null) => void
}

export default function KPIBar({ events, kpiFilter, onKpiFilter }: KPIBarProps) {
  const criticalCount = events.filter((e) => e.severity === 3).length

  const mostAffectedRegion = (() => {
    if (events.length === 0) return "Unknown"
    const counts: Record<string, number> = {}
    for (const e of events) {
      if (e.region === "Unknown") continue
      counts[e.region] = (counts[e.region] ?? 0) + 1
    }
    const entries = Object.entries(counts)
    if (entries.length === 0) return "Unknown"
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  })()

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1 — Active Events */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-blue-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Active Events</p>
          <p className="text-3xl font-black text-blue-400">{events.length}</p>
          <p className="text-xs text-slate-500 mt-1">→ Updated live</p>
        </div>

        {/* Card 2 — Critical */}
        <div
          onClick={() => onKpiFilter(kpiFilter === "critical" ? null : "critical")}
          className={`rounded-lg border border-t-2 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01] ${
            criticalCount > 0
              ? "bg-red-950 border-slate-700 border-t-red-500"
              : "bg-slate-800 border-slate-700 border-t-slate-600"
          } ${kpiFilter === "critical" ? "ring-2 ring-red-500" : ""}`}
        >
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Critical</p>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-black ${criticalCount > 0 ? "text-red-400" : "text-slate-400"}`}>
              {criticalCount}
            </p>
            {criticalCount > 0 && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {criticalCount > 0 ? "Requires immediate attention" : "No critical alerts"}
          </p>
        </div>

        {/* Card 3 — Most Affected Region */}
        <div
          onClick={() => onKpiFilter(kpiFilter === "region" ? null : "region")}
          className={`bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-amber-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01] ${
            kpiFilter === "region" ? "ring-2 ring-amber-500" : ""
          }`}
        >
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Most Affected Region</p>
          {mostAffectedRegion === "Unknown" ? (
            <p className="text-base font-bold text-slate-500 italic leading-tight">Calculating...</p>
          ) : (
            <p className="text-base font-bold text-amber-400 leading-tight">{mostAffectedRegion}</p>
          )}
        </div>

        {/* Card 4 — Data Window */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-green-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Data Window</p>
          <p className="text-2xl font-black text-green-400">Last 24h</p>
          <p className="text-xs text-slate-500 mt-1">↻ Live · GDELT 4,500+ sources</p>
        </div>
      </div>

      {/* Clear filter pill */}
      {kpiFilter && (
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => onKpiFilter(null)}
            className="text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-full border border-slate-600 transition-colors flex items-center gap-1"
          >
            ✕ Clear filter
          </button>
        </div>
      )}
    </div>
  )
}
