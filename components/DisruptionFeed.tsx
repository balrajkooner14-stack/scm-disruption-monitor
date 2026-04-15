"use client"

import { useState } from "react"
import { DisruptionEvent, DisruptionCategory } from "@/lib/types"

interface DisruptionFeedProps {
  events: DisruptionEvent[]
}

const FILTERS: Array<"All" | DisruptionCategory> = [
  "All", "Port", "Tariff", "Labor", "Geopolitical", "Weather", "General",
]

const severityConfig = {
  3: {
    label: "CRITICAL",
    badgeClass: "bg-red-500 text-white",
    cardClass: "shadow-[0_0_12px_rgba(239,68,68,0.15)]",
  },
  2: {
    label: "WARNING",
    badgeClass: "bg-amber-500 text-white",
    cardClass: "",
  },
  1: {
    label: "MONITOR",
    badgeClass: "bg-slate-600 text-slate-200",
    cardClass: "",
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

export default function DisruptionFeed({ events }: DisruptionFeedProps) {
  const [activeFilter, setActiveFilter] = useState<"All" | DisruptionCategory>("All")

  const filtered =
    activeFilter === "All" ? events : events.filter((e) => e.category === activeFilter)

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex flex-col h-full">

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Live Disruption Feed
        </h2>
        <span className="text-xs text-slate-500">{events.length} events</span>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2 mb-3">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
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
          filtered.map((event) => {
            const config = severityConfig[event.severity]
            return (
              <div
                key={event.id}
                className={`bg-slate-800/50 backdrop-blur-sm rounded-lg px-3 py-2.5 transition-all duration-150 hover:-translate-y-px ${config.cardClass}`}
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
