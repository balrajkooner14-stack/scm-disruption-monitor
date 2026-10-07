"use client"

import { Fragment, useState } from "react"
import { exportHistoryAsCSV, groupEntriesByMonth } from "@/lib/disruptionHistory"
import { useDisruptionHistory } from "@/hooks/useDisruptionHistory"
import { useAuth } from "@/hooks/useAuth"
import { ui } from "@/lib/ui"

// App-wide severity system.
const SEVERITY_CHIP = {
  CRITICAL: ui.chipCritical,
  WARNING: ui.chipWarning,
  MONITOR: ui.chipMonitor,
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-180" : ""}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

export default function DisruptionHistoryTab() {
  const { entries, isLoaded, clear } = useDisruptionHistory()
  const { user } = useAuth()
  const [filter, setFilter] = useState<"all" | "profile" | "critical">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const filtered = entries.filter(e => {
    if (filter === "profile") return e.isProfileMatch
    if (filter === "critical") return e.severity === 3
    return true
  })

  const grouped = groupEntriesByMonth(filtered)

  const handleExport = () => exportHistoryAsCSV(filtered)

  const handleClear = () => {
    clear()
    setShowClearConfirm(false)
  }

  const oldestEntry = entries[entries.length - 1]
  const newestEntry = entries[0]

  const dateRange =
    entries.length > 0
      ? `${new Date(oldestEntry.savedAt).toLocaleDateString()} – ${new Date(newestEntry.savedAt).toLocaleDateString()}`
      : null

  if (!isLoaded) {
    return (
      <div className={`${ui.card} space-y-4`} aria-busy="true">
        <div className={`${ui.skeleton} h-6 w-1/3`} />
        {[1, 2, 3].map(i => (
          <div key={i} className={`${ui.skeleton} h-10`} />
        ))}
      </div>
    )
  }

  const counts = {
    all: entries.length,
    profile: entries.filter(e => e.isProfileMatch).length,
    critical: entries.filter(e => e.severity === 3).length,
  }
  const FILTER_LABELS = { all: "All", profile: "Profile matches", critical: "Critical only" } as const

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className={ui.h1}>Disruption history</h1>
          <p className={ui.meta}>
            {entries.length > 0
              ? `${entries.length} events logged · ${dateRange} · 90-day rolling window`
              : "No events logged yet — history auto-saves when you visit the dashboard"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
            {(["all", "profile", "critical"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={filter === f ? ui.pillActive : ui.pill}
              >
                {FILTER_LABELS[f]} {counts[f]}
              </button>
            ))}
          </div>
          {entries.length > 0 && (
            <>
              <button onClick={handleExport} className={ui.btnSecondary}>
                Export CSV
              </button>
              {!showClearConfirm ? (
                <button onClick={() => setShowClearConfirm(true)} className={ui.btnGhost}>
                  Clear
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={ui.meta}>Clear all history?</span>
                  <button onClick={handleClear} className={ui.btnAccent}>
                    Clear history
                  </button>
                  <button onClick={() => setShowClearConfirm(false)} className={ui.btnGhost}>
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className={`${ui.card} space-y-2`}>
          <h2 className={ui.h3}>No history yet</h2>
          <p className={ui.emptyText}>
            Every time you visit the dashboard, critical and warning events are
            automatically saved here. Come back after your next session to see
            your history build up.
          </p>
        </div>
      )}

      {/* No filter results */}
      {entries.length > 0 && filtered.length === 0 && (
        <div className={ui.card}>
          <p className={ui.emptyText}>No events match this filter in your history.</p>
        </div>
      )}

      {/* Monthly tables */}
      {grouped.map(({ monthLabel, entries: monthEntries }) => (
        <section key={monthLabel} className={`${ui.card} pt-5 pb-3`}>
          <div className="flex items-baseline justify-between pb-2">
            <h2 className={ui.h3}>{monthLabel}</h2>
            <span className={ui.meta}>
              {monthEntries.length} event{monthEntries.length !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  <th scope="col" className="py-2.5 pr-4 font-semibold w-[90px]">Date</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold w-[120px]">Severity</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold w-[120px]">Category</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold w-[150px]">Region</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Event</th>
                  <th scope="col" className="py-2.5 w-8"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {monthEntries.map(entry => {
                  const chip =
                    SEVERITY_CHIP[entry.severityLabel as keyof typeof SEVERITY_CHIP] ??
                    SEVERITY_CHIP.MONITOR
                  const isExpanded = expandedId === entry.id
                  const toggle = () => setExpandedId(isExpanded ? null : entry.id)

                  return (
                    <Fragment key={entry.id}>
                      <tr
                        onClick={toggle}
                        className="border-t border-line-soft cursor-pointer transition-colors hover:bg-surface"
                      >
                        <td className="py-3.5 pr-4 text-[15px] text-ink-3 tabular-nums whitespace-nowrap">
                          {new Date(entry.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td className="py-3.5 pr-4">
                          <span className={`${ui.chip} ${chip}`}>{entry.severityLabel}</span>
                        </td>
                        <td className="py-3.5 pr-4 text-[15px] text-ink">{entry.category}</td>
                        <td className={`py-3.5 pr-4 text-[15px] ${entry.region === "Unknown" ? "text-ink-3" : "text-ink"}`}>
                          {entry.region}
                        </td>
                        <td className="py-3.5 pr-4 text-[15px] text-ink">
                          <span className="line-clamp-2">{entry.title}</span>
                          {entry.isProfileMatch && (
                            <span className="text-xs font-semibold text-ember">Your network</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              toggle()
                            }}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? "Hide details" : "Show details"}
                            className="rounded p-1 text-ink-3 transition-colors hover:text-ink"
                          >
                            <Chevron open={isExpanded} />
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="pb-3.5">
                            <div className={`${ui.cardInner} space-y-2`}>
                              {entry.relevanceReason && (
                                <p className="text-sm text-ink-2">&ldquo;{entry.relevanceReason}&rdquo;</p>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
                                  <span>Source: {entry.sourceDomain || "Unknown"}</span>
                                  <span>Relevance: {entry.relevanceScore}/100</span>
                                  <span>Logged: {new Date(entry.savedAt).toLocaleString()}</span>
                                </div>
                                <a
                                  href={entry.eventUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[13px] text-ember transition-colors hover:text-ember-deep"
                                  onClick={e => e.stopPropagation()}
                                >
                                  Read article →
                                </a>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Footer info */}
      {entries.length > 0 && (
        <p className="text-xs text-ink-3">
          {user ? "History synced to your account" : "History stored locally in your browser"}
          {" "}· 90-day rolling window · Max 500 entries · Export CSV to preserve long-term records
        </p>
      )}
    </div>
  )
}
