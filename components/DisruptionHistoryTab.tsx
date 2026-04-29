"use client"

import { useState, useEffect } from "react"
import {
  loadHistory,
  exportHistoryAsCSV,
  clearHistory,
  groupEntriesByMonth,
  HistoryEntry,
} from "@/lib/disruptionHistory"

const SEVERITY_CONFIG = {
  CRITICAL: { badge: "bg-red-600 text-white", dot: "bg-red-500" },
  WARNING: { badge: "bg-amber-600 text-white", dot: "bg-amber-500" },
  MONITOR: { badge: "bg-slate-600 text-slate-200", dot: "bg-slate-500" },
}

export default function DisruptionHistoryTab() {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [filter, setFilter] = useState<"all" | "profile" | "critical">("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  useEffect(() => {
    setEntries(loadHistory())
    setIsLoaded(true)
  }, [])

  const filtered = entries.filter(e => {
    if (filter === "profile") return e.isProfileMatch
    if (filter === "critical") return e.severity === 3
    return true
  })

  const grouped = groupEntriesByMonth(filtered)

  const handleExport = () => exportHistoryAsCSV(filtered)

  const handleClear = () => {
    clearHistory()
    setEntries([])
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
      <div className="max-w-3xl mx-auto">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 animate-pulse">
          <div className="h-4 bg-slate-700 rounded w-1/3 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header card */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🕐</span>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Disruption History Log
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              {entries.length > 0
                ? `${entries.length} events logged · ${dateRange} · 90-day rolling window`
                : "No events logged yet — history auto-saves when you visit the dashboard"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {entries.length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 rounded-lg px-3 py-1.5 transition-colors"
                >
                  <span>⬇</span>
                  Export CSV
                </button>
                {!showClearConfirm ? (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors px-2 py-1.5"
                  >
                    Clear
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-red-400">Sure?</span>
                    <button
                      onClick={handleClear}
                      className="text-xs text-red-400 hover:text-red-300 font-medium px-2 py-1"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="text-xs text-slate-500 px-2 py-1"
                    >
                      No
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2">
          {(["all", "profile", "critical"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-all duration-150 ${
                filter === f
                  ? "bg-slate-600 border-slate-500 text-white"
                  : "bg-slate-700/50 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {f === "all"
                ? `All (${entries.length})`
                : f === "profile"
                ? `Profile matches (${entries.filter(e => e.isProfileMatch).length})`
                : `Critical only (${entries.filter(e => e.severity === 3).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
          <p className="text-2xl mb-3">🕐</p>
          <p className="text-slate-300 font-medium mb-2">No history yet</p>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Every time you visit the dashboard, critical and warning events are
            automatically saved here. Come back after your next session to see
            your history build up.
          </p>
        </div>
      )}

      {/* No filter results */}
      {entries.length > 0 && filtered.length === 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">
            No events match this filter in your history.
          </p>
        </div>
      )}

      {/* Timeline grouped by month */}
      {grouped.map(({ monthLabel, entries: monthEntries }) => (
        <div key={monthLabel}>
          {/* Month header */}
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {monthLabel}
            </span>
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-600">
              {monthEntries.length} event{monthEntries.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Entries */}
          <div className="space-y-2">
            {monthEntries.map(entry => {
              const sevConfig =
                SEVERITY_CONFIG[entry.severityLabel as keyof typeof SEVERITY_CONFIG] ??
                SEVERITY_CONFIG.MONITOR
              const isExpanded = expandedId === entry.id

              return (
                <div
                  key={entry.id}
                  className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden"
                >
                  {/* Entry row */}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-slate-700/30 transition-colors"
                  >
                    {/* Severity dot */}
                    <div className="flex-shrink-0 mt-1">
                      <div className={`w-2 h-2 rounded-full ${sevConfig.dot}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span
                          className={`text-xs font-bold px-1.5 py-0.5 rounded ${sevConfig.badge}`}
                        >
                          {entry.severityLabel}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">
                          {entry.category}
                        </span>
                        <span className="text-xs text-slate-500">{entry.region}</span>
                        {entry.isProfileMatch && (
                          <span className="text-xs text-cyan-400 bg-cyan-950 border border-cyan-800 px-1.5 py-0.5 rounded">
                            Your network
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-200 leading-snug truncate">
                        {entry.title}
                      </p>
                    </div>

                    {/* Date + expand */}
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs text-slate-500">
                        {new Date(entry.savedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {isExpanded ? "▲" : "▼"}
                      </p>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-slate-700 px-4 py-3 bg-slate-700/20 space-y-2">
                      {entry.relevanceReason && (
                        <p className="text-xs text-slate-400 italic">
                          &ldquo;{entry.relevanceReason}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span>Source: {entry.sourceDomain || "Unknown"}</span>
                          <span>Relevance: {entry.relevanceScore}/100</span>
                          <span>Logged: {new Date(entry.savedAt).toLocaleString()}</span>
                        </div>
                        <a
                          href={entry.eventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          Read article →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Footer info */}
      {entries.length > 0 && (
        <p className="text-xs text-slate-700 text-center pb-2">
          History stored locally in your browser · 90-day rolling window · Max
          500 entries · Export CSV to preserve long-term records
        </p>
      )}
    </div>
  )
}
