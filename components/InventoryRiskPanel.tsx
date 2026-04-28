"use client"

import { useMemo, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import {
  calculateInventoryRisk,
  getDaysSinceDate,
  getInventoryBarColor,
  ProductRisk,
  RiskLevel,
} from "@/lib/inventoryRisk"
import Link from "next/link"

interface InventoryRiskPanelProps {
  events: ScoredEvent[]
}

const RISK_CONFIG: Record<RiskLevel, {
  label: string
  bg: string
  border: string
  badge: string
  text: string
  icon: string
}> = {
  critical: {
    label: "Reorder Now",
    bg: "bg-red-950",
    border: "border-red-700",
    badge: "bg-red-600 text-white",
    text: "text-red-400",
    icon: "!",
  },
  warning: {
    label: "Monitor",
    bg: "bg-amber-950",
    border: "border-amber-700",
    badge: "bg-amber-600 text-white",
    text: "text-amber-400",
    icon: "~",
  },
  safe: {
    label: "Adequate",
    bg: "bg-slate-800",
    border: "border-slate-700",
    badge: "bg-slate-600 text-slate-200",
    text: "text-green-400",
    icon: "✓",
  },
  unknown: {
    label: "Unknown",
    bg: "bg-slate-800",
    border: "border-slate-700",
    badge: "bg-slate-700 text-slate-300",
    text: "text-slate-400",
    icon: "?",
  },
}

export default function InventoryRiskPanel({ events }: InventoryRiskPanelProps) {
  const { profile, isLoaded } = useCompanyProfile()

  const hasDisruptionByRegion = useMemo(() => {
    const map: Record<string, boolean> = {}
    events
      .filter(e => e.severity >= 2)
      .forEach(e => {
        if (e.region) map[e.region] = true
      })
    return map
  }, [events])

  const daysSinceUpdate = useMemo(() => {
    if (!profile?.updatedAt) return 0
    return getDaysSinceDate(profile.updatedAt)
  }, [profile?.updatedAt])

  const snapshot = useMemo(() => {
    if (!profile) return null
    return calculateInventoryRisk(profile, hasDisruptionByRegion, daysSinceUpdate)
  }, [profile, hasDisruptionByRegion, daysSinceUpdate])

  useEffect(() => {
    if (!snapshot || snapshot.criticalCount === 0) return
    try {
      const existing = JSON.parse(
        localStorage.getItem("scm_inventory_log") ?? "[]"
      )
      const entry = {
        timestamp: new Date().toISOString(),
        criticalProducts: snapshot.products
          .filter(p => p.riskLevel === "critical")
          .map(p => p.productName),
        snapshot: snapshot.products.map(p => ({
          name: p.productName,
          daysRemaining: p.daysRemaining,
          riskLevel: p.riskLevel,
        })),
      }
      const lastEntry = existing[existing.length - 1]
      const oneHourAgo = Date.now() - 1000 * 60 * 60
      if (
        !lastEntry ||
        new Date(lastEntry.timestamp).getTime() < oneHourAgo
      ) {
        existing.push(entry)
        const ninetyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 90
        const trimmed = existing.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (e: any) => new Date(e.timestamp).getTime() > ninetyDaysAgo
        )
        localStorage.setItem("scm_inventory_log", JSON.stringify(trimmed))
      }
    } catch {
      // Silently fail — logging is non-critical
    }
  }, [snapshot?.criticalCount])

  if (isLoaded && !profile) return null
  if (!isLoaded || !snapshot) return null

  if (snapshot.products.length === 0) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-sm">📦</span>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Inventory Risk
          </h2>
          <span className="text-xs text-slate-500 ml-2">
            No product lines configured —{" "}
            <Link href="/profile" className="text-blue-400 hover:text-blue-300">
              add them in your profile
            </Link>
          </span>
        </div>
      </div>
    )
  }

  const hasCritical = snapshot.criticalCount > 0
  const hasWarning = snapshot.warningCount > 0

  return (
    <div className="mb-6">
      {hasCritical && (
        <div className="bg-red-950 border border-red-700 rounded-xl px-4 py-3 mb-3 flex items-start gap-3">
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center mt-0.5">
            <span className="text-white text-xs font-bold">!</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-300">
              {snapshot.criticalCount} product{snapshot.criticalCount > 1 ? "s" : ""} require immediate reorder
            </p>
            <p className="text-xs text-red-400 mt-0.5">
              {snapshot.products
                .filter(p => p.riskLevel === "critical")
                .map(p => p.productName)
                .join(", ")}{" "}
              {snapshot.products.find(p => p.riskLevel === "critical")?.hasActiveDisruption &&
                "— active disruption in supplier region compounds risk"}
            </p>
          </div>
          <Link
            href="/profile"
            className="text-xs text-red-400 hover:text-red-300 border border-red-700 rounded px-2 py-1 flex-shrink-0 transition-colors"
          >
            Update inventory
          </Link>
        </div>
      )}

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">📦</span>
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Inventory Risk
            </h2>
            {daysSinceUpdate > 0 && (
              <span className="text-xs text-slate-600 ml-1">
                (profile updated {daysSinceUpdate}d ago — update inventory levels for accuracy)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            {hasCritical && (
              <span className="text-red-400 font-medium">
                {snapshot.criticalCount} critical
              </span>
            )}
            {hasWarning && (
              <span className="text-amber-400 font-medium">
                {snapshot.warningCount} warning
              </span>
            )}
            {!hasCritical && !hasWarning && (
              <span className="text-green-400 font-medium">All adequate</span>
            )}
          </div>
        </div>

        <div className={`grid gap-3 ${
          snapshot.products.length === 1
            ? "grid-cols-1"
            : snapshot.products.length === 2
            ? "grid-cols-1 sm:grid-cols-2"
            : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        }`}>
          {snapshot.products
            .slice()
            .sort((a, b) => {
              const order: Record<RiskLevel, number> = { critical: 0, warning: 1, safe: 2, unknown: 3 }
              return order[a.riskLevel] - order[b.riskLevel]
            })
            .map(product => (
              <ProductRiskCard key={product.productId} product={product} />
            ))}
        </div>

        <p className="text-xs text-slate-600 mt-3">
          Based on inventory levels in your profile ·{" "}
          <Link href="/profile" className="text-slate-500 hover:text-slate-400">
            Update inventory levels
          </Link>
        </p>
      </div>
    </div>
  )
}

function ProductRiskCard({ product }: { product: ProductRisk }) {
  const config = RISK_CONFIG[product.riskLevel]
  const barColor = getInventoryBarColor(product.riskLevel)

  return (
    <div className={`${config.bg} border ${config.border} rounded-lg p-3`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-medium text-slate-100 leading-tight">
          {product.productName}
        </p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badge}`}>
          {config.label}
        </span>
      </div>

      <div className="flex items-baseline gap-1 mb-2">
        <span className={`text-2xl font-black ${config.text}`}>
          {product.daysRemaining}
        </span>
        <span className="text-xs text-slate-500">days remaining</span>
      </div>

      <div className="h-2 bg-slate-700 rounded-full mb-2 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{
            width: `${product.progressPercent}%`,
            backgroundColor: barColor,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
        <span>Reorder at {product.reorderPointDays}d</span>
        <span>Lead time: {product.primaryLeadTimeDays}d</span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed">
        {product.riskReason}
      </p>

      {product.hasActiveDisruption && (
        <div className="mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <span className="text-xs text-red-400">
            Active disruption in {product.primarySupplier?.region}
          </span>
        </div>
      )}

      {product.primarySupplier && (
        <p className="text-xs text-slate-600 mt-1">
          Primary: {product.primarySupplier.name} ({product.primarySupplier.country})
        </p>
      )}
    </div>
  )
}
