"use client"

import { useState } from "react"
import { DisruptionEvent, DisruptionCategory } from "@/lib/types"

interface DisruptionFeedProps {
  events: DisruptionEvent[]
}

const FILTERS: Array<"All" | DisruptionCategory> = [
  "All", "Port", "Tariff", "Labor", "Geopolitical", "General",
]

const severityConfig = {
  3: { label: "CRITICAL", borderColor: "border-l-red-500", badgeBg: "bg-red-100", badgeText: "text-red-700" },
  2: { label: "WARNING", borderColor: "border-l-amber-500", badgeBg: "bg-amber-100", badgeText: "text-amber-700" },
  1: { label: "MONITOR", borderColor: "border-l-green-500", badgeBg: "bg-green-100", badgeText: "text-green-700" },
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

export default function DisruptionFeed({ events }: DisruptionFeedProps) {
  const [activeFilter, setActiveFilter] = useState<"All" | DisruptionCategory>("All")

  const filtered =
    activeFilter === "All" ? events : events.filter((e) => e.category === activeFilter)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
          Live Disruption Feed
        </h2>
        <span className="text-xs text-gray-400">{events.length} events</span>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeFilter === filter
                ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-800"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Event list - scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 max-h-96">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <span className="text-2xl mb-2">📭</span>
            <span className="text-sm">No disruptions found for this filter</span>
          </div>
        ) : (
          filtered.map((event) => {
            const config = severityConfig[event.severity]
            return (
              <div
                key={event.id}
                className={`border-l-4 ${config.borderColor} pl-3 pr-2 py-2 rounded-r-lg bg-gray-50 dark:bg-slate-700 hover:shadow-sm transition-all duration-150 hover:-translate-y-px`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${config.badgeBg} ${config.badgeText}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-gray-400 bg-gray-200 dark:bg-slate-600 dark:text-gray-300 px-2 py-0.5 rounded">
                    {event.category}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-100 line-clamp-2 mb-1">
                  {event.title}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {event.sourceDomain} · {formatDate(event.date)}
                  </span>
                  <a
                    href={event.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:text-blue-700 font-medium"
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
