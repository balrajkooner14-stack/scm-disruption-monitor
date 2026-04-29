"use client"

import { useState, useEffect, useCallback } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import {
  buildHealthScores,
  saveHealthEntry,
  SupplierHealthScore,
  SupplierHealthEntry,
} from "@/lib/supplierHealth"
import type { ScoredEvent } from "@/lib/scoreEvents"

interface SupplierHealthScorecardProps {
  events: ScoredEvent[]
}

export default function SupplierHealthScorecard({
  events,
}: SupplierHealthScorecardProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const [scores, setScores] = useState<SupplierHealthScore[]>([])
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null)
  const [formValues, setFormValues] = useState({
    onTimeDeliveryRate: 90,
    qualityScore: 90,
    lastShipmentDelayDays: 0,
    notes: "",
  })
  const [savedId, setSavedId] = useState<string | null>(null)

  const refreshScores = useCallback(() => {
    if (!profile) return
    setScores(buildHealthScores(profile.suppliers))
  }, [profile])

  useEffect(() => {
    refreshScores()
  }, [refreshScores])

  const disruptedRegions = new Set(
    events.filter(e => e.severity >= 2).map(e => e.region)
  )

  if (!isLoaded || !profile) return null
  if (profile.suppliers.length === 0) return null

  const openEdit = (score: SupplierHealthScore) => {
    setEditingSupplierId(score.supplierId)
    setFormValues({
      onTimeDeliveryRate: score.hasData ? score.onTimeDeliveryRate : 90,
      qualityScore: score.hasData ? score.qualityScore : 90,
      lastShipmentDelayDays: score.hasData ? score.lastShipmentDelayDays : 0,
      notes: score.hasData ? score.notes : "",
    })
  }

  const handleSave = (supplierId: string, supplierName: string) => {
    const entry: SupplierHealthEntry = {
      supplierId,
      supplierName,
      onTimeDeliveryRate: formValues.onTimeDeliveryRate,
      qualityScore: formValues.qualityScore,
      lastShipmentDelayDays: formValues.lastShipmentDelayDays,
      notes: formValues.notes,
      updatedAt: new Date().toISOString(),
    }
    saveHealthEntry(entry)
    refreshScores()
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

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Supplier Health Scorecard
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {avgScore !== null && (
            <span className="text-slate-400">
              Network avg:{" "}
              <span
                className={`font-bold ${
                  avgScore >= 70
                    ? "text-green-400"
                    : avgScore >= 55
                    ? "text-amber-400"
                    : "text-red-400"
                }`}
              >
                {avgScore}
              </span>
            </span>
          )}
          {lowestScoreSupplier && lowestScoreSupplier.compositeScore < 70 && (
            <span className="text-amber-400">
              ⚠ Lowest: {lowestScoreSupplier.supplierName} (
              {lowestScoreSupplier.compositeScore})
            </span>
          )}
        </div>
      </div>

      {/* Supplier cards */}
      <div className="space-y-3">
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

            return (
              <div
                key={score.supplierId}
                className={`border rounded-lg overflow-hidden ${
                  isDisrupted && score.hasData && score.compositeScore < 70
                    ? "border-red-700 bg-red-950/30"
                    : "border-slate-700 bg-slate-700/30"
                }`}
              >
                {/* Supplier header row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Score circle */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border ${
                        score.hasData
                          ? `${score.gradeBg} ${score.gradeBorder}`
                          : "bg-slate-700 border-slate-600"
                      }`}
                    >
                      <span
                        className={`text-sm font-black ${
                          score.hasData ? score.gradeColor : "text-slate-500"
                        }`}
                      >
                        {score.hasData ? score.compositeScore : "?"}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-slate-100">
                          {score.supplierName}
                        </p>
                        {score.hasData && (
                          <span
                            className={`text-xs font-bold px-2 py-0.5 rounded-full border ${score.gradeBg} ${score.gradeBorder} ${score.gradeColor}`}
                          >
                            {score.grade}
                          </span>
                        )}
                        {!score.hasData && (
                          <span className="text-xs text-slate-500 italic">
                            No data logged yet
                          </span>
                        )}
                        {isDisrupted && (
                          <span className="flex items-center gap-1 text-xs text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Active disruption
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {supplier.country} · {supplier.category} ·{" "}
                        {supplier.sharePercent}% of supply
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {justSaved && (
                      <span className="text-xs text-green-400">✓ Saved</span>
                    )}
                    <button
                      onClick={() =>
                        isEditing ? setEditingSupplierId(null) : openEdit(score)
                      }
                      className="text-xs text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 rounded px-2 py-1 transition-colors"
                    >
                      {isEditing
                        ? "Cancel"
                        : score.hasData
                        ? "Update"
                        : "Log performance"}
                    </button>
                  </div>
                </div>

                {/* Metrics row — only if data exists and not editing */}
                {score.hasData && !isEditing && (
                  <div className="grid grid-cols-3 divide-x divide-slate-700 border-t border-slate-700">
                    <div className="px-4 py-2 text-center">
                      <p className="text-xs text-slate-500 mb-0.5">
                        On-time delivery
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          score.onTimeDeliveryRate >= 90
                            ? "text-green-400"
                            : score.onTimeDeliveryRate >= 75
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {score.onTimeDeliveryRate}%
                      </p>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <p className="text-xs text-slate-500 mb-0.5">
                        Quality score
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          score.qualityScore >= 90
                            ? "text-green-400"
                            : score.qualityScore >= 75
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {score.qualityScore}%
                      </p>
                    </div>
                    <div className="px-4 py-2 text-center">
                      <p className="text-xs text-slate-500 mb-0.5">
                        Last delay
                      </p>
                      <p
                        className={`text-sm font-bold ${
                          score.lastShipmentDelayDays <= 0
                            ? "text-green-400"
                            : score.lastShipmentDelayDays <= 3
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {score.lastShipmentDelayDays <= 0
                          ? "On time"
                          : `+${score.lastShipmentDelayDays}d`}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes row */}
                {score.hasData && !isEditing && score.notes && (
                  <div className="px-4 py-2 border-t border-slate-700">
                    <p className="text-xs text-slate-500 italic">
                      &ldquo;{score.notes}&rdquo;
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Updated {new Date(score.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                )}

                {/* Combined disruption + low score warning */}
                {score.hasData &&
                  isDisrupted &&
                  score.compositeScore < 70 &&
                  !isEditing && (
                    <div className="px-4 py-2 bg-red-950/50 border-t border-red-800">
                      <p className="text-xs text-red-300">
                        ⚠ Low-scoring supplier in a disrupted region — consider
                        activating backup sourcing immediately
                      </p>
                    </div>
                  )}

                {/* Inline edit form */}
                {isEditing && (
                  <div className="border-t border-slate-700 p-4 bg-slate-800/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          On-time delivery %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formValues.onTimeDeliveryRate}
                          onChange={e =>
                            setFormValues(v => ({
                              ...v,
                              onTimeDeliveryRate: Math.min(
                                100,
                                Math.max(0, Number(e.target.value))
                              ),
                            }))
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Quality score %
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formValues.qualityScore}
                          onChange={e =>
                            setFormValues(v => ({
                              ...v,
                              qualityScore: Math.min(
                                100,
                                Math.max(0, Number(e.target.value))
                              ),
                            }))
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                          Last delay (days, 0 = on time)
                        </label>
                        <input
                          type="number"
                          min="-30"
                          max="90"
                          value={formValues.lastShipmentDelayDays}
                          onChange={e =>
                            setFormValues(v => ({
                              ...v,
                              lastShipmentDelayDays: Number(e.target.value),
                            }))
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Notes (optional)
                      </label>
                      <input
                        type="text"
                        value={formValues.notes}
                        onChange={e =>
                          setFormValues(v => ({ ...v, notes: e.target.value }))
                        }
                        placeholder="e.g. Quality issues with last batch, new contact established..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Score preview:{" "}
                        <span className="font-bold text-slate-300">
                          {scorePreview}/100
                        </span>{" "}
                        (on-time 50% · quality 35% · delay 15%)
                      </p>
                      <button
                        onClick={() =>
                          handleSave(score.supplierId, score.supplierName)
                        }
                        className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                      >
                        Save Performance Data
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <p className="text-xs text-slate-600 mt-3">
        Performance data stored locally in your browser · Scores weighted:
        on-time delivery 50% · quality 35% · delay penalty 15%
      </p>
    </div>
  )
}
