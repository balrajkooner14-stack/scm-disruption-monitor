"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { Supplier } from "@/lib/profile"
import type { CostEstimateResponse } from "@/app/api/cost-estimate/route"

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
      <div className="mt-3 p-4 bg-slate-900 border border-slate-700 rounded-lg animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-amber-400">
            💰 Calculating financial impact...
          </span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mt-3 p-3 bg-slate-900 border border-slate-700 rounded-lg">
        <p className="text-xs text-slate-500">
          Cost estimate unavailable. Check the full event brief for details.
        </p>
      </div>
    )
  }

  const { estimate } = data
  const isNetPositive = estimate.netRiskReduction > 0

  return (
    <div className="mt-3 p-4 bg-slate-900 border border-amber-900/50 rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">💰</span>
          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Financial Impact Estimate
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {estimate.confidenceLevel} confidence
          <span>· ~{estimate.estimatedDurationDays}d disruption</span>
        </div>
      </div>

      {/* Key metrics — 3 boxes */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {/* Revenue at risk */}
        <div className="bg-red-950 border border-red-800 rounded-lg p-3">
          <p className="text-xs text-red-400 mb-1 font-medium">Revenue at risk</p>
          <p className="text-lg font-black text-red-300">
            {formatCurrency(estimate.revenueAtRiskLow)}
          </p>
          <p className="text-xs text-red-500">
            up to {formatCurrency(estimate.revenueAtRiskHigh)}
          </p>
        </div>

        {/* Mitigation cost */}
        <div className="bg-amber-950 border border-amber-800 rounded-lg p-3">
          <p className="text-xs text-amber-400 mb-1 font-medium">Mitigation cost</p>
          <p className="text-lg font-black text-amber-300">
            {formatCurrency(estimate.mitigationCost)}
          </p>
          <p className="text-xs text-amber-500 leading-tight">
            {estimate.mitigationAction}
          </p>
        </div>

        {/* Net risk reduction */}
        <div
          className={`border rounded-lg p-3 ${
            isNetPositive
              ? "bg-green-950 border-green-800"
              : "bg-slate-800 border-slate-700"
          }`}
        >
          <p
            className={`text-xs mb-1 font-medium ${
              isNetPositive ? "text-green-400" : "text-slate-400"
            }`}
          >
            Net risk reduction
          </p>
          <p
            className={`text-lg font-black ${
              isNetPositive ? "text-green-300" : "text-slate-400"
            }`}
          >
            {isNetPositive ? formatCurrency(estimate.netRiskReduction) : "Marginal"}
          </p>
          <p className={`text-xs ${isNetPositive ? "text-green-500" : "text-slate-500"}`}>
            {isNetPositive ? "if you act now" : "evaluate alternatives"}
          </p>
        </div>
      </div>

      {/* Urgency bar */}
      <div className="flex items-center gap-3 mb-3 bg-slate-800 rounded-lg px-3 py-2">
        <span className="text-xs text-slate-400 flex-shrink-0">Act within:</span>
        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-1.5 rounded-full ${
              estimate.urgencyDays <= 2
                ? "bg-red-500"
                : estimate.urgencyDays <= 7
                ? "bg-amber-500"
                : "bg-green-500"
            }`}
            style={{
              width: `${Math.max(10, 100 - (estimate.urgencyDays / 14) * 100)}%`,
            }}
          />
        </div>
        <span
          className={`text-xs font-bold flex-shrink-0 ${
            estimate.urgencyDays <= 2
              ? "text-red-400"
              : estimate.urgencyDays <= 7
              ? "text-amber-400"
              : "text-green-400"
          }`}
        >
          {estimate.urgencyDays} day{estimate.urgencyDays !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Assumptions */}
      <p className="text-xs text-slate-600 leading-relaxed">
        <span className="text-slate-500">Assumptions: </span>
        {estimate.assumptions}
      </p>

      <p className="text-xs text-slate-700 mt-2">
        Estimate based on {profile?.revenueRange} revenue range ·{" "}
        {supplier.sharePercent}% supply from {supplier.name} · Powered by Gemini
        2.5 Flash
      </p>
    </div>
  )
}
