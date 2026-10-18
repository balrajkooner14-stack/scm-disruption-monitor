"use client"

import { useState, useCallback } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { parseFile, prepareForAI } from "@/lib/parseImportFile"
import { computeDaysOnHand, matchSupplierByName, wholeNumberShares } from "@/lib/importCalculations"
import type { ImportResult, ImportedSupplier, ImportedProductLine } from "@/app/api/import-profile/route"
import type { CompanyProfile, Supplier, ProductLine } from "@/lib/profile"
import { ui } from "@/lib/ui"

/** What the onboarding import step shows about the read ("3 sheets read in 9 seconds"). */
export interface ImportMeta {
  fileName: string
  sheetNames: string[]
  seconds: number
}

interface ImportProfileFlowProps {
  onComplete: () => void
  onCancel: () => void
  /**
   * Onboarding mode (v5.1). When set, this component only uploads, parses and
   * post-processes the file, then hands the result over: it never saves the
   * profile and skips its own review (the caller shows one). Without it the
   * /profile behaviour is unchanged.
   */
  onResult?: (result: ImportResult, meta: ImportMeta) => void
}

type ImportStep = "upload" | "processing" | "review" | "success"

// Confidence uses the app-wide severity chips: high → positive,
// medium → warning, low → critical.
const CONFIDENCE_CHIP: Record<"high" | "medium" | "low", string> = {
  high: ui.chipPositive,
  medium: ui.chipWarning,
  low: ui.chipCritical,
}

// Compact variant of ui.input for the dense review rows.
const compactInput =
  "w-full rounded-lg border border-line-control bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"

function ConfidenceChip({ level }: { level: "high" | "medium" | "low" }) {
  return <span className={`${ui.chip} ${CONFIDENCE_CHIP[level]} flex-shrink-0`}>{level.toUpperCase()}</span>
}

const noteBox = "rounded-lg bg-ochre-tint text-ochre px-4 py-3 text-sm"

export default function ImportProfileFlow({
  onComplete,
  onCancel,
  onResult,
}: ImportProfileFlowProps) {
  const { profile, saveProfile } = useCompanyProfile()
  const [step, setStep] = useState<ImportStep>("upload")
  const [isDragOver, setIsDragOver] = useState(false)
  const [fileName, setFileName] = useState("")
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [editedSuppliers, setEditedSuppliers] = useState<ImportedSupplier[]>([])
  const [editedProducts, setEditedProducts] = useState<ImportedProductLine[]>([])

  const processFile = async (file: File) => {
    setFileName(file.name)
    setError(null)
    setStep("processing")
    const startedAt = Date.now()

    try {
      const parsed = await parseFile(file)
      const aiData = prepareForAI(parsed)
      const res = await fetch("/api/import-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractedData: aiData, fileName: file.name }),
      })

      if (!res.ok) throw new Error("Failed to interpret file")
      const result: ImportResult = await res.json()

      // Deterministic post-processing — Gemini extracts raw numbers and
      // structure only; the arithmetic happens here, not in the prompt.
      const allShareMissing =
        result.suppliers.length > 0 &&
        result.suppliers.every(s => !s.sharePercent || s.sharePercent === 0)
      const evenShares = allShareMissing ? wholeNumberShares(result.suppliers.length) : []
      const suppliersWithShares = allShareMissing
        ? result.suppliers.map((s, i) => ({ ...s, sharePercent: evenShares[i] }))
        : result.suppliers

      const productsWithComputedDays = result.productLines.map(p => {
        if ((!p.inventoryDaysOnHand || p.inventoryDaysOnHand === 0) &&
            p.onHandValue && p.usageValue && p.usageWindowDays) {
          // Gemini's JSON output isn't guaranteed to type these as numbers
          // (observed as strings for CSV-sourced data) — coerce explicitly.
          const onHand = Number(p.onHandValue)
          const usage = Number(p.usageValue)
          const windowDays = Number(p.usageWindowDays)
          const computed = computeDaysOnHand(onHand, usage, windowDays)
          const sourceNote = `Computed from $${onHand.toLocaleString()} on hand ÷ $${usage.toLocaleString()} usage over ${windowDays}d`
          return {
            ...p,
            inventoryDaysOnHand: computed,
            notes: p.notes ? `${p.notes} · ${sourceNote}` : sourceNote,
          }
        }
        return p
      })

      if (onResult) {
        onResult(
          { ...result, suppliers: suppliersWithShares, productLines: productsWithComputedDays },
          {
            fileName: file.name,
            sheetNames: parsed.sheetNames ?? [file.name],
            seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          },
        )
        return
      }

      setImportResult(result)
      setEditedSuppliers(suppliersWithShares)
      setEditedProducts(productsWithComputedDays)
      setStep("review")

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to process file"
      setError(message)
      setStep("upload")
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleConfirm = async () => {
    if (!importResult) return
    setIsSaving(true)

    try {
      const ts = Date.now()

      const newSuppliers: Supplier[] = editedSuppliers.map((s, i) => ({
        id: `imported_${ts}_${i}`,
        name: s.name,
        country: s.country,
        region: s.region as Supplier["region"],
        category: s.category,
        sharePercent: s.sharePercent,
        leadTimeDays: s.leadTimeDays,
      }))

      const newProductLines: ProductLine[] = editedProducts.map((p, i) => {
        let primarySupplierId: string | undefined = undefined

        if (p.primarySupplierName) {
          const idx = matchSupplierByName(p.primarySupplierName, newSuppliers.map(s => s.name))
          if (idx >= 0) primarySupplierId = newSuppliers[idx].id
        }

        return {
          id: `imported_prod_${ts}_${i}`,
          name: p.name,
          inventoryDaysOnHand: p.inventoryDaysOnHand,
          reorderPointDays: p.reorderPointDays,
          primarySupplierId,
        }
      })

      const now = new Date().toISOString()
      const updatedProfile: CompanyProfile = {
        ...(profile ?? {
          companyName: importResult.companyName ?? "",
          headquartersCountry: "",
          sector: "Other" as const,
          revenueRange: "$0–$10M" as const,
          primaryMarkets: [],
          painPoints: [],
          transportModes: [],
          tradeLanes: [],
          createdAt: now,
        }),
        suppliers: newSuppliers.slice(0, 10),
        productLines: newProductLines.slice(0, 5),
        updatedAt: now,
      }

      const success = await saveProfile(updatedProfile)
      if (success) {
        setStep("success")
        setTimeout(() => onComplete(), 2000)
      } else {
        setError("Failed to save profile. Please try again.")
      }
    } catch {
      setError("Failed to save profile.")
    } finally {
      setIsSaving(false)
    }
  }

  // ── UPLOAD STEP ──────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="space-y-4">
        {error && <p className={ui.errorBox}>{error}</p>}

        <label
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${
            isDragOver ? "border-ink bg-surface" : "border-line-strong bg-paper-raised hover:border-ink"
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="sr-only"
          />
          <h3 className={ui.h3}>Import from a spreadsheet</h3>
          <p className={`${ui.meta} max-w-md`}>
            Drop your supplier list or inventory export here. Excel (.xlsx, .xls) or CSV — supplier
            lists, inventory reports, purchase order history. AI maps your columns to the profile fields.
          </p>
          <span className={ui.btnSecondary}>Choose file</span>
        </label>

        <p className="text-xs leading-relaxed text-ink-3">
          <span className="font-semibold text-ink-2">Privacy: </span>
          Your file is read locally in your browser. Only the extracted table data (not the file itself) is sent to AI for interpretation. No file is stored on any server.
        </p>

        <button onClick={onCancel} className={ui.btnGhost}>
          Cancel — enter data manually instead
        </button>
      </div>
    )
  }

  // ── PROCESSING STEP ──────────────────────────────────

  if (step === "processing") {
    return (
      <div className={`${ui.card} space-y-4`} aria-busy="true">
        <p className="text-[15px] font-semibold text-ink">Reading your file…</p>
        <p className={ui.meta}>
          {fileName} · Gemini is mapping your column names to supplier and inventory fields — this takes 5–10 seconds
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className={`${ui.skeleton} h-8`} />
          ))}
        </div>
      </div>
    )
  }

  // ── REVIEW STEP ──────────────────────────────────────

  if (step === "review" && importResult) {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className={ui.h3}>Review imported data</h3>
            <p className={ui.meta}>{importResult.message}</p>
          </div>
          <span className={`${ui.chip} ${CONFIDENCE_CHIP[importResult.confidence]} flex-shrink-0`}>
            {importResult.confidence.toUpperCase()} CONFIDENCE
          </span>
        </div>

        {importResult.rawColumnNames.length > 0 && (
          <div className="space-y-2">
            <p className={ui.eyebrow}>Columns detected in file</p>
            <div className="flex flex-wrap gap-1.5">
              {importResult.rawColumnNames.map(col => (
                <span key={col} className={`${ui.chip} ${ui.chipNeutral}`}>{col}</span>
              ))}
            </div>
          </div>
        )}

        {editedSuppliers.length > 0 && (
          <div className="space-y-2">
            <p className={ui.eyebrow}>Suppliers found ({editedSuppliers.length})</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {editedSuppliers.map((supplier, i) => (
                <div key={i} className={`${ui.cardInner} space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      aria-label="Supplier name"
                      value={supplier.name}
                      onChange={e => {
                        const updated = [...editedSuppliers]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setEditedSuppliers(updated)
                      }}
                      className={`${compactInput} flex-1 font-semibold`}
                    />
                    <ConfidenceChip level={supplier.confidence} />
                    <button
                      onClick={() => setEditedSuppliers(prev => prev.filter((_, idx) => idx !== i))}
                      className={ui.btnGhost}
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-ink-3">Country</span>
                      <input
                        type="text"
                        value={supplier.country}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], country: e.target.value }
                          setEditedSuppliers(updated)
                        }}
                        className={compactInput}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-ink-3">Share %</span>
                      <input
                        type="number"
                        value={supplier.sharePercent}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], sharePercent: Number(e.target.value) }
                          setEditedSuppliers(updated)
                        }}
                        className={compactInput}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-ink-3">Lead time (days)</span>
                      <input
                        type="number"
                        value={supplier.leadTimeDays}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], leadTimeDays: Number(e.target.value) }
                          setEditedSuppliers(updated)
                        }}
                        className={compactInput}
                      />
                    </label>
                  </div>
                  {supplier.notes && <p className="text-xs text-ochre">{supplier.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {editedProducts.length > 0 && (
          <div className="space-y-2">
            <p className={ui.eyebrow}>Product lines found ({editedProducts.length})</p>
            <div className="space-y-2">
              {editedProducts.map((product, i) => (
                <div key={i} className={`${ui.cardInner} space-y-2.5`}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      aria-label="Product line name"
                      value={product.name}
                      onChange={e => {
                        const updated = [...editedProducts]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setEditedProducts(updated)
                      }}
                      className={`${compactInput} flex-1 font-semibold`}
                    />
                    <ConfidenceChip level={product.confidence} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="text-xs text-ink-3">Days on hand</span>
                      <input
                        type="number"
                        value={product.inventoryDaysOnHand}
                        onChange={e => {
                          const updated = [...editedProducts]
                          updated[i] = { ...updated[i], inventoryDaysOnHand: Number(e.target.value) }
                          setEditedProducts(updated)
                        }}
                        className={compactInput}
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs text-ink-3">Reorder point (days)</span>
                      <input
                        type="number"
                        value={product.reorderPointDays}
                        onChange={e => {
                          const updated = [...editedProducts]
                          updated[i] = { ...updated[i], reorderPointDays: Number(e.target.value) }
                          setEditedProducts(updated)
                        }}
                        className={compactInput}
                      />
                    </label>
                  </div>
                  {product.primarySupplierName && (
                    <p className="text-xs text-ink-3">
                      Primary supplier:{" "}
                      {(() => {
                        const idx = matchSupplierByName(product.primarySupplierName, editedSuppliers.map(s => s.name))
                        const matched = idx >= 0 ? editedSuppliers[idx] : undefined
                        return matched ? (
                          <span className="text-moss font-semibold">✓ matched · {matched.name}</span>
                        ) : (
                          <span className="text-ochre">
                            &quot;{product.primarySupplierName}&quot; needs review — no match found in supplier list
                          </span>
                        )
                      })()}
                    </p>
                  )}
                  {product.notes && <p className="text-xs text-ochre">{product.notes}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {importResult.unmappedData.length > 0 && (
          <div className={`${noteBox} space-y-2`}>
            <p className="font-semibold">Data found but not imported</p>
            {importResult.unmappedData.map((entry, i) => (
              <div key={i}>
                <p>
                  <span className="font-semibold">{entry.sheetOrSection}</span> — organized by{" "}
                  {entry.detectedDimension}
                  {entry.detectedMetrics.length > 0 && (
                    <> · columns: {entry.detectedMetrics.join(", ")}</>
                  )}
                </p>
                <p className="text-xs">{entry.reason}</p>
              </div>
            ))}
          </div>
        )}

        {(importResult.ambiguities.length > 0 || importResult.missingFields.length > 0) && (
          <div className={`${noteBox} space-y-1`}>
            {importResult.missingFields.length > 0 && (
              <p>
                <span className="font-semibold">Missing: </span>
                {importResult.missingFields.join(", ")} — you can add these manually after import
              </p>
            )}
            {importResult.ambiguities.map((a, i) => (
              <p key={i}>{a}</p>
            ))}
          </div>
        )}

        {editedSuppliers.length === 0 && editedProducts.length === 0 && importResult.unmappedData.length === 0 && (
          <div className={ui.errorBox}>
            <p className="font-semibold">Could not extract supply chain data</p>
            <p>
              The file doesn&apos;t appear to contain supplier or inventory data in a recognizable format. Try a different file or enter data manually.
            </p>
          </div>
        )}

        {editedSuppliers.length === 0 && editedProducts.length === 0 && importResult.unmappedData.length > 0 && (
          <div className={noteBox}>
            <p className="font-semibold">Nothing to import from this file</p>
            <p>
              This file doesn&apos;t contain supplier or product data — see what was found above. Try a different file or enter data manually.
            </p>
          </div>
        )}

        {error && <p className={ui.errorBox}>{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={() => { setStep("upload"); setImportResult(null); setError(null) }}
            className={ui.btnSecondary}
          >
            Try a different file
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || (editedSuppliers.length === 0 && editedProducts.length === 0)}
            className={`${ui.btnAccent} disabled:cursor-not-allowed`}
          >
            {isSaving
              ? "Saving…"
              : `Import ${editedSuppliers.length} supplier${editedSuppliers.length !== 1 ? "s" : ""}${editedProducts.length > 0 ? ` + ${editedProducts.length} product${editedProducts.length !== 1 ? "s" : ""}` : ""}`
            }
          </button>
        </div>
      </div>
    )
  }

  // ── SUCCESS STEP ─────────────────────────────────────

  if (step === "success") {
    return (
      <div className={`${ui.card} space-y-2`}>
        <h3 className={`${ui.h3} flex items-center gap-2`}>
          <span className="text-moss">✓</span> Profile imported
        </h3>
        <p className={ui.body}>
          {importResult?.suppliers.length ?? 0} suppliers and{" "}
          {importResult?.productLines.length ?? 0} product lines imported from {fileName}
        </p>
        <p className={ui.meta}>Redirecting to dashboard…</p>
      </div>
    )
  }

  return null
}
