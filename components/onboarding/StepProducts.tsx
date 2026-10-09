"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import MiniNetwork from "@/components/onboarding/MiniNetwork"
import StepLayout, { StepHeading } from "@/components/onboarding/StepLayout"
import type { DisruptionEvent } from "@/lib/types"
import { findCountry } from "@/lib/countries"
import {
  MAX_PRODUCTS,
  isValidDraftSupplier,
  localISODate,
  shortCompanyName,
  type DraftProduct,
  type OnboardingDraft,
} from "@/lib/onboarding"
import { productInsight, supplierHasActiveEvent } from "@/lib/onboardingInsights"
import { ui } from "@/lib/ui"

// Screen 6 (spec 6.6): product lines and who makes them, with a live network
// drawing and a "found while you typed" insight from today's real events.

const GRID = "grid grid-cols-[1.3fr_1.3fr_0.8fr_0.9fr_40px] gap-3"
const cellInput =
  "h-10 w-full rounded-md border border-line-control bg-surface px-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none disabled:bg-paper-sunk disabled:text-ink-3"

type RowValues = { name: string; supplierId: string; stock: string; asOf: string; later: boolean }
const emptyRow = (): RowValues => ({ name: "", supplierId: "", stock: "", asOf: localISODate(), later: false })

function toValues(p: DraftProduct): RowValues {
  return {
    name: p.name,
    supplierId: p.supplierId ?? "",
    stock: typeof p.stockDays === "number" ? String(p.stockDays) : "",
    asOf: p.asOf ?? localISODate(),
    later: !!p.stockLater,
  }
}

function fromValues(id: string, v: RowValues): DraftProduct {
  const stock = parseInt(v.stock, 10)
  const hasStock = !v.later && Number.isFinite(stock) && stock >= 0
  return {
    id,
    name: v.name.trim(),
    ...(v.supplierId ? { supplierId: v.supplierId } : {}),
    ...(hasStock ? { stockDays: stock, asOf: v.asOf || localISODate() } : {}),
    ...(v.later ? { stockLater: true } : {}),
  }
}

function rowErrors(v: RowValues): string[] {
  const errs: string[] = []
  if (!v.name.trim()) errs.push("Name the product line.")
  if (!v.supplierId) errs.push("Choose who makes it.")
  return errs
}

const isBlank = (v: RowValues) => !v.name.trim() && !v.supplierId && !v.stock.trim() && !v.later

function asOfLabel(p: DraftProduct): string {
  if (p.stockLater) return "Add later"
  if (typeof p.stockDays !== "number") return "—"
  if (!p.asOf || p.asOf === localISODate()) return "Today"
  const [y, m, d] = p.asOf.split("-").map(Number)
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

interface EditRowProps {
  values: RowValues
  suppliers: { id: string; name: string }[]
  onChange: (v: RowValues) => void
  onCommit: () => void
  onBlurOutside?: () => void
  errors: string[]
  nameRef?: React.Ref<HTMLInputElement>
  label: string
  trailing?: React.ReactNode
}

function EditRow({ values, suppliers, onChange, onCommit, onBlurOutside, errors, nameRef, label, trailing }: EditRowProps) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Enter" && !isBlank(values)) {
      e.preventDefault()
      onCommit()
    }
  }
  const noStock = !values.stock.trim()
  return (
    <div
      role="group"
      aria-label={label}
      onBlur={e => {
        if (onBlurOutside && !e.currentTarget.contains(e.relatedTarget as Node | null)) onBlurOutside()
      }}
      className="border-b border-line-soft px-4 py-3 last:border-b-0"
    >
      <div className={`${GRID} items-center`}>
        <input
          ref={nameRef}
          type="text"
          aria-label="Product line"
          value={values.name}
          onChange={e => onChange({ ...values, name: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Product line"
          className={cellInput}
        />
        <select
          aria-label="Made by"
          value={values.supplierId}
          onChange={e => onChange({ ...values, supplierId: e.target.value })}
          onKeyDown={onKeyDown}
          className={cellInput}
        >
          <option value="">Choose a supplier</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label="Days of stock"
          value={values.later ? "" : values.stock}
          disabled={values.later}
          onChange={e => onChange({ ...values, stock: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder={values.later ? "—" : "optional"}
          className={cellInput}
        />
        {noStock ? (
          <button
            type="button"
            aria-pressed={values.later}
            onClick={() => onChange({ ...values, later: !values.later, stock: "" })}
            className={`justify-self-start rounded-full border px-2.5 py-1 text-xs transition-colors ${
              values.later ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-2 hover:border-ink"
            }`}
          >
            Add later
          </button>
        ) : (
          <input
            type="date"
            aria-label="Stock counted on"
            value={values.asOf}
            max={localISODate()}
            onChange={e => onChange({ ...values, asOf: e.target.value })}
            onKeyDown={onKeyDown}
            className={cellInput}
          />
        )}
        <span className="flex h-10 items-center justify-center">{trailing}</span>
      </div>
      {errors.length > 0 && <p className="mt-2 text-[13px] text-ember-deep" role="alert">{errors.join(" ")}</p>}
    </div>
  )
}

interface StepProductsProps {
  draft: OnboardingDraft
  events: DisruptionEvent[]
  onChange: (products: DraftProduct[]) => void
  onBack: () => void
  onFinish: () => void
}

export default function StepProducts({ draft, events, onChange, onBack, onFinish }: StepProductsProps) {
  const products = draft.products
  const [pending, setPending] = useState<RowValues>(emptyRow)
  const [pendingErrors, setPendingErrors] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<RowValues>(emptyRow)
  const [editErrors, setEditErrors] = useState<string[]>([])
  const pendingNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pendingNameRef.current?.focus()
  }, [])

  const suppliers = useMemo(() => draft.suppliers.filter(isValidDraftSupplier), [draft.suppliers])
  const supplierName = (id?: string) => suppliers.find(s => s.id === id)?.name ?? "—"
  const atLimit = products.length >= MAX_PRODUCTS
  const company = shortCompanyName(draft.company.name) || "your company"

  // ── Right panel (committed rows only) ──
  const networkSuppliers = useMemo(
    () =>
      suppliers.map(s => {
        const c = findCountry(s.country)!
        return { id: s.id, name: s.name, active: supplierHasActiveEvent({ id: s.id, name: s.name, country: c.name, region: c.region }, events) }
      }),
    [suppliers, events],
  )
  const insight = useMemo(() => productInsight(draft, events), [draft, events])

  // ── Table actions ──
  const commitPending = (): boolean => {
    if (isBlank(pending)) return true
    const errs = rowErrors(pending)
    setPendingErrors(errs)
    if (errs.length) return false
    onChange([...products, fromValues(crypto.randomUUID(), pending)])
    setPending(emptyRow())
    pendingNameRef.current?.focus()
    return true
  }
  const commitEdit = (): boolean => {
    if (!editingId) return true
    const errs = rowErrors(editValues)
    setEditErrors(errs)
    if (errs.length) return false
    onChange(products.map(p => (p.id === editingId ? fromValues(editingId, editValues) : p)))
    setEditingId(null)
    return true
  }
  const startEdit = (p: DraftProduct) => {
    if (editingId && !commitEdit()) return
    setEditingId(p.id)
    setEditValues(toValues(p))
    setEditErrors([])
  }
  const remove = (id: string) => {
    if (editingId === id) setEditingId(null)
    onChange(products.filter(p => p.id !== id))
  }

  const submit = () => {
    if (editingId && !commitEdit()) return
    if (!commitPending()) return
    onFinish()
  }

  return (
    <StepLayout
      onSubmit={submit}
      panelLabel="Your supply chain, drawn"
      form={
        <>
          <StepHeading
            title="What do you sell, and who makes it?"
            sub={`This is how Foreglow turns "a flood in China" into "your Smart Home Hub is exposed."`}
          />

          <div className="rounded-xl border border-line bg-surface">
            <div className={`${GRID} rounded-t-xl border-b border-line bg-paper-raised px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3`}>
              <span>Product line</span>
              <span>Made by</span>
              <span>Days of stock</span>
              <span>As of</span>
              <span className="sr-only">Remove</span>
            </div>

            {products.map(p =>
              editingId === p.id ? (
                <EditRow
                  key={p.id}
                  label={`Edit ${p.name}`}
                  values={editValues}
                  suppliers={suppliers}
                  onChange={setEditValues}
                  onCommit={commitEdit}
                  onBlurOutside={commitEdit}
                  errors={editErrors}
                  trailing={
                    <button type="button" onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`} className="text-ink-3 hover:text-ink">
                      <RemoveIcon />
                    </button>
                  }
                />
              ) : (
                <div
                  key={p.id}
                  onClick={() => startEdit(p)}
                  className={`${GRID} cursor-pointer items-center border-b border-line-soft px-4 py-3 text-[15px] last:border-b-0 hover:bg-paper-raised`}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      startEdit(p)
                    }}
                    aria-label={`Edit ${p.name}`}
                    className="truncate text-left font-semibold text-ink"
                  >
                    {p.name}
                  </button>
                  <span className="truncate">{supplierName(p.supplierId)}</span>
                  <span className={typeof p.stockDays === "number" ? "" : "text-ink-3"}>
                    {typeof p.stockDays === "number" ? p.stockDays : "—"}
                  </span>
                  <span className="text-ink-2">{asOfLabel(p)}</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      remove(p.id)
                    }}
                    aria-label={`Remove ${p.name}`}
                    className="flex justify-center text-ink-3 hover:text-ink"
                  >
                    <RemoveIcon />
                  </button>
                </div>
              ),
            )}

            {!atLimit && (
              <EditRow
                label="New product line"
                values={pending}
                suppliers={suppliers}
                onChange={v => {
                  setPending(v)
                  if (pendingErrors.length) setPendingErrors([])
                }}
                onCommit={commitPending}
                errors={pendingErrors}
                nameRef={pendingNameRef}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              onClick={() => {
                if (commitPending()) pendingNameRef.current?.focus()
              }}
              disabled={atLimit}
              className="rounded-lg border border-dashed border-line-control px-3.5 py-2 text-sm text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              + Add a product line
            </button>
            {atLimit && <span className={ui.meta}>Up to 5 product lines for now.</span>}
          </div>

          <p className="rounded-[10px] border border-line bg-paper-raised px-4 py-3.5 text-sm leading-relaxed text-ink-2">
            <span className="font-semibold text-ink">How days of stock works:</span> we count down from the date you
            enter, so the number stays honest. Don&apos;t know it right now? Skip it. Everything else still works.
          </p>
        </>
      }
      footer={
        <>
          <button type="button" onClick={onBack} className="text-sm text-ink-2 transition-colors hover:text-ink">← Back</button>
          <div className="flex items-center gap-4">
            {products.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  onChange([])
                  onFinish()
                }}
                className="text-sm text-ink-2 transition-colors hover:text-ink"
              >
                I&apos;ll add products later
              </button>
            )}
            <button type="submit" className={`${ui.btnAccent} shrink-0 px-6 py-3.5 text-[15px]`}>
              See what&apos;s touching {company} →
            </button>
          </div>
        </>
      }
      panel={
        <>
          <p className={ui.eyebrow}>Your supply chain, drawn</p>
          <MiniNetwork
            suppliers={networkSuppliers}
            products={products.map(p => ({ id: p.id, name: p.name, supplierId: p.supplierId }))}
            highlightProductId={insight?.productId ?? null}
          />
          <div key={insight?.headline ?? "waiting"} className="flex animate-[fadeIn_150ms_ease-out] flex-col gap-2 rounded-xl border border-line bg-surface p-[18px]">
            {insight ? (
              <>
                <p className="text-xs font-semibold tracking-[0.08em] text-ember">FOUND WHILE YOU TYPED</p>
                <p className="font-serif text-[21px] leading-tight text-ink">{insight.headline}</p>
                <p className="text-sm leading-relaxed text-ink-2">{insight.body}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-[0.08em] text-ink-3">WAITING FOR PRODUCTS</p>
                <p className="font-serif text-[21px] leading-tight text-ink">Link a product to a supplier to see its exposure.</p>
              </>
            )}
          </div>
        </>
      }
    />
  )
}
