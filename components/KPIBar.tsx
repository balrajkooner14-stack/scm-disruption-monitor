"use client"

import { DisruptionEvent } from "@/lib/types"
import { ScoredEvent } from "@/lib/scoreEvents"
import { CompanyProfile } from "@/lib/profile"
import { ui } from "@/lib/ui"

interface KPIBarProps {
  events: DisruptionEvent[]
  kpiFilter: string | null
  onKpiFilter: (filter: string | null) => void
  scoredEvents?: ScoredEvent[]
  profile?: CompanyProfile | null
  inventorySnapshot?: { criticalCount: number; warningCount: number }
  concentrationResult?: {
    hhi: number
    label: string
    level: string
    colorClass: string
  }
  spofCount?: number
}

export default function KPIBar({ events, kpiFilter, onKpiFilter, scoredEvents, profile, inventorySnapshot, concentrationResult, spofCount }: KPIBarProps) {
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

  // Shared card shell. Value colour is the only state signal.
  const shell =
    "bg-paper-raised border border-line rounded-xl px-5 py-5 text-left flex flex-col gap-1.5 transition-colors hover:border-line-strong"
  const activeRing = "ring-1 ring-ink border-ink"
  const label = ui.meta
  const sub = ui.meta

  // Card 4 value colour: the HHI card shows diversified as all-clear,
  // anything else neutral (concentrated/critical take the concentration
  // branch above it).
  const hhiValueClass = (level: string) => (level === "diversified" ? "text-moss" : "text-ink")

  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 — Active Events / Events Affecting You */}
        <div className={shell}>
          <p className={label}>{hasProfile ? "Events affecting you" : "Active events"}</p>
          <p className={`${ui.stat} text-ink`}>
            {hasProfile ? profileMatchCount : events.length}
          </p>
          <p className={sub}>
            {hasProfile ? `of ${events.length} monitored` : "Updated live"}
          </p>
        </div>

        {/* Card 2 — Critical */}
        <button
          type="button"
          onClick={() => onKpiFilter(kpiFilter === "critical" ? null : "critical")}
          aria-pressed={kpiFilter === "critical"}
          className={`${shell} ${kpiFilter === "critical" ? activeRing : ""}`}
        >
          <span className={label}>Critical</span>
          <span className={`${ui.stat} ${criticalCount > 0 ? "text-ember" : "text-moss"}`}>
            {criticalCount}
          </span>
          <span className={sub}>
            {hasProfile && criticalCount > 0
              ? `${criticalProfileMatchCount} in your network`
              : criticalCount > 0
              ? "Requires immediate attention"
              : "No critical alerts"}
          </span>
        </button>

        {/* Card 3 — Region */}
        <button
          type="button"
          onClick={() => onKpiFilter(kpiFilter === "region" ? null : "region")}
          aria-pressed={kpiFilter === "region"}
          className={`${shell} ${kpiFilter === "region" ? activeRing : ""}`}
        >
          <span className={label}>{hasProfile ? "Highest-risk region" : "Most affected region"}</span>
          {hasProfile ? (
            highestRiskSupplierRegion ? (
              <span className="font-serif text-[32px] leading-tight text-ink">{highestRiskSupplierRegion}</span>
            ) : (
              <span className="font-serif text-[32px] leading-tight text-moss">Your regions are clear</span>
            )
          ) : mostAffectedRegion === "Unknown" ? (
            <span className="font-serif text-[32px] leading-tight text-ink-3">Calculating…</span>
          ) : (
            <span className="font-serif text-[32px] leading-tight text-ink">{mostAffectedRegion}</span>
          )}
        </button>

        {/* Card 4 — Priority: inventory critical > concentration risk > single points of failure > inventory warning > HHI > data window */}
        {inventorySnapshot && inventorySnapshot.criticalCount > 0 ? (
          <div className={shell}>
            <p className={label}>Inventory alerts</p>
            <p className={`${ui.stat} text-ember`}>{inventorySnapshot.criticalCount}</p>
            <p className={sub}>items need reorder</p>
          </div>
        ) : concentrationResult && (concentrationResult.level === "concentrated" || concentrationResult.level === "critical") ? (
          <div className={shell}>
            <p className={label}>Concentration risk</p>
            <p className={`${ui.stat} text-ochre`}>
              {concentrationResult.hhi.toLocaleString()}
            </p>
            <p className={sub}>{concentrationResult.label}</p>
          </div>
        ) : spofCount && spofCount > 0 ? (
          <div className={shell}>
            <p className={label}>Single points of failure</p>
            <p className={`${ui.stat} text-ochre`}>{spofCount}</p>
            <p className={sub}>product{spofCount > 1 ? "s" : ""} with no backup path</p>
          </div>
        ) : inventorySnapshot && inventorySnapshot.warningCount > 0 ? (
          <div className={shell}>
            <p className={label}>Inventory alerts</p>
            <p className={`${ui.stat} text-ochre`}>{inventorySnapshot.warningCount}</p>
            <p className={sub}>items below reorder point</p>
          </div>
        ) : concentrationResult ? (
          <div className={shell}>
            <p className={label}>Network HHI</p>
            <p className={`${ui.stat} ${hhiValueClass(concentrationResult.level)}`}>
              {concentrationResult.hhi.toLocaleString()}
            </p>
            <p className={sub}>{concentrationResult.label}</p>
          </div>
        ) : (
          <div className={shell}>
            <p className={label}>Data window</p>
            <p className="font-serif text-[32px] leading-tight text-ink">Last 24h</p>
            <p className={sub}>Live · GDELT 4,500+ sources</p>
          </div>
        )}
      </div>

      {/* Clear filter */}
      {kpiFilter && (
        <div className="mt-2">
          <button type="button" onClick={() => onKpiFilter(null)} className={ui.btnGhost}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M6 6 L18 18 M18 6 L6 18" />
            </svg>
            Clear filter
          </button>
        </div>
      )}
    </div>
  )
}
