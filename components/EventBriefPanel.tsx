"use client"

import { useState, useEffect } from "react"
import { ScoredEvent } from "@/lib/scoreEvents"
import { CompanyProfile } from "@/lib/profile"
import type { EventBriefResponse } from "@/app/api/event-brief/route"

interface EventBriefPanelProps {
  event: ScoredEvent
  profile: CompanyProfile | null
  cachedBrief: EventBriefResponse | null
  onBriefLoaded: (brief: EventBriefResponse) => void
}

const IMPACT_CONFIG = {
  High: {
    color: "text-red-400",
    bg: "bg-red-950 border-red-800",
    dot: "bg-red-500",
  },
  Medium: {
    color: "text-amber-400",
    bg: "bg-amber-950 border-amber-800",
    dot: "bg-amber-500",
  },
  Low: {
    color: "text-green-400",
    bg: "bg-green-950 border-green-800",
    dot: "bg-green-500",
  },
  Unknown: {
    color: "text-slate-400",
    bg: "bg-slate-800 border-slate-700",
    dot: "bg-slate-500",
  },
}

export default function EventBriefPanel({
  event,
  profile,
  cachedBrief,
  onBriefLoaded,
}: EventBriefPanelProps) {
  const [isLoading, setIsLoading] = useState(!cachedBrief)
  const [brief, setBrief] = useState<EventBriefResponse | null>(cachedBrief)

  useEffect(() => {
    if (cachedBrief) return

    async function fetchBrief() {
      try {
        const res = await fetch("/api/event-brief", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, profile }),
        })
        const data: EventBriefResponse = await res.json()
        setBrief(data)
        onBriefLoaded(data)
      } catch {
        const fallback: EventBriefResponse = {
          brief: "Unable to generate brief. Please check the source article.",
          impact: "Unknown",
          recommendation: "Read the full article for details.",
        }
        setBrief(fallback)
        onBriefLoaded(fallback)
      } finally {
        setIsLoading(false)
      }
    }

    fetchBrief()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const impactKey = (brief?.impact ?? "Unknown") as keyof typeof IMPACT_CONFIG
  const impactConfig = IMPACT_CONFIG[impactKey] ?? IMPACT_CONFIG.Unknown

  if (isLoading) {
    return (
      <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700 rounded-lg animate-pulse">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-blue-400">🤖 Analyzing disruption impact...</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2.5 bg-slate-700 rounded w-full" />
          <div className="h-2.5 bg-slate-700 rounded w-5/6" />
          <div className="h-2.5 bg-slate-700 rounded w-4/6" />
        </div>
      </div>
    )
  }

  if (!brief) return null

  return (
    <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700 rounded-lg space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs">🤖</span>
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          AI Supply Chain Brief
        </span>
        <span
          className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full border ${impactConfig.bg} ${impactConfig.color}`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${impactConfig.dot} mr-1 align-middle`}
          />
          {brief.impact} Impact
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">{brief.brief}</p>

      <div className="flex items-start gap-2 pt-1 border-t border-slate-700/50">
        <span className="text-xs flex-shrink-0">💡</span>
        <p className="text-xs text-blue-300 leading-relaxed">{brief.recommendation}</p>
      </div>

      <p className="text-xs text-slate-600 text-right">Powered by Gemini 2.5 Flash</p>
    </div>
  )
}
