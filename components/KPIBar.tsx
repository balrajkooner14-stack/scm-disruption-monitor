"use client"

import { DisruptionEvent } from "@/lib/types"
import { ScoredEvent } from "@/lib/scoreEvents"
import { CompanyProfile } from "@/lib/profile"

interface KPIBarProps {
  events: DisruptionEvent[]
  kpiFilter: string | null
  onKpiFilter: (filter: string | null) => void
  scoredEvents?: ScoredEvent[]
  profile?: CompanyProfile | null
  inventorySnapshot?: { criticalCount: number; warningCount: number }
}

export default function KPIBar({ events, kpiFilter, onKpiFilter, scoredEvents, profile, inventorySnapshot }: KPIBarProps) {
  const criticalCount = events.filter((e) => e.severity === 3).length

  const criticalProfileMatchCount = scoredEvents
    ? scoredEvents.filter((e) => e.severity === 3 && e.isProfileMatch).length
    : 0

  const profileMatchCount = scoredEvents
    ? scoredEvents.filter((e) => e.isProfileMatch).length
    : 0

  const hasProfile = !!profile && !!scoredEvents

  // Most affected region (standard, no profile)
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

  // Profile-aware: highest risk supplier region
  const highestRiskSupplierRegion = (() => {
    if (!hasProfile || !profile || !scoredEvents) return null
    const supplierRegionNames = new Set(profile.suppliers.map(s => s.region))
    if (supplierRegionNames.size === 0) return null
    const counts: Record<string, number> = {}
    for (const e of scoredEvents) {
      if (supplierRegionNames.has(e.region as never) && (e.severity === 3 || e.severity === 2)) {
        counts[e.region] = (counts[e.region] ?? 0) + 1
      }
    }
    const entries = Object.entries(counts)
    if (entries.length === 0) return null
    return entries.sort((a, b) => b[1] - a[1])[0][0]
  })()

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1 — Active Events / Events Affecting You */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-blue-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">
            {hasProfile ? "Events Affecting You" : "Active Events"}
          </p>
          <p className="text-3xl font-black text-blue-400">
            {hasProfile ? profileMatchCount : events.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {hasProfile ? `of ${events.length} total events` : "→ Updated live"}
          </p>
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
            {hasProfile && criticalCount > 0
              ? <span className="text-red-400">{criticalProfileMatchCount} affecting your network</span>
              : criticalCount > 0
              ? "Requires immediate attention"
              : "No critical alerts"}
          </p>
        </div>

        {/* Card 3 — Region */}
        <div
          onClick={() => onKpiFilter(kpiFilter === "region" ? null : "region")}
          className={`bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-amber-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01] ${
            kpiFilter === "region" ? "ring-2 ring-amber-500" : ""
          }`}
        >
          <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">
            {hasProfile ? "Your Highest Risk Region" : "Most Affected Region"}
          </p>
          {hasProfile ? (
            highestRiskSupplierRegion ? (
              <p className="text-base font-bold text-amber-400 leading-tight">{highestRiskSupplierRegion}</p>
            ) : (
              <p className="text-base font-bold text-green-400 leading-tight">Your regions: Clear ✓</p>
            )
          ) : mostAffectedRegion === "Unknown" ? (
            <p className="text-base font-bold text-slate-500 italic leading-tight">Calculating...</p>
          ) : (
            <p className="text-base font-bold text-amber-400 leading-tight">{mostAffectedRegion}</p>
          )}
        </div>

        {/* Card 4 — Inventory Alerts (when profile) or Data Window */}
        {inventorySnapshot ? (
          inventorySnapshot.criticalCount > 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-red-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Inventory Alerts</p>
              <p className="text-3xl font-black text-red-400">{inventorySnapshot.criticalCount}</p>
              <p className="text-xs text-slate-500 mt-1">items need reorder</p>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-green-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Inventory Status</p>
              <p className="text-2xl font-black text-green-400">Clear</p>
              <p className="text-xs text-slate-500 mt-1">All stock levels adequate</p>
            </div>
          )
        ) : (
          <div className="bg-slate-800 rounded-lg border border-slate-700 border-t-2 border-t-green-500 p-4 cursor-pointer transition-all duration-150 hover:scale-[1.01]">
            <p className="text-xs text-slate-400 uppercase tracking-widest mb-2">Data Window</p>
            <p className="text-2xl font-black text-green-400">Last 24h</p>
            <p className="text-xs text-slate-500 mt-1">↻ Live · GDELT 4,500+ sources</p>
          </div>
        )}
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
