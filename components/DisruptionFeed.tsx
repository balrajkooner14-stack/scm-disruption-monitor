"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DisruptionEvent, DisruptionCategory } from "@/lib/types"

interface DisruptionFeedProps {
  events: DisruptionEvent[]
  regionFilter?: string | null
  onRegionClear?: () => void
  kpiFilter?: string | null
}

const FILTERS: Array<"All" | DisruptionCategory> = [
  "All", "Port", "Tariff", "Labor", "Geopolitical", "Weather", "General",
]

const severityConfig = {
  3: {
    label: "CRITICAL",
    badgeClass: "bg-red-500 text-white",
    borderColor: "border-red-500",
  },
  2: {
    label: "WARNING",
    badgeClass: "bg-amber-500 text-white",
    borderColor: "border-amber-500",
  },
  1: {
    label: "MONITOR",
    badgeClass: "bg-slate-600 text-slate-200",
    borderColor: "border-slate-600",
  },
}

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

export default function DisruptionFeed({ events, regionFilter, onRegionClear, kpiFilter }: DisruptionFeedProps) {
  const router = useRouter()
  const [activeFilter, setActiveFilter] = useState<"All" | DisruptionCategory>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  function handleRefresh() {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => {
      setIsRefreshing(false)
      setLastUpdated(new Date())
    }, 1500)
  }

  const timeStr = lastUpdated.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })

  let filtered = activeFilter === "All" ? events : events.filter((e) => e.category === activeFilter)

  if (regionFilter) {
    filtered = filtered.filter((e) => e.region === regionFilter)
  }

  if (kpiFilter === "critical") {
    filtered = filtered.filter((e) => e.severity === 3)
  } else if (kpiFilter === "region") {
    const mostAffectedRegion = (() => {
      if (events.length === 0) return null
      const counts: Record<string, number> = {}
      for (const e of events) {
        if (e.region === "Unknown") continue
        counts[e.region] = (counts[e.region] ?? 0) + 1
      }
      const entries = Object.entries(counts)
      if (entries.length === 0) return null
      return entries.sort((a, b) => b[1] - a[1])[0][0]
    })()
    if (mostAffectedRegion) {
      filtered = filtered.filter((e) => e.region === mostAffectedRegion)
    }
  }

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        e.region.toLowerCase().includes(q) ||
        e.sourceDomain.toLowerCase().includes(q)
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Live Disruption Feed
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{events.length} events</span>
          <button
            onClick={handleRefresh}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
            aria-label="Refresh feed"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      <p className="text-xs text-slate-500 mb-3">Updated {timeStr}</p>

      {/* Region filter badge */}
      {regionFilter && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-blue-400 bg-blue-950 border border-blue-800 px-2 py-1 rounded-full">
            📍 Filtered: {regionFilter}
          </span>
          <button
            onClick={onRegionClear}
            className="text-xs text-slate-400 hover:text-white transition-colors"
          >
            Clear ✕
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-3">
        <input
          type="text"
          placeholder="Search disruptions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors pr-7"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-sm leading-none transition-colors"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>
      {searchQuery.trim() && (
        <p className="text-xs text-slate-500 mb-2">
          Showing {filtered.length} of {events.length} events
        </p>
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all duration-150 ${
              activeFilter === filter
                ? "bg-blue-600 text-white border-blue-500"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-slate-500">
            <span className="text-2xl mb-2">📭</span>
            <span className="text-sm">No disruptions found for this filter</span>
          </div>
        ) : (
          filtered.map((event, index) => {
            const config = severityConfig[event.severity]
            return (
              <div
                key={event.id}
                className={`border-l-4 ${config.borderColor} pl-3 pr-2 py-3 rounded-r-lg bg-slate-800/50 cursor-pointer transition-all duration-150 ease-out hover:bg-slate-700/70 hover:border-l-[6px] hover:pl-[10px] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] ${event.severity === 3 ? "critical-card" : ""}`}
                style={{
                  animationName: "cardEntrance",
                  animationDuration: "0.3s",
                  animationFillMode: "both",
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                    {config.label}
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
                    {event.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-100 line-clamp-2 mb-1">
                  {event.title}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    {event.sourceDomain} · {formatDate(event.date)}
                  </span>
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    Read →
                  </a>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
