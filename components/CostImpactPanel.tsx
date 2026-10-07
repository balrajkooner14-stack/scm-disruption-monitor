"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { Supplier } from "@/lib/profile"
import type { CostEstimateResponse } from "@/app/api/cost-estimate/route"
import { ui } from "@/lib/ui"

interface CostImpactPanelProps {
  event: ScoredEvent
  supplier: Supplier
  isVisible: boolean
}

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toLocaleString()}`
}

export default function CostImpactPanel({
  event,
  supplier,
  isVisible,
}: CostImpactPanelProps) {
  const { profile } = useCompanyProfile()
  const [data, setData] = useState<CostEstimateResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)
  const [error, setError] = useState(false)

  const fetchEstimate = async () => {
    if (hasFetched || !profile) return
    setHasFetched(true)
    setIsLoading(true)
    try {
      const res = await fetch("/api/cost-estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, event, supplier }),
      })
      if (!res.ok) throw new Error("Failed")
      const result: CostEstimateResponse = await res.json()
      setData(result)
    } catch {
      setError(true)
    } finally {
      setIsLoading(false)
    }
  }

  // Lazy fetch — triggers once on first open
  if (isVisible && !hasFetched) {
    fetchEstimate()
  }

  if (!isVisible) return null

  if (isLoading) {
    return (
      <div className={`${ui.cardInner} space-y-3`} aria-busy="true">
        <p className={ui.meta}>Calculating financial impact…</p>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className={`${ui.skeleton} h-16`} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={ui.cardInner}>
        <p className={ui.emptyText}>
          Cost estimate unavailable. Check the full event brief for details.
        </p>
      </div>
    )
  }

  const { estimate } = data
  const isNetPositive = estimate.netRiskReduction > 0

  return (
    <div className={`${ui.cardInner} space-y-4`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={ui.eyebrow}>Financial impact estimate</p>
        <div className="flex items-center gap-2">
          <span className={`${ui.chip} ${ui.chipNeutral}`}>
            {estimate.confidenceLevel.toUpperCase()} CONFIDENCE
          </span>
          <span className={ui.meta}>~{estimate.estimatedDurationDays} d disruption</span>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 divide-x divide-line-soft">
        <div className="pr-4 space-y-1">
          <p className={ui.meta}>Revenue at risk</p>
          <p className="font-serif text-2xl text-ember">{formatCurrency(estimate.revenueAtRiskLow)}</p>
          <p className="text-xs text-ink-3">up to {formatCurrency(estimate.revenueAtRiskHigh)}</p>
        </div>
        <div className="px-4 space-y-1">
          <p className={ui.meta}>Mitigation cost</p>
          <p className="font-serif text-2xl text-ink">{formatCurrency(estimate.mitigationCost)}</p>
          <p className="text-xs leading-snug text-ink-3">{estimate.mitigationAction}</p>
        </div>
        <div className="pl-4 space-y-1">
          <p className={ui.meta}>Net risk reduction</p>
          <p className={`font-serif text-2xl ${isNetPositive ? "text-moss" : "text-ink-3"}`}>
            {isNetPositive ? formatCurrency(estimate.netRiskReduction) : "Marginal"}
          </p>
          <p className="text-xs text-ink-3">
            {isNetPositive ? "if you act now" : "evaluate alternatives"}
          </p>
        </div>
      </div>

      {/* Urgency bar */}
      <div className="flex items-center gap-3">
        <span className={`${ui.meta} flex-shrink-0`}>Act within</span>
        <div className="flex-1 h-1.5 bg-paper-sunk rounded-full overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-ember"
            style={{
              width: `${Math.max(10, 100 - (estimate.urgencyDays / 14) * 100)}%`,
            }}
          />
        </div>
        <span className="text-[13px] font-semibold text-ink flex-shrink-0">
          {estimate.urgencyDays} day{estimate.urgencyDays !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Assumptions */}
      <p className="text-xs leading-relaxed text-ink-3">
        <span className="font-semibold">Assumptions: </span>
        {estimate.assumptions}
      </p>

      <p className="text-xs text-ink-3">
        Estimate based on {profile?.revenueRange} revenue range ·{" "}
        {supplier.sharePercent}% supply from {supplier.name} · Google Gemini 2.5 Flash · verify before acting
      </p>
    </div>
  )
}
