"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useSupplierHealth } from "@/hooks/useSupplierHealth"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { AdvisorResponse, Recommendation } from "@/app/api/advisor/route"
import type { BriefData } from "@/lib/generateBrief"
import CostImpactPanel from "@/components/CostImpactPanel"
import { ui } from "@/lib/ui"

interface AIAdvisorProps {
  events: ScoredEvent[]
  onRecsLoaded?: (recs: BriefData["recommendations"]) => void
}

// App-wide severity system: CRITICAL → critical, HIGH → warning,
// MEDIUM → monitor (label stays "MONITOR").
const PRIORITY_CONFIG: Record<Recommendation["priority"], { chip: string; label: string }> = {
  CRITICAL: { chip: ui.chipCritical, label: "CRITICAL" },
  HIGH: { chip: ui.chipWarning, label: "HIGH" },
  MEDIUM: { chip: ui.chipMonitor, label: "MONITOR" },
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
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

export default function AIAdvisor({ events, onRecsLoaded }: AIAdvisorProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const { scores: healthScores, isLoaded: healthLoaded } = useSupplierHealth(
    profile?.suppliers ?? []
  )
  const [advisorData, setAdvisorData] = useState<AdvisorResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [costPanelOpenId, setCostPanelOpenId] = useState<string | null>(null)

  const fetchRecommendations = async () => {
    if (!profile) return
    setIsLoading(true)
    setError(null)
    try {
      const healthSummary = healthScores
        .filter(s => s.hasData)
        .map(
          s =>
            `${s.supplierName}: ${s.compositeScore}/100 (${s.grade}) — ` +
            `On-time: ${s.onTimeDeliveryRate}%, Quality: ${s.qualityScore}%, ` +
            `Last delay: ${s.lastShipmentDelayDays} days`
        )
        .join("\n")

      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          events,
          healthSummary: healthSummary || "No supplier performance data logged yet.",
        }),
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
          affectedSuppliers: r.affectedSuppliers,
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
    if (!profile || !isLoaded || !healthLoaded || events.length === 0) return
    fetchRecommendations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.updatedAt, events.length, isLoaded, healthLoaded])

  // No profile state
  if (isLoaded && !profile) {
    return (
      <section className={`${ui.card} space-y-3`}>
        <p className={ui.eyebrow}>AI advisor</p>
        <h1 className={ui.h1}>Recommendations</h1>
        <p className={ui.body}>
          Set up your company profile to get recommendations specific to your supply chain,
          not generic global news.
        </p>
        <Link href="/profile" className={ui.btnAccent}>
          Set up your profile
        </Link>
      </section>
    )
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <section className="space-y-4" aria-busy="true">
        <p className={ui.eyebrow}>AI advisor</p>
        <p className={ui.meta}>Analyzing your supply chain…</p>
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-surface border border-line rounded-xl p-6 space-y-3">
            <div className={`${ui.skeleton} h-3 w-1/4`} />
            <div className={`${ui.skeleton} h-6 w-3/4`} />
            <div className={`${ui.skeleton} h-3 w-full`} />
            <div className={`${ui.skeleton} h-3 w-5/6`} />
          </div>
        ))}
      </section>
    )
  }

  // Error state
  if (error) {
    return (
      <section className={`${ui.card} space-y-3`}>
        <p className={ui.eyebrow}>AI advisor</p>
        <p className={ui.errorBox}>{error}</p>
        <button onClick={fetchRecommendations} className={ui.btnSecondary}>
          Try again
        </button>
      </section>
    )
  }

  // Not yet loaded (profile loading, no data yet)
  if (!advisorData) return null

  const count = advisorData.recommendations.length

  return (
    <section className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className={ui.eyebrow}>
            AI advisor · {advisorData.highRelevanceCount} of {advisorData.totalEventsAnalyzed} events relevant
          </p>
          <h1 className={ui.h1}>
            {count} recommendation{count === 1 ? "" : "s"} for {advisorData.profileName}
          </h1>
        </div>
        <button onClick={fetchRecommendations} className={ui.btnSecondary}>
          Refresh
        </button>
      </div>

      {advisorData.isStale && (
        <p className={`${ui.meta} flex items-center gap-2`}>
          <span className={`${ui.chip} ${ui.chipWarning}`}>CACHED</span>
          Showing recent analysis — refreshing when quota resets
        </p>
      )}

      {count === 0 && (
        <p className={`${ui.card} ${ui.emptyText}`}>
          No recommendations right now — nothing in today&apos;s events needs action for your network.
        </p>
      )}

      {/* Recommendations */}
      {advisorData.recommendations.map(rec => {
        const config = PRIORITY_CONFIG[rec.priority]
        const isExpanded = expandedId === rec.id

        return (
          <article key={rec.id} className="bg-surface border border-line rounded-xl p-6 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`${ui.chip} ${config.chip}`}>{config.label}</span>
                <span className={ui.meta}>{rec.timeframe}</span>
              </div>
              <button
                onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Collapse recommendation" : "Expand recommendation"}
                className="rounded-lg p-1.5 text-ink-3 transition-colors hover:text-ink flex-shrink-0"
              >
                <Chevron open={isExpanded} />
              </button>
            </div>

            <h2 className={ui.h2}>{rec.title}</h2>
            <p className={`${ui.body} ${isExpanded ? "" : "line-clamp-2"}`}>{rec.problem}</p>

            {isExpanded && (
              <div className={`${ui.divider} pt-3 space-y-4`}>
                <div className="space-y-1">
                  <p className={ui.eyebrow}>Recommended action</p>
                  <p className="text-[15px] leading-relaxed text-ink">{rec.action}</p>
                </div>
                <div className="space-y-1">
                  <p className={ui.eyebrow}>If you don&apos;t act</p>
                  <p className={ui.body}>{rec.impact}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2 flex-wrap">
                    {rec.affectedSuppliers.map(s => (
                      <span key={s} className={`${ui.chip} ${ui.chipNeutral}`}>{s}</span>
                    ))}
                  </div>
                  <span className={ui.meta}>Confidence: {rec.confidenceLevel}</span>
                </div>
                {rec.relatedEventTitles.length > 0 && (
                  <p className="text-xs text-ink-3">Based on: {rec.relatedEventTitles[0]}</p>
                )}

                {(() => {
                  if (!profile) return null
                  const affectedSupplier =
                    profile.suppliers.find(s =>
                      rec.affectedSuppliers.some(
                        name =>
                          name.toLowerCase().includes(s.name.toLowerCase()) ||
                          s.name.toLowerCase().includes(name.toLowerCase())
                      )
                    ) ?? profile.suppliers[0]

                  const relevantEvent =
                    events.find(e =>
                      rec.relatedEventTitles.some(title =>
                        title
                          .toLowerCase()
                          .includes(e.title.toLowerCase().slice(0, 30))
                      )
                    ) ?? events[0]

                  if (!affectedSupplier || !relevantEvent) return null

                  const isPanelOpen = costPanelOpenId === rec.id

                  return (
                    <div className="space-y-3">
                      <button
                        onClick={() => setCostPanelOpenId(isPanelOpen ? null : rec.id)}
                        aria-expanded={isPanelOpen}
                        className={ui.btnPrimary}
                      >
                        {isPanelOpen ? "Hide cost estimate" : "View cost estimate"}
                      </button>

                      <CostImpactPanel
                        event={relevantEvent}
                        supplier={affectedSupplier}
                        isVisible={isPanelOpen}
                      />
                    </div>
                  )
                })()}
              </div>
            )}
          </article>
        )
      })}

      {/* Footer */}
      {lastFetched && (
        <p className="text-xs text-ink-3">
          Generated {lastFetched.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · Google Gemini 2.5 Flash · AI-assisted, verify before acting
        </p>
      )}
    </section>
  )
}
