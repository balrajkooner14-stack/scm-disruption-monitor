"use client"

import { isDemoMode } from "@/lib/demoMode"
import { useMemo, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import {
  calculateInventoryRisk,
  getDaysSinceDate,
  getInventoryBarColor,
  calculateOrderRecommendation,
  ProductRisk,
  RiskLevel,
} from "@/lib/inventoryRisk"
import Link from "next/link"
import TariffRateBadge from "@/components/TariffRateBadge"
import { RawMaterial, Supplier } from "@/lib/profile"
import { findSinglePointsOfFailure } from "@/lib/supplyChainGraph"
import { ui } from "@/lib/ui"

interface InventoryRiskPanelProps {
  events: ScoredEvent[]
}

// Status chip per card. critical always reads "ORDER TODAY"; warning
// products follow their recommendation's urgency. Mapping only — risk levels
// and urgency are computed in lib/inventoryRisk.ts, unchanged.
function statusChip(product: ProductRisk): { label: string; className: string } {
  if (product.riskLevel === "critical") return { label: "ORDER TODAY", className: ui.chipCritical }
  if (product.riskLevel === "safe") return { label: "HEALTHY", className: ui.chipPositive }
  if (product.riskLevel === "unknown") return { label: "UNKNOWN", className: ui.chipNeutral }
  const rec = calculateOrderRecommendation(product)
  if (rec?.urgencyLabel === "Order Today") return { label: "ORDER TODAY", className: ui.chipCritical }
  if (rec?.urgencyLabel === "Plan Ahead") return { label: "PLAN AHEAD", className: ui.chipMonitor }
  return { label: "THIS WEEK", className: ui.chipWarning }
}

const DAYS_CLASS: Record<RiskLevel, string> = {
  critical: "text-ember",
  warning: "text-ochre",
  safe: "text-ink",
  unknown: "text-ink",
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

  const spofResults = useMemo(() => (profile ? findSinglePointsOfFailure(profile) : []), [profile])

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
        // Sample-company mode writes nothing (spec 4.7).
        if (!isDemoMode()) localStorage.setItem("scm_inventory_log", JSON.stringify(trimmed))
      }
    } catch {
      // Silently fail — logging is non-critical
    }
  }, [snapshot?.criticalCount])

  if (isLoaded && !profile) return null
  if (!isLoaded || !snapshot) return null

  if (snapshot.products.length === 0) {
    return (
      <section className={ui.card}>
        <h2 className={ui.h2}>Inventory risk</h2>
        <p className={`${ui.emptyText} mt-2`}>
          No product lines configured —{" "}
          <Link href="/profile" className="text-ember hover:text-ember-deep">
            add them in your profile
          </Link>
        </p>
      </section>
    )
  }

  const criticalProducts = snapshot.products.filter(p => p.riskLevel === "critical")
  const reorderDetail = criticalProducts
    .map(p => {
      const rec = calculateOrderRecommendation(p)
      return rec ? `${p.productName} ${rec.recommendedOrderQty} d` : p.productName
    })
    .join(" · ")
  const compoundingDisruption = criticalProducts.some(p => p.hasActiveDisruption)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className={ui.h2}>Inventory risk</h2>
        <p className={ui.meta}>
          Profile inventory last updated{" "}
          {daysSinceUpdate === 0 ? "today" : `${daysSinceUpdate} day${daysSinceUpdate === 1 ? "" : "s"} ago`}
          {" · "}
          <Link href="/profile" className="text-ember hover:text-ember-deep">
            update levels
          </Link>
        </p>
      </div>

      {criticalProducts.length > 0 && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 rounded-xl border border-ember-line bg-ember-tint px-5 py-4">
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold text-[#6E2A10]">
              {criticalProducts.length} product{criticalProducts.length > 1 ? "s" : ""} need{criticalProducts.length > 1 ? "" : "s"} a reorder today
            </p>
            <p className="text-sm text-[#6E2A10]">
              {reorderDetail} of supply
              {compoundingDisruption && " · active disruption in a supplier region compounds the risk"}
            </p>
          </div>
          <Link href="/profile" className={`${ui.btnAccent} flex-shrink-0 self-start md:self-center`}>
            Update inventory
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {snapshot.products
          .slice()
          .sort((a, b) => {
            const order: Record<RiskLevel, number> = { critical: 0, warning: 1, safe: 2, unknown: 3 }
            return order[a.riskLevel] - order[b.riskLevel]
          })
          .map(product => (
            <ProductRiskCard
              key={product.productId}
              product={product}
              rawMaterials={profile?.productLines.find(p => p.id === product.productId)?.rawMaterials ?? []}
              suppliers={profile?.suppliers ?? []}
              spof={spofResults.find(s => s.productLineId === product.productId)}
            />
          ))}
      </div>

      <p className={ui.meta}>
        Based on inventory levels in your profile ·{" "}
        <Link href="/profile" className="text-ember hover:text-ember-deep">
          Update inventory levels
        </Link>
      </p>
    </section>
  )
}

function ProductRiskCard({
  product,
  rawMaterials,
  suppliers,
  spof,
}: {
  product: ProductRisk
  rawMaterials: RawMaterial[]
  suppliers: Supplier[]
  spof?: { isSinglePointOfFailure: boolean; reasons: string[] }
}) {
  const chip = statusChip(product)
  const barColor = getInventoryBarColor(product.riskLevel)
  const recommendation = calculateOrderRecommendation(product)

  // Single-point-of-failure reasons become plain lines (the boxed badge is gone).
  const spofLines = spof?.isSinglePointOfFailure
    ? spof.reasons.map(r =>
        r.startsWith("No backup supplier")
          ? "No backup supplier (single point of failure)"
          : `${r} (single point of failure)`,
      )
    : []

  return (
    <article className="bg-paper-raised border border-line rounded-xl p-5 flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-ink leading-snug">{product.productName}</h3>
        <span className={`${ui.chip} ${chip.className} flex-shrink-0`}>{chip.label}</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={`font-serif text-[44px] leading-none ${DAYS_CLASS[product.riskLevel]}`}>
          {product.daysRemaining}
        </span>
        <span className="text-sm text-ink-2">days of cover left</span>
      </div>

      <div className="h-1.5 rounded-full bg-paper-sunk overflow-hidden">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${product.progressPercent}%`, backgroundColor: barColor }}
        />
      </div>

      <div className={`flex items-center justify-between ${ui.meta}`}>
        <span>Reorder at {product.reorderPointDays} d</span>
        <span>Lead time {product.primaryLeadTimeDays} d</span>
      </div>

      {recommendation && (
        <div className={`${ui.cardInner} flex flex-col gap-1`}>
          <p className="text-xs text-ink-3">Recommended order</p>
          <p className="font-serif text-2xl text-ink">{recommendation.recommendedOrderQty} days of supply</p>
          <p className="text-xs leading-relaxed text-ink-3">{recommendation.rationale}</p>
        </div>
      )}

      <div className="text-[13px] leading-relaxed text-ink-2">
        {product.primarySupplier && product.supplierAssigned && (
          <p>{product.primarySupplier.name} · {product.primarySupplier.country}</p>
        )}
        {product.hasActiveDisruption && (
          <p className="text-ember">Active disruption in {product.primarySupplier?.region}</p>
        )}
        {product.hasActiveDisruption && product.backupSupplier && (
          <p>✓ Backup available: {product.backupSupplier.name} ({product.backupSupplier.leadTimeDays} d lead time)</p>
        )}
        {spofLines.map(line => <p key={line}>{line}</p>)}
      </div>

      <div className="space-y-1 text-xs text-ink-3">
        <p className="leading-relaxed">{product.riskReason}</p>
        {product.primarySupplier && !product.supplierAssigned && (
          <p className="text-ochre leading-relaxed">
            Defaulting to {product.primarySupplier.name} ({product.primarySupplier.country}) — assign a specific supplier in your profile for accuracy
          </p>
        )}
        {product.hsCode && <TariffRateBadge hsCode={product.hsCode} />}
        {rawMaterials.length > 0 && (
          <div className="pt-1">
            <p>Raw materials ({rawMaterials.length})</p>
            {rawMaterials.map(m => {
              const vendor = suppliers.find(s => s.id === m.primaryVendorId)
              return (
                <p key={m.id} className="leading-relaxed">
                  {m.name || "Unnamed material"}
                  {vendor && ` — ${vendor.name}`}
                  {m.leadTimeDays != null && ` (${m.leadTimeDays} d lead time)`}
                </p>
              )
            })}
          </div>
        )}
      </div>
    </article>
  )
}
