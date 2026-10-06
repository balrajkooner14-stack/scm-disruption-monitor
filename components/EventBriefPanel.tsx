"use client"

import { useState, useEffect } from "react"
import { ScoredEvent } from "@/lib/scoreEvents"
import { CompanyProfile } from "@/lib/profile"
import type { EventBriefResponse } from "@/app/api/event-brief/route"
import { ui } from "@/lib/ui"

interface EventBriefPanelProps {
  event: ScoredEvent
  profile: CompanyProfile | null
  cachedBrief: EventBriefResponse | null
  onBriefLoaded: (brief: EventBriefResponse) => void
}

// Impact chip follows the app-wide severity system (High → critical,
// Medium → warning, Low → monitor).
const IMPACT_CONFIG = {
  High: ui.chipCritical,
  Medium: ui.chipWarning,
  Low: ui.chipMonitor,
  Unknown: ui.chipNeutral,
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
  const impactChip = IMPACT_CONFIG[impactKey] ?? IMPACT_CONFIG.Unknown

  if (isLoading) {
    return (
      <div className={`${ui.cardInner} mt-3 space-y-2`}>
        <p className={ui.meta}>Analyzing disruption impact…</p>
        <div className={`${ui.skeleton} h-2.5 w-full`} />
        <div className={`${ui.skeleton} h-2.5 w-5/6`} />
        <div className={`${ui.skeleton} h-2.5 w-4/6`} />
      </div>
    )
  }

  if (!brief) return null

  return (
    <div className={`${ui.cardInner} mt-3 space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className={ui.eyebrow}>Why it matters</span>
        <span className={`${ui.chip} ${impactChip}`}>{brief.impact.toUpperCase()} IMPACT</span>
      </div>

      <p className="text-sm leading-relaxed text-ink-2">{brief.brief}</p>

      <div className={`${ui.divider} pt-3 space-y-1`}>
        <p className={ui.eyebrow}>Recommended action</p>
        <p className="text-sm leading-relaxed text-ink">{brief.recommendation}</p>
      </div>

      <p className="text-xs text-ink-3">Google Gemini 2.5 Flash · verify before acting</p>
    </div>
  )
}
