"use client"

import { useMemo, useState } from "react"
import ImportProfileFlow, { type ImportMeta } from "@/components/ImportProfileFlow"
import CountryCombobox from "@/components/onboarding/CountryCombobox"
import type { ImportResult } from "@/app/api/import-profile/route"
import { findCountry } from "@/lib/countries"
import {
  importResultToDraft,
  localISODate,
  type DraftProduct,
  type DraftSupplier,
} from "@/lib/onboarding"
import { ui } from "@/lib/ui"

// Import path (spec 6.7): upload and parse with the existing
// ImportProfileFlow (in onResult mode, so it never saves), then a review of
// what was found. Nothing is saved until the user finishes onboarding.

type Confidence = "high" | "medium" | "low"

const CONFIDENCE: Record<Confidence, { label: string; chip: string }> = {
  high: { label: "HIGH", chip: ui.chipPositive },
  medium: { label: "NEEDS A LOOK", chip: ui.chipWarning },
  low: { label: "LOW", chip: ui.chipCritical },
}

// The import API reports missing fields by their profile key.
const FIELD_LABELS: Record<string, string> = {
  sharePercent: "share of spend",
  leadTimeDays: "lead times",
  inventoryDaysOnHand: "days of stock",
  reorderPointDays: "reorder points",
  primarySupplierName: "which supplier makes each product",
  country: "supplier countries",
  category: "what each supplier provides",
  region: "supplier regions",
}
const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()

const GRID = "grid grid-cols-[1.3fr_1fr_1.2fr_0.7fr_130px_32px] gap-3"
const cellInput =
  "h-[34px] w-full rounded-md border border-line-control bg-surface px-2 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-moss" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="flex justify-center text-ink-3 hover:text-ink">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}

interface Review {
  result: ImportResult
  meta: ImportMeta
  suppliers: DraftSupplier[]
  products: DraftProduct[]
  confidence: Record<string, Confidence>
}

interface StepImportProps {
  onConfirm: (rows: { suppliers: DraftSupplier[]; products: DraftProduct[] }) => void
  onTypeInstead: () => void
  onBack: () => void
}

export default function StepImport({ onConfirm, onTypeInstead, onBack }: StepImportProps) {
  const [review, setReview] = useState<Review | null>(null)
  const [showProducts, setShowProducts] = useState(false)

  const handleResult = (result: ImportResult, meta: ImportMeta) => {
    const rows = importResultToDraft(result.suppliers, result.productLines, localISODate(), () => crypto.randomUUID())
    const confidence: Record<string, Confidence> = {}
    rows.suppliers.forEach((s, i) => {
      confidence[s.id] = result.suppliers[i]?.confidence ?? "medium"
    })
    setReview({ result, meta, ...rows, confidence })
  }

  const needsCountry = useMemo(
    () => (review ? review.suppliers.filter(s => !s.name.trim() || !findCountry(s.country)) : []),
    [review],
  )

  // ── Upload / processing ──
  if (!review) {
    return (
      <div className="grid flex-1 grid-cols-1 gap-8 px-6 py-11 sm:px-12 lg:grid-cols-12 xl:px-20">
        <section className="flex flex-col gap-5 lg:col-span-8">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[38px] font-normal leading-[1.12] text-ink">Upload the spreadsheet you already have.</h1>
            <p className="text-base text-ink-2">
              A supplier list, a purchase-order export or an inventory report. Messy column names are fine.
            </p>
          </div>
          <ImportProfileFlow onComplete={() => {}} onCancel={onTypeInstead} onResult={handleResult} />
          <button type="button" onClick={onBack} className="self-start text-sm text-ink-2 transition-colors hover:text-ink">← Back</button>
        </section>
        <aside className="lg:col-span-4">
          <div className="flex flex-col gap-2 rounded-xl border border-line bg-paper-raised p-[22px]">
            <p className={ui.eyebrow}>Your file</p>
            <p className="text-sm leading-relaxed text-ink-2">
              Read in your browser. Only the rows you confirm are saved, and only after you finish setting up.
            </p>
          </div>
        </aside>
      </div>
    )
  }

  // ── Review ──
  const { result, meta } = review
  const setSuppliers = (suppliers: DraftSupplier[]) => setReview(r => (r ? { ...r, suppliers } : r))
  const setProducts = (products: DraftProduct[]) => setReview(r => (r ? { ...r, products } : r))
  const updateSupplier = (id: string, patch: Partial<DraftSupplier>) =>
    setSuppliers(review.suppliers.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const removeSupplier = (id: string) => {
    setSuppliers(review.suppliers.filter(s => s.id !== id))
    setProducts(review.products.map(p => (p.supplierId === id ? { ...p, supplierId: undefined } : p)))
  }
  const updateProduct = (id: string, patch: Partial<DraftProduct>) =>
    setProducts(review.products.map(p => (p.id === id ? { ...p, ...patch } : p)))

  const unmappedSheets = new Set(result.unmappedData.map(u => u.sheetOrSection.toLowerCase()))
  const sheetUsed = (name: string) => !Array.from(unmappedSheets).some(u => u.includes(name.toLowerCase()) || name.toLowerCase().includes(u))
  const usedSheets = meta.sheetNames.filter(sheetUsed)
  const tooMany = result.suppliers.length > review.suppliers.length || result.productLines.length > review.products.length
  const nothingFound = review.suppliers.length === 0 && review.products.length === 0
  const canContinue = review.suppliers.length > 0 && needsCountry.length === 0
  const sheetsLabel = `${meta.sheetNames.length} sheet${meta.sheetNames.length === 1 ? "" : "s"}`

  return (
    <div className="grid flex-1 grid-cols-1 gap-8 px-6 py-11 sm:px-12 lg:grid-cols-12 xl:px-20">
      <section className="flex flex-col gap-5 lg:col-span-8">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2.5 text-[13px] text-ink-2">
            <CheckIcon />
            {meta.fileName} · {sheetsLabel} read in {meta.seconds} second{meta.seconds === 1 ? "" : "s"}
          </p>
          <h1 className="font-serif text-[38px] font-normal leading-[1.12] text-ink">
            {nothingFound
              ? "We couldn't find suppliers or products in this file."
              : `We found ${review.suppliers.length} supplier${review.suppliers.length === 1 ? "" : "s"} and ${review.products.length} product${review.products.length === 1 ? "" : "s"}. Check them before we save.`}
          </h1>
          {tooMany && <p className={ui.meta}>Showing the first 10 suppliers and 5 products, the most a profile holds for now.</p>}
        </div>

        {review.suppliers.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div className={`${GRID} border-b border-line bg-paper-raised px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3`}>
              <span>Supplier</span>
              <span>Country</span>
              <span>Supplies</span>
              <span>Lead time</span>
              <span>Confidence</span>
              <span className="sr-only">Remove</span>
            </div>
            {review.suppliers.map(s => {
              const needs = !s.name.trim() || !findCountry(s.country)
              const conf = needs ? "medium" : review.confidence[s.id] ?? "medium"
              return (
                <div
                  key={s.id}
                  className={`${GRID} items-center border-b border-line-soft px-4 py-3 text-[15px] last:border-b-0 ${needs ? "bg-[#FDF8EC]" : ""}`}
                >
                  {s.name.trim() ? (
                    <span className="truncate font-semibold text-ink">{s.name}</span>
                  ) : (
                    <input
                      type="text"
                      aria-label="Supplier name"
                      placeholder="Supplier name"
                      value={s.name}
                      onChange={e => updateSupplier(s.id, { name: e.target.value })}
                      className={cellInput}
                    />
                  )}
                  {findCountry(s.country) ? (
                    <span>{s.country}</span>
                  ) : (
                    <CountryCombobox
                      label={`Country for ${s.name || "this supplier"}`}
                      value={s.country}
                      onChange={v => updateSupplier(s.id, { country: v })}
                      onCommit={v => updateSupplier(s.id, { country: v })}
                      placeholder="Which country?"
                      inputClassName={cellInput}
                      showRegion={false}
                    />
                  )}
                  <span className="truncate">{s.category || <span className="text-ink-3">—</span>}</span>
                  {conf === "high" ? (
                    <span>{s.leadTimeDays ? `${s.leadTimeDays} d` : <span className="text-ink-3">—</span>}</span>
                  ) : (
                    // Less-sure rows stay editable: the AI can misread a number.
                    <input
                      type="number"
                      min={0}
                      aria-label={`Lead time in days for ${s.name || "this supplier"}`}
                      placeholder="days"
                      value={s.leadTimeDays ?? ""}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        updateSupplier(s.id, { leadTimeDays: Number.isFinite(n) && n > 0 ? n : undefined })
                      }}
                      className={cellInput}
                    />
                  )}
                  <span>
                    <span className={`${ui.chip} ${CONFIDENCE[conf].chip}`}>{CONFIDENCE[conf].label}</span>
                  </span>
                  <RemoveButton label={`Remove ${s.name || "this supplier"}`} onClick={() => removeSupplier(s.id)} />
                </div>
              )
            })}
          </div>
        )}

        {review.products.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-2">
              Products found: {review.products.map(p => p.name).join(", ")}.{" "}
              <button
                type="button"
                aria-expanded={showProducts}
                onClick={() => setShowProducts(v => !v)}
                className="text-ember transition-colors hover:text-ember-deep"
              >
                {showProducts ? "Hide products" : "Review products"}
              </button>
            </p>
            {showProducts && (
              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="grid grid-cols-[1.4fr_1.4fr_0.8fr_32px] gap-3 border-b border-line bg-paper-raised px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                  <span>Product line</span>
                  <span>Made by</span>
                  <span>Days of stock</span>
                  <span className="sr-only">Remove</span>
                </div>
                {review.products.map(p => (
                  <div key={p.id} className="grid grid-cols-[1.4fr_1.4fr_0.8fr_32px] items-center gap-3 border-b border-line-soft px-4 py-2.5 last:border-b-0">
                    <input
                      type="text"
                      aria-label="Product line"
                      value={p.name}
                      onChange={e => updateProduct(p.id, { name: e.target.value })}
                      className={cellInput}
                    />
                    <select
                      aria-label={`Who makes ${p.name}`}
                      value={p.supplierId ?? ""}
                      onChange={e => updateProduct(p.id, { supplierId: e.target.value || undefined })}
                      className={cellInput}
                    >
                      <option value="">Not linked yet</option>
                      {review.suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name || "Unnamed supplier"}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={0}
                      aria-label={`Days of stock for ${p.name}`}
                      placeholder="add later"
                      value={typeof p.stockDays === "number" ? p.stockDays : ""}
                      onChange={e => {
                        const n = parseInt(e.target.value, 10)
                        updateProduct(
                          p.id,
                          Number.isFinite(n) && n >= 0
                            ? { stockDays: n, asOf: localISODate(), stockLater: false }
                            : { stockDays: undefined, asOf: undefined, stockLater: true },
                        )
                      }}
                      className={cellInput}
                    />
                    <RemoveButton label={`Remove ${p.name}`} onClick={() => setProducts(review.products.filter(x => x.id !== p.id))} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          !nothingFound && <p className="text-sm text-ink-2">No product lines in this file. You can add them later from your dashboard.</p>
        )}

        {nothingFound && (
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => setReview(null)} className={ui.btnSecondary}>Try a different file</button>
            <button type="button" onClick={onTypeInstead} className={ui.btnPrimary}>Type my suppliers in instead</button>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 pt-4">
          <button type="button" onClick={() => setReview(null)} className="text-sm text-ink-2 transition-colors hover:text-ink">
            ← Use a different file
          </button>
          <div className="flex items-center gap-4">
            {needsCountry.length > 0 && (
              <span className="text-[13px] text-ochre" role="status">
                {needsCountry.length} row{needsCountry.length === 1 ? " needs" : "s need"} a country
              </span>
            )}
            <button
              type="button"
              disabled={!canContinue}
              onClick={() => onConfirm({ suppliers: review.suppliers, products: review.products.filter(p => p.name.trim()) })}
              className={`${ui.btnPrimary} shrink-0 px-6 py-3.5 text-[15px] disabled:cursor-not-allowed`}
            >
              Looks right, continue →
            </button>
          </div>
        </div>
      </section>

      <aside className="flex flex-col gap-4 lg:col-span-4">
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper-raised p-[22px]">
          <p className={ui.eyebrow}>What we read</p>
          <ul className="flex flex-col gap-2.5 text-sm">
            {meta.sheetNames.map(name => {
              const used = sheetUsed(name)
              const counts =
                used && usedSheets.length === 1
                  ? [
                      review.suppliers.length ? `${review.suppliers.length} supplier${review.suppliers.length === 1 ? "" : "s"}` : null,
                      review.products.length ? `${review.products.length} product${review.products.length === 1 ? "" : "s"}` : null,
                    ].filter(Boolean).join(", ") || "nothing usable"
                  : used
                    ? "used"
                    : "not used"
              return (
                <li key={name} className="flex justify-between gap-3">
                  <span className="truncate">{meta.sheetNames.length > 1 ? `Sheet "${name}"` : name}</span>
                  <span className={used ? "shrink-0 text-moss-deep" : "shrink-0 text-ink-3"}>{counts}</span>
                </li>
              )
            })}
          </ul>
          {result.unmappedData.map((u, i) => (
            <p key={i} className="text-[13px] leading-relaxed text-ink-2">
              &quot;{u.sheetOrSection}&quot; is organised by {u.detectedDimension}. {u.reason}
            </p>
          ))}
          {(result.missingFields.length > 0 || result.ambiguities.length > 0) && (
            <div className="flex flex-col gap-1 text-[13px] leading-relaxed text-ink-2">
              {result.missingFields.length > 0 && <p>Not in the file: {result.missingFields.map(fieldLabel).join(", ")}. You can add these later.</p>}
              {result.ambiguities.map((a, i) => <p key={i}>{a}</p>)}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-paper-raised p-[22px]">
          <p className={ui.eyebrow}>Your file</p>
          <p className="text-sm leading-relaxed text-ink-2">
            Read in your browser. Only the rows above are saved, and only when you finish setting up.
          </p>
        </div>
      </aside>
    </div>
  )
}
