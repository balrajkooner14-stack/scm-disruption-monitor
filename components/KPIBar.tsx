"use client"

import { DisruptionEvent } from "@/lib/types"

interface KPIBarProps {
  events: DisruptionEvent[]
}

export default function KPIBar({ events }: KPIBarProps) {
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Card 1 — Active Events */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-blue-500 p-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Active Events</p>
        <p className="text-3xl font-black text-blue-400">{events.length}</p>
        <p className="text-xs text-slate-500 mt-1">→ Updated live</p>
      </div>

      {/* Card 2 — Critical */}
      <div
        className={`rounded-lg border border-t-2 p-4 ${
          criticalCount > 0
            ? "bg-red-950 border-slate-700 border-t-red-500"
            : "bg-slate-800 border-slate-700 border-t-slate-600"
        }`}
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
      <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-amber-500 p-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Most Affected Region</p>
        {mostAffectedRegion === "Unknown" ? (
          <p className="text-base font-bold text-slate-500 italic leading-tight">Calculating...</p>
        ) : (
          <p className="text-base font-bold text-amber-400 leading-tight">{mostAffectedRegion}</p>
        )}
      </div>

      {/* Card 4 — Data Window */}
      <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-green-500 p-4">
        <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Data Window</p>
        <p className="text-2xl font-black text-green-400">Last 24h</p>
        <p className="text-xs text-slate-500 mt-1">↻ Live · GDELT 4,500+ sources</p>
      </div>
    </div>
  )
}
