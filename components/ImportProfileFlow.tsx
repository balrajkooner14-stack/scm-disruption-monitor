"use client"

import { useState, useCallback } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { parseFile, prepareForAI } from "@/lib/parseImportFile"
import { computeDaysOnHand, distributeShareEvenly } from "@/lib/importCalculations"
import type { ImportResult, ImportedSupplier, ImportedProductLine } from "@/app/api/import-profile/route"
import type { CompanyProfile, Supplier, ProductLine } from "@/lib/profile"

interface ImportProfileFlowProps {
  onComplete: () => void
  onCancel: () => void
}

type ImportStep = "upload" | "processing" | "review" | "success"

const CONFIDENCE_COLORS: Record<"high" | "medium" | "low", string> = {
  high: "text-green-400",
  medium: "text-amber-400",
  low: "text-red-400",
}

export default function ImportProfileFlow({
  onComplete,
  onCancel,
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
      const evenShare = allShareMissing ? distributeShareEvenly(result.suppliers.length) : 0
      const suppliersWithShares = allShareMissing
        ? result.suppliers.map(s => ({ ...s, sharePercent: evenShare }))
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
          const targetLower = p.primarySupplierName.toLowerCase()
          const matched = newSuppliers.find(s => {
            const supplierLower = s.name.toLowerCase()
            return (
              supplierLower.includes(targetLower) ||
              targetLower.includes(supplierLower) ||
              supplierLower.split(" ")[0] === targetLower.split(" ")[0]
            )
          })
          if (matched) primarySupplierId = matched.id
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
        <div>
          <h3 className="text-base font-semibold text-white mb-1">Import from file</h3>
          <p className="text-sm text-slate-400">
            Upload your supplier list or inventory export. AI will automatically map your columns to the profile fields.
          </p>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <label
          onDragOver={e => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center gap-3
            border-2 border-dashed rounded-xl p-8 cursor-pointer
            transition-all duration-150
            ${isDragOver
              ? "border-blue-500 bg-blue-950/20"
              : "border-slate-600 hover:border-slate-400 bg-slate-800/50"
            }
          `}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
          />
          <span className="text-3xl">📂</span>
          <div className="text-center">
            <p className="text-sm font-medium text-slate-200">
              Drop your file here or click to browse
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Excel (.xlsx, .xls) or CSV — supplier lists, inventory reports, purchase order history
            </p>
          </div>
          <div className="flex gap-2">
            {[".xlsx", ".xls", ".csv"].map(ext => (
              <span key={ext} className="text-xs bg-slate-700 text-slate-400 px-2 py-1 rounded border border-slate-600">
                {ext}
              </span>
            ))}
          </div>
        </label>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            <span className="text-slate-300 font-medium">🔒 Privacy: </span>
            Your file is read locally in your browser. Only the extracted table data (not the file itself) is sent to AI for interpretation. No file is stored on any server.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="w-full text-sm text-slate-500 hover:text-slate-300 py-2 transition-colors"
        >
          Cancel — enter data manually instead
        </button>
      </div>
    )
  }

  // ── PROCESSING STEP ──────────────────────────────────

  if (step === "processing") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <div className="flex flex-col items-center gap-3">
          <span className="text-3xl animate-pulse">🤖</span>
          <p className="text-sm font-medium text-slate-200">Reading {fileName}...</p>
          <div className="space-y-1 text-center">
            <p className="text-xs text-slate-500">Parsing file columns</p>
            <p className="text-xs text-blue-400 animate-pulse">AI interpreting your supply chain data...</p>
          </div>
        </div>
        <div className="w-48 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-1 bg-blue-500 rounded-full animate-pulse w-3/4" />
        </div>
        <p className="text-xs text-slate-600 text-center max-w-xs">
          Gemini is mapping your column names to supplier and inventory fields — this takes 5–10 seconds
        </p>
      </div>
    )
  }

  // ── REVIEW STEP ──────────────────────────────────────

  if (step === "review" && importResult) {
    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white mb-0.5">Review imported data</h3>
            <p className="text-xs text-slate-400">{importResult.message}</p>
          </div>
          <span className={`text-xs font-bold px-2 py-1 rounded-full border flex-shrink-0 ${
            importResult.confidence === "high"
              ? "bg-green-950 border-green-700 text-green-400"
              : importResult.confidence === "medium"
              ? "bg-amber-950 border-amber-700 text-amber-400"
              : "bg-red-950 border-red-700 text-red-400"
          }`}>
            {importResult.confidence} confidence
          </span>
        </div>

        {importResult.rawColumnNames.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Columns detected in file
            </p>
            <div className="flex flex-wrap gap-1.5">
              {importResult.rawColumnNames.map(col => (
                <span key={col} className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded border border-slate-600">
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}

        {editedSuppliers.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Suppliers found ({editedSuppliers.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {editedSuppliers.map((supplier, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={supplier.name}
                      onChange={e => {
                        const updated = [...editedSuppliers]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setEditedSuppliers(updated)
                      }}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className={`text-xs flex-shrink-0 ${CONFIDENCE_COLORS[supplier.confidence]}`}>
                      {supplier.confidence}
                    </span>
                    <button
                      onClick={() => setEditedSuppliers(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-500 hover:text-red-400 text-sm flex-shrink-0 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Country</p>
                      <input
                        type="text"
                        value={supplier.country}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], country: e.target.value }
                          setEditedSuppliers(updated)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Share %</p>
                      <input
                        type="number"
                        value={supplier.sharePercent}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], sharePercent: Number(e.target.value) }
                          setEditedSuppliers(updated)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Lead time (days)</p>
                      <input
                        type="number"
                        value={supplier.leadTimeDays}
                        onChange={e => {
                          const updated = [...editedSuppliers]
                          updated[i] = { ...updated[i], leadTimeDays: Number(e.target.value) }
                          setEditedSuppliers(updated)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {supplier.notes && (
                    <p className="text-xs text-amber-500 italic">⚠ {supplier.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {editedProducts.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Product lines found ({editedProducts.length})
            </p>
            <div className="space-y-2">
              {editedProducts.map((product, i) => (
                <div key={i} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={product.name}
                      onChange={e => {
                        const updated = [...editedProducts]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setEditedProducts(updated)
                      }}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                    <span className={`text-xs flex-shrink-0 ${CONFIDENCE_COLORS[product.confidence]}`}>
                      {product.confidence}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Days on hand</p>
                      <input
                        type="number"
                        value={product.inventoryDaysOnHand}
                        onChange={e => {
                          const updated = [...editedProducts]
                          updated[i] = { ...updated[i], inventoryDaysOnHand: Number(e.target.value) }
                          setEditedProducts(updated)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Reorder point (days)</p>
                      <input
                        type="number"
                        value={product.reorderPointDays}
                        onChange={e => {
                          const updated = [...editedProducts]
                          updated[i] = { ...updated[i], reorderPointDays: Number(e.target.value) }
                          setEditedProducts(updated)
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  {product.primarySupplierName && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500">Primary supplier:</span>
                      {(() => {
                        const targetLower = product.primarySupplierName.toLowerCase()
                        const matched = editedSuppliers.find(s => {
                          const supplierLower = s.name.toLowerCase()
                          return (
                            supplierLower.includes(targetLower) ||
                            targetLower.includes(supplierLower) ||
                            supplierLower.split(" ")[0] === targetLower.split(" ")[0]
                          )
                        })
                        return matched ? (
                          <span className="text-xs text-cyan-400 font-medium">
                            ✓ {matched.name}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-400">
                            ⚠ &quot;{product.primarySupplierName}&quot; — no match found in supplier list
                          </span>
                        )
                      })()}
                    </div>
                  )}
                  {product.notes && (
                    <p className="text-xs text-amber-500 italic mt-1">⚠ {product.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {importResult.unmappedData.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Data found but not imported
            </p>
            {importResult.unmappedData.map((entry, i) => (
              <div key={i} className="text-xs border-l-2 border-slate-600 pl-2">
                <p className="text-slate-300">
                  <span className="font-medium">{entry.sheetOrSection}</span> — organized by{" "}
                  <span className="text-slate-200">{entry.detectedDimension}</span>
                  {entry.detectedMetrics.length > 0 && (
                    <> · columns: {entry.detectedMetrics.join(", ")}</>
                  )}
                </p>
                <p className="text-slate-500 mt-0.5">{entry.reason}</p>
              </div>
            ))}
          </div>
        )}

        {(importResult.ambiguities.length > 0 || importResult.missingFields.length > 0) && (
          <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-3 space-y-1">
            {importResult.missingFields.length > 0 && (
              <p className="text-xs text-amber-400">
                <span className="font-semibold">Missing: </span>
                {importResult.missingFields.join(", ")} — you can add these manually after import
              </p>
            )}
            {importResult.ambiguities.map((a, i) => (
              <p key={i} className="text-xs text-amber-500">⚠ {a}</p>
            ))}
          </div>
        )}

        {editedSuppliers.length === 0 && editedProducts.length === 0 && importResult.unmappedData.length === 0 && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4 text-center">
            <p className="text-red-400 text-sm font-medium mb-1">Could not extract supply chain data</p>
            <p className="text-red-500 text-xs">
              The file doesn&apos;t appear to contain supplier or inventory data in a recognizable format. Try a different file or enter data manually.
            </p>
          </div>
        )}

        {editedSuppliers.length === 0 && editedProducts.length === 0 && importResult.unmappedData.length > 0 && (
          <div className="bg-amber-950/50 border border-amber-800 rounded-lg p-4 text-center">
            <p className="text-amber-400 text-sm font-medium mb-1">Nothing to import from this file</p>
            <p className="text-amber-500 text-xs">
              This file doesn&apos;t contain supplier or product data — see what was found above. Try a different file or enter data manually.
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={() => { setStep("upload"); setImportResult(null); setError(null) }}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-2.5 rounded-lg transition-colors border border-slate-600"
          >
            ← Try a different file
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || (editedSuppliers.length === 0 && editedProducts.length === 0)}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {isSaving
              ? "Saving..."
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
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <span className="text-4xl">✅</span>
        <p className="text-base font-semibold text-white">Profile updated successfully</p>
        <p className="text-sm text-slate-400">
          {importResult?.suppliers.length ?? 0} suppliers and{" "}
          {importResult?.productLines.length ?? 0} product lines imported from {fileName}
        </p>
        <p className="text-xs text-slate-600">Redirecting to dashboard...</p>
      </div>
    )
  }

  return null
}
