"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { AdvisorResponse, Recommendation } from "@/app/api/advisor/route"
import type { BriefData } from "@/lib/generateBrief"

interface AIAdvisorProps {
  events: ScoredEvent[]
  onRecsLoaded?: (recs: BriefData["recommendations"]) => void
}

const PRIORITY_CONFIG: Record<
  Recommendation["priority"],
  { bg: string; border: string; badge: string; icon: string; label: string }
> = {
  CRITICAL: {
    bg: "bg-red-950",
    border: "border-red-700",
    badge: "bg-red-600 text-white",
    icon: "🚨",
    label: "CRITICAL",
  },
  HIGH: {
    bg: "bg-amber-950",
    border: "border-amber-700",
    badge: "bg-amber-600 text-white",
    icon: "⚠️",
    label: "HIGH PRIORITY",
  },
  MEDIUM: {
    bg: "bg-slate-800",
    border: "border-slate-600",
    badge: "bg-slate-600 text-slate-200",
    icon: "📋",
    label: "MONITOR",
  },
}

export default function AIAdvisor({ events, onRecsLoaded }: AIAdvisorProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const [advisorData, setAdvisorData] = useState<AdvisorResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchRecommendations = async () => {
    if (!profile) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, events }),
      })
      if (!res.ok) throw new Error("Failed to fetch recommendations")
      const data: AdvisorResponse = await res.json()
      setAdvisorData(data)
      setLastFetched(new Date())
      onRecsLoaded?.(
        data.recommendations.map((r) => ({
          title: r.title,
          priority: r.priority,
          problem: r.problem,
          action: r.action,
          timeframe: r.timeframe,
        })),
      )
    } catch (err) {
      setError("Unable to generate recommendations. Please try again.")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (!profile || !isLoaded || events.length === 0) return
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.updatedAt, events.length, isLoaded])

  // No profile state
  if (isLoaded && !profile) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            AI Advisor
          </h2>
        </div>
        <div className="text-center py-6">
          <p className="text-2xl mb-2">🏭</p>
          <p className="text-slate-300 font-medium mb-1">
            Set up your company profile
          </p>
          <p className="text-slate-500 text-sm mb-4">
            Get AI-powered recommendations specific to your supply chain —
            not generic global news.
          </p>
          <Link
            href="/profile"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white
                       text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Set Up My Profile →
          </Link>
        </div>
      </div>
    )
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            AI Advisor
          </h2>
          <span className="text-xs text-blue-400 animate-pulse ml-2">
            Analyzing your supply chain...
          </span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-slate-700/50 rounded-lg p-4 animate-pulse"
            >
              <div className="h-3 bg-slate-600 rounded w-1/4 mb-2" />
              <div className="h-4 bg-slate-600 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-600 rounded w-full mb-1" />
              <div className="h-3 bg-slate-600 rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="bg-slate-800 border border-red-900 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            AI Advisor
          </h2>
        </div>
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <button
          onClick={fetchRecommendations}
          className="text-sm text-blue-400 hover:text-blue-300 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  // Not yet loaded (profile loading, no data yet)
  if (!advisorData) return null

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            AI Advisor
          </h2>
          <span className="text-xs text-slate-500 ml-1">
            for {advisorData.profileName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {advisorData.highRelevanceCount} of {advisorData.totalEventsAnalyzed} events relevant
          </span>
          <button
            onClick={fetchRecommendations}
            className="text-xs text-slate-400 hover:text-white border border-slate-600
                       hover:border-slate-400 rounded px-2 py-1 transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        {advisorData.recommendations.map(rec => {
          const config = PRIORITY_CONFIG[rec.priority]
          const isExpanded = expandedId === rec.id

          return (
            <div
              key={rec.id}
              className={`${config.bg} border ${config.border} rounded-lg overflow-hidden
                         transition-all duration-200`}
            >
              {/* Collapsed header — always visible */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                className="w-full text-left p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-base flex-shrink-0 mt-0.5">
                      {config.icon}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded
                                      ${config.badge}`}
                        >
                          {config.label}
                        </span>
                        <span className="text-xs text-slate-500">
                          {rec.timeframe}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {rec.title}
                      </p>
                      {!isExpanded && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-1">
                          {rec.problem}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-slate-500 text-xs flex-shrink-0 mt-1">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-700/50 pt-3">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        The Problem
                      </p>
                      <p className="text-sm text-slate-200">{rec.problem}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Recommended Action
                      </p>
                      <p className="text-sm text-slate-200">{rec.action}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        If You Don&apos;t Act
                      </p>
                      <p className="text-sm text-slate-300">{rec.impact}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex gap-2 flex-wrap">
                        {rec.affectedSuppliers.map(s => (
                          <span
                            key={s}
                            className="text-xs bg-slate-700 text-slate-300
                                       border border-slate-600 px-2 py-0.5 rounded-full"
                          >
                            📦 {s}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-slate-500">
                        Confidence: {rec.confidenceLevel}
                      </span>
                    </div>
                    {rec.relatedEventTitles.length > 0 && (
                      <div className="pt-1 border-t border-slate-700/50">
                        <p className="text-xs text-slate-500">
                          Based on: {rec.relatedEventTitles[0]}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      {lastFetched && (
        <p className="text-xs text-slate-600 mt-3 text-right">
          Generated {lastFetched.toLocaleTimeString()} · Powered by Gemini 2.5 Flash
        </p>
      )}
    </div>
  )
}
