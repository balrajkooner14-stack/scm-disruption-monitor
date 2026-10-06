"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DisruptionCategory } from "@/lib/types"
import { ScoredEvent } from "@/lib/scoreEvents"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import EventBriefPanel from "@/components/EventBriefPanel"
import type { EventBriefResponse } from "@/app/api/event-brief/route"
import {
  saveCategorySnapshot,
  buildCategoryTrends,
  getTrendColor,
  type CategoryTrend,
} from "@/lib/categoryTrends"
import CategorySparkline from "@/components/CategorySparkline"
import { ui } from "@/lib/ui"

interface DisruptionFeedProps {
  events: ScoredEvent[]
  regionFilter?: string | null
  onRegionClear?: () => void
  kpiFilter?: string | null
}

const FILTERS: Array<"All" | DisruptionCategory> = [
  "All", "Port", "Tariff", "Labor", "Geopolitical", "Weather", "General",
]

const severityConfig = {
  3: { label: "CRITICAL", badgeClass: "bg-ember text-white" },
  2: { label: "WARNING",  badgeClass: "bg-ochre-tint text-ochre" },
  1: { label: "MONITOR",  badgeClass: "bg-sea-tint text-sea-deep" },
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={open ? "rotate-180" : ""}
    >
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

function buildFallbackSearchUrl(title: string, domain: string): string {
  const query = domain ? `${title} site:${domain}` : title
  return `https://news.google.com/search?q=${encodeURIComponent(query)}`
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
  const { profile } = useCompanyProfile()
  const [activeFilter, setActiveFilter] = useState<"All" | DisruptionCategory>("All")
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [briefCache, setBriefCache] = useState<Record<string, EventBriefResponse>>({})
  const [searchQuery, setSearchQuery] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sortMode, setSortMode] = useState<"relevance" | "recent">(
    events[0]?.relevanceScore > 0 ? "relevance" : "recent"
  )
  const [categoryTrends, setCategoryTrends] = useState<Record<string, CategoryTrend>>({})

  useEffect(() => {
    if (events.length === 0) return
    const timer = setTimeout(() => {
      saveCategorySnapshot(events)
      const trends = buildCategoryTrends(events)
      setCategoryTrends(trends)
    }, 3000)
    return () => clearTimeout(timer)
  }, [events.length])

  function handleRefresh() {
    setIsRefreshing(true)
    router.refresh()
    setTimeout(() => setIsRefreshing(false), 1500)
  }

  const hasProfileScoring =
    events.length > 0 &&
    events[0].relevanceReason !== "Set up your profile for personalized scoring"

  let filtered = activeFilter === "All" ? [...events] : events.filter((e) => e.category === activeFilter)

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

  // Sort
  if (sortMode === "recent") {
    filtered = [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }
  // "relevance" — events are already sorted by scoreEventsForProfile; filtering preserves order

  const highlyRelevantCount = events.filter((e) => e.isProfileMatch).length

  return (
    <section className={`${ui.card} flex flex-col h-full gap-3`}>

      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-3">
          <h2 className={ui.h2}>Live feed</h2>
          <span className={ui.meta}>
            {events.length} events{hasProfileScoring && ` · ${highlyRelevantCount} relevant`}
          </span>
        </div>
        <button onClick={handleRefresh} className={ui.btnSecondary} aria-label="Refresh feed">
          <svg
            className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* Sort mode toggle */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${ui.meta} mr-1`}>Sort</span>
        {(["relevance", "recent"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            aria-pressed={sortMode === mode}
            className={sortMode === mode ? ui.pillActive : ui.pill}
          >
            {mode === "relevance" ? "Relevance" : "Recent"}
          </button>
        ))}
      </div>

      {/* Region filter */}
      {regionFilter && (
        <div className="flex items-center gap-2">
          <span className={`${ui.chip} ${ui.chipNeutral}`}>Filtered: {regionFilter}</span>
          <button onClick={onRegionClear} className={ui.btnGhost}>
            <CloseIcon />
            Clear
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20 L16 16" />
        </svg>
        <input
          type="text"
          placeholder="Search disruptions…"
          aria-label="Search disruptions"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`${ui.input} pl-9 pr-9`}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-3 transition-colors hover:text-ink"
            aria-label="Clear search"
          >
            <CloseIcon />
          </button>
        )}
      </div>
      {searchQuery.trim() && (
        <p className={ui.meta}>
          Showing {filtered.length} of {events.length} events
        </p>
      )}

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => {
          const trend = filter !== "All" ? categoryTrends[filter] : undefined
          const trendColors = trend ? getTrendColor(trend.trend) : null
          const isActive = activeFilter === filter
          const tooltipText = trend
            ? trend.history.length >= 2
              ? `${filter} events: ${trend.changePercent > 0 ? "+" : ""}${trend.changePercent}% vs 7 days ago`
              : `${filter} — building trend data…`
            : filter

          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              title={tooltipText}
              aria-pressed={isActive}
              className={`${isActive ? ui.pillActive : ui.pill} flex items-center gap-1.5`}
            >
              <span>{filter}</span>
              {trend && trend.history.length >= 2 && (
                <CategorySparkline trend={trend} />
              )}
              {trend && trend.history.length >= 2 && (
                <span className={`text-xs leading-none flex-shrink-0 ${
                  isActive ? "text-paper" : trendColors?.text ?? "text-ink-3"
                }`}>
                  {trend.trend === "rising" ? "↑"
                   : trend.trend === "falling" ? "↓"
                   : "→"}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Event list */}
      <div className="flex-1 overflow-y-auto max-h-[28rem] px-2 -mx-2">
        {filtered.length === 0 ? (
          <p className={`${ui.emptyText} py-10 text-center border-t border-line-soft`}>
            No disruptions found for this filter
          </p>
        ) : (
          filtered.map((event, index) => {
            const config = severityConfig[event.severity]
            const showHighRelevance = event.isProfileMatch
            const showMediumRelevance = !event.isProfileMatch && event.relevanceScore >= 20

            const isExpanded = expandedEventId === event.url
            const toggle = () => setExpandedEventId(isExpanded ? null : event.url)

            const hasGoodUrl = !!(
              event.url &&
              !event.url.includes("example.com") &&
              event.url.startsWith("http")
            )
            const linkUrl = hasGoodUrl
              ? event.url
              : buildFallbackSearchUrl(event.title, event.sourceDomain ?? "")

            return (
              <article
                key={event.id}
                className="py-3.5 border-t border-line-soft cursor-pointer hover:bg-surface -mx-2 px-2 rounded-lg transition-colors"
                style={{
                  animationName: "cardEntrance",
                  animationDuration: "0.3s",
                  animationFillMode: "both",
                  animationDelay: `${index * 0.05}s`,
                }}
                onClick={toggle}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${ui.chip} ${config.badgeClass}`}>{config.label}</span>
                      <span className="text-xs text-ink-3">
                        {event.category} · {event.sourceDomain} · {formatDate(event.date)}
                      </span>
                    </div>
                    <p className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">
                      {event.title}
                    </p>
                    {(showHighRelevance || showMediumRelevance) && (
                      <p className="text-[13px] text-ink-2">
                        {showHighRelevance && (
                          <span className="text-xs font-semibold text-ember">High relevance</span>
                        )}
                        {showMediumRelevance && (
                          <span className="text-xs text-ink-3">Medium relevance</span>
                        )}
                        {event.isProfileMatch && <> · {event.relevanceReason}</>}
                      </p>
                    )}
                  </div>
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    title={hasGoodUrl
                      ? "Read the original article"
                      : "Search for this article on Google News"
                    }
                    className="text-[13px] text-ember hover:text-ember-deep flex-shrink-0 transition-colors"
                  >
                    {hasGoodUrl ? "Read →" : "Search →"}
                  </a>
                </div>
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  onClick={e => {
                    e.stopPropagation()
                    toggle()
                  }}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs text-ink-3 transition-colors hover:text-ink"
                >
                  <Chevron open={isExpanded} />
                  {isExpanded ? "Hide brief" : "Why this matters"}
                </button>
                {isExpanded && (
                  <EventBriefPanel
                    event={event}
                    profile={profile}
                    cachedBrief={briefCache[event.url] ?? null}
                    onBriefLoaded={(brief) =>
                      setBriefCache((prev) => ({ ...prev, [event.url]: brief }))
                    }
                  />
                )}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
