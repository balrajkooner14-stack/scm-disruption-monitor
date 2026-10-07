"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useAuth } from "@/hooks/useAuth"
import { useSupplierHealth } from "@/hooks/useSupplierHealth"
import { useLeadTimeHistory } from "@/hooks/useLeadTimeHistory"
import { usePerformanceAlerts } from "@/hooks/usePerformanceAlerts"
import { SupplierHealthEntry, SupplierHealthScore } from "@/lib/supplierHealth"
import { PerformanceAlert } from "@/lib/performanceAlerts"
import { calculateLeadTimeDrift } from "@/lib/leadTimeHistory"
import type { ScoredEvent } from "@/lib/scoreEvents"
import { ui } from "@/lib/ui"

// App-wide severity system for grades: Excellent/Good → positive,
// Fair → warning, Poor/Critical → critical.
const GRADE_CHIP: Record<SupplierHealthScore["grade"], string> = {
  Excellent: ui.chipPositive,
  Good: ui.chipPositive,
  Fair: ui.chipWarning,
  Poor: ui.chipCritical,
  Critical: ui.chipCritical,
}

// Metric value colour: good → ink, borderline → ochre, bad → ember.
const tone = (good: boolean, ok: boolean) => (good ? "text-ink" : ok ? "text-ochre" : "text-ember")

interface SupplierHealthScorecardProps {
  events: ScoredEvent[]
}

export default function SupplierHealthScorecard({
  events,
}: SupplierHealthScorecardProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const { user } = useAuth()
  const {
    scores,
    entries: healthEntries,
    saveEntry,
    isLoaded: healthLoaded,
  } = useSupplierHealth(profile?.suppliers ?? [])
  const {
    history: leadTimeHistory,
    recordEntry: recordLeadTime,
    isLoaded: leadTimeLoaded,
  } = useLeadTimeHistory()
  const {
    alerts: perfAlerts,
    checkAndCreate,
    persistAlerts,
    isLoaded: alertsLoaded,
  } = usePerformanceAlerts()
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState({
    onTimeDeliveryRate: 90,
    qualityScore: 90,
    lastShipmentDelayDays: 0,
    notes: "",
  })
  const [savedId, setSavedId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const disruptedRegions = new Set(
    events.filter(e => e.severity >= 2).map(e => e.region)
  )

  if (!isLoaded || !profile) return null
  if (profile.suppliers.length === 0) return null
  if (!healthLoaded || !leadTimeLoaded || !alertsLoaded) return null

  const openEdit = (score: SupplierHealthScore) => {
    setEditingSupplierId(score.supplierId)
    setFormValues({
      onTimeDeliveryRate: score.hasData ? score.onTimeDeliveryRate : 90,
      qualityScore: score.hasData ? score.qualityScore : 90,
      lastShipmentDelayDays: score.hasData ? score.lastShipmentDelayDays : 0,
      notes: score.hasData ? score.notes : "",
    })
  }

  const handleSave = async (supplierId: string, supplierName: string) => {
    if (!profile) return
    setIsSaving(true)

    // Previous entry (before overwrite) so we can detect threshold crossings
    const previousEntry = healthEntries[supplierId]

    const entry: SupplierHealthEntry = {
      supplierId,
      supplierName,
      onTimeDeliveryRate: formValues.onTimeDeliveryRate,
      qualityScore: formValues.qualityScore,
      lastShipmentDelayDays: formValues.lastShipmentDelayDays,
      notes: formValues.notes,
      updatedAt: new Date().toISOString(),
    }
    await saveEntry(entry)

    const supplier = profile.suppliers.find(s => s.id === supplierId)

    // Check OTD and quality thresholds — creates alerts if crossed
    await checkAndCreate(
      supplierId,
      supplierName,
      supplier?.country ?? "",
      previousEntry?.onTimeDeliveryRate ?? null,
      formValues.onTimeDeliveryRate,
      previousEntry?.qualityScore ?? null,
      formValues.qualityScore,
    )

    // Record lead time snapshot and check for significant drift
    if (supplier) {
      const history = await recordLeadTime(supplierId, supplierName, supplier.leadTimeDays)
      const drift = calculateLeadTimeDrift(history)
      const today = new Date().toISOString().split("T")[0]

      if (drift.isSignificant && drift.trend === "increasing") {
        const alertId = `${supplierId}-leadtime-${today}`
        if (!perfAlerts.find(a => a.id === alertId)) {
          const newAlert: PerformanceAlert = {
            id: alertId,
            supplierId,
            supplierName,
            supplierCountry: supplier.country,
            metric: "leadTime",
            previousValue: drift.baselineDays ?? 0,
            currentValue: drift.currentDays ?? 0,
            threshold: 20,
            direction: "below",
            message: `${supplierName} lead time has increased ${drift.driftPercent}% from ${drift.baselineDays} to ${drift.currentDays} days. Update your inventory safety stock to account for this change.`,
            createdAt: new Date().toISOString(),
            dismissed: false,
          }
          await persistAlerts([newAlert])
        }
      }

      // Check if lead time now exceeds inventory on hand for assigned products
      for (const product of profile.productLines) {
        if (
          product.primarySupplierId === supplierId &&
          drift.currentDays !== null &&
          product.inventoryDaysOnHand <= drift.currentDays
        ) {
          const alertId = `${supplierId}-leadtime-inventory-${today}`
          if (!perfAlerts.find(a => a.id === alertId)) {
            const criticalAlert: PerformanceAlert = {
              id: alertId,
              supplierId,
              supplierName,
              supplierCountry: supplier.country,
              metric: "leadTime",
              previousValue: drift.baselineDays ?? 0,
              currentValue: drift.currentDays ?? 0,
              threshold: product.inventoryDaysOnHand,
              direction: "below",
              message: `CRITICAL: ${supplierName} lead time (${drift.currentDays}d) now exceeds ${product.name} inventory (${product.inventoryDaysOnHand}d on hand). You are at immediate stockout risk. Order now.`,
              createdAt: new Date().toISOString(),
              dismissed: false,
            }
            await persistAlerts([criticalAlert])
          }
        }
      }
    }

    setIsSaving(false)
    setEditingSupplierId(null)
    setSavedId(supplierId)
    setTimeout(() => setSavedId(null), 2000)
  }

  const scoredSuppliers = scores.filter(s => s.hasData)
  const avgScore =
    scoredSuppliers.length > 0
      ? Math.round(
          scoredSuppliers.reduce((sum, s) => sum + s.compositeScore, 0) /
            scoredSuppliers.length
        )
      : null

  const lowestScoreSupplier = scoredSuppliers.sort(
    (a, b) => a.compositeScore - b.compositeScore
  )[0]

  const scorePreview = Math.round(
    formValues.onTimeDeliveryRate * 0.5 +
      formValues.qualityScore * 0.35 +
      Math.max(0, 15 - Math.max(0, formValues.lastShipmentDelayDays) * 1.5)
  )

  const compactSecondary = `${ui.btnSecondary} px-2.5 py-1.5 text-[13px]`

  return (
    <section className={ui.card}>
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-2">
        <h2 className={ui.h3}>Supplier health</h2>
        {avgScore !== null && (
          <p className={ui.meta}>
            Network avg{" "}
            <span className={`font-semibold ${tone(avgScore >= 70, avgScore >= 55)}`}>{avgScore}</span>
          </p>
        )}
      </div>
      {lowestScoreSupplier && lowestScoreSupplier.compositeScore < 70 && (
        <p className="text-xs text-ochre mb-2">
          Lowest: {lowestScoreSupplier.supplierName} ({lowestScoreSupplier.compositeScore})
        </p>
      )}

      {/* Supplier rows */}
      <div>
        {scores
          .slice()
          .sort((a, b) => {
            if (!a.hasData && b.hasData) return 1
            if (a.hasData && !b.hasData) return -1
            return a.compositeScore - b.compositeScore
          })
          .map(score => {
            const supplier = profile.suppliers.find(
              s => s.id === score.supplierId
            )
            if (!supplier) return null

            const isDisrupted = disruptedRegions.has(supplier.region)
            const isEditing = editingSupplierId === score.supplierId
            const justSaved = savedId === score.supplierId
            const history = leadTimeHistory[score.supplierId] ?? []
            const drift = calculateLeadTimeDrift(history)

            return (
              <div key={score.supplierId} className="py-3 border-t border-line-soft space-y-2.5">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 bg-surface ${
                        score.hasData ? `${score.gradeBorder} ${score.gradeColor}` : "border-line text-ink-3"
                      }`}
                      aria-label={score.hasData ? `Score ${score.compositeScore} of 100` : "No score yet"}
                    >
                      <span className="text-sm font-semibold tabular-nums">
                        {score.hasData ? score.compositeScore : "?"}
                      </span>
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[15px] font-semibold text-ink">{score.supplierName}</p>
                        {score.hasData && (
                          <span className={`${ui.chip} ${GRADE_CHIP[score.grade]}`}>
                            {score.grade.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-3">
                        {supplier.country} · {supplier.category} · {supplier.sharePercent}%
                      </p>
                      {isDisrupted && <p className="text-xs text-ember">Active disruption</p>}
                      {!score.hasData && <p className="text-xs text-ink-3">No data logged yet</p>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {justSaved && <span className="text-xs text-moss">✓ Saved</span>}
                    {!isEditing && (
                      <button onClick={() => openEdit(score)} className={compactSecondary}>
                        {score.hasData ? "Update" : "Log performance"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Metrics — only if data exists and not editing */}
                {score.hasData && !isEditing && (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">On-time</dt>
                      <dd className={`font-semibold tabular-nums ${tone(score.onTimeDeliveryRate >= 90, score.onTimeDeliveryRate >= 75)}`}>
                        {score.onTimeDeliveryRate}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Quality</dt>
                      <dd className={`font-semibold tabular-nums ${tone(score.qualityScore >= 90, score.qualityScore >= 75)}`}>
                        {score.qualityScore}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Last delay</dt>
                      <dd className={`font-semibold tabular-nums ${tone(score.lastShipmentDelayDays <= 0, score.lastShipmentDelayDays <= 3)}`}>
                        {score.lastShipmentDelayDays <= 0 ? "On time" : `+${score.lastShipmentDelayDays} d`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-ink-3">Lead time</dt>
                      {drift.trend === "insufficient_data" ? (
                        <dd className="tabular-nums text-ink-2">{supplier?.leadTimeDays ?? "—"} d</dd>
                      ) : (
                        <dd className={`font-semibold tabular-nums ${
                          drift.trend === "increasing" && drift.isSignificant
                            ? "text-ember"
                            : drift.trend === "increasing"
                            ? "text-ochre"
                            : drift.trend === "decreasing"
                            ? "text-moss"
                            : "text-ink-2"
                        }`}>
                          {drift.currentDays} d{" "}
                          {drift.trend === "increasing" ? "↑" :
                           drift.trend === "decreasing" ? "↓" : "→"}
                          {drift.driftPercent !== null && Math.abs(drift.driftPercent) >= 5
                            ? ` ${Math.abs(drift.driftPercent)}%`
                            : ""}
                        </dd>
                      )}
                    </div>
                  </dl>
                )}

                {/* Notes */}
                {score.hasData && !isEditing && score.notes && (
                  <p className="text-xs text-ink-3">
                    &ldquo;{score.notes}&rdquo; · Updated {new Date(score.updatedAt).toLocaleDateString()}
                  </p>
                )}

                {/* Combined disruption + low score warning */}
                {score.hasData && isDisrupted && score.compositeScore < 70 && !isEditing && (
                  <p className={ui.errorBox}>
                    Low-scoring supplier in a disrupted region — consider activating backup sourcing immediately
                  </p>
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <div className={`${ui.cardInner} space-y-3`}>
                    <div className="space-y-1">
                      <label htmlFor={`otd-${score.supplierId}`} className={ui.label}>On-time delivery %</label>
                      <input
                        id={`otd-${score.supplierId}`}
                        type="number"
                        min="0"
                        max="100"
                        value={formValues.onTimeDeliveryRate}
                        onChange={e =>
                          setFormValues(v => ({
                            ...v,
                            onTimeDeliveryRate: Math.min(100, Math.max(0, Number(e.target.value))),
                          }))
                        }
                        className={ui.input}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`quality-${score.supplierId}`} className={ui.label}>Quality score %</label>
                      <input
                        id={`quality-${score.supplierId}`}
                        type="number"
                        min="0"
                        max="100"
                        value={formValues.qualityScore}
                        onChange={e =>
                          setFormValues(v => ({
                            ...v,
                            qualityScore: Math.min(100, Math.max(0, Number(e.target.value))),
                          }))
                        }
                        className={ui.input}
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`delay-${score.supplierId}`} className={ui.label}>Last delay (days)</label>
                      <input
                        id={`delay-${score.supplierId}`}
                        type="number"
                        min="-30"
                        max="90"
                        value={formValues.lastShipmentDelayDays}
                        onChange={e =>
                          setFormValues(v => ({ ...v, lastShipmentDelayDays: Number(e.target.value) }))
                        }
                        className={ui.input}
                      />
                      <p className={ui.help}>0 = on time</p>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor={`notes-${score.supplierId}`} className={ui.label}>Notes (optional)</label>
                      <input
                        id={`notes-${score.supplierId}`}
                        type="text"
                        value={formValues.notes}
                        onChange={e => setFormValues(v => ({ ...v, notes: e.target.value }))}
                        placeholder="e.g. Quality issues with last batch"
                        className={ui.input}
                      />
                    </div>

                    <p className={ui.help}>
                      Score preview: <span className="font-semibold text-ink">{scorePreview}/100</span>{" "}
                      (on-time 50% · quality 35% · delay 15%)
                    </p>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSave(score.supplierId, score.supplierName)}
                        disabled={isSaving}
                        className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingSupplierId(null)} className={ui.btnGhost}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <p className="text-xs leading-relaxed text-ink-3 pt-3 border-t border-line-soft">
        {user ? "Performance data synced to your account" : "Performance data stored locally in your browser"}
        {" "}· Scores weighted: on-time delivery 50% · quality 35% · delay penalty 15%
      </p>
    </section>
  )
}
