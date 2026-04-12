"use client"

import { DisruptionEvent } from "@/lib/types"

interface KPIBarProps {
  events: DisruptionEvent[]
}

export default function KPIBar({ events }: KPIBarProps) {
  const criticalCount = events.filter((e) => e.severity === 3).length

  const mostAffectedRegion = (() => {
    if (events.length === 0) return "None"
    const counts: Record<string, number> = {}
    for (const e of events) {
      counts[e.region] = (counts[e.region] ?? 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
  })()

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Card 1 — Active Events */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-4 border-l-blue-500 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Active Events
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {events.length}
        </p>
      </div>

      {/* Card 2 — Critical */}
      <div
        className={`bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-4 p-4 ${
          criticalCount > 0 ? "border-l-red-500" : "border-l-gray-300 dark:border-l-slate-600"
        }`}
      >
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Critical
        </p>
        <p
          className={`text-2xl font-bold ${
            criticalCount > 0
              ? "text-red-600"
              : "text-gray-400 dark:text-slate-500"
          }`}
        >
          {criticalCount}
        </p>
      </div>

      {/* Card 3 — Most Affected Region */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-4 border-l-amber-500 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Most Affected Region
        </p>
        <p className="text-base font-bold text-gray-900 dark:text-white leading-tight">
          {mostAffectedRegion}
        </p>
      </div>

      {/* Card 4 — Data Window */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 border-l-4 border-l-green-500 p-4">
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
          Data Window
        </p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">Last 24h</p>
        <p className="text-xs text-gray-400 mt-1">GDELT · 4,500+ sources</p>
      </div>
    </div>
  )
}
