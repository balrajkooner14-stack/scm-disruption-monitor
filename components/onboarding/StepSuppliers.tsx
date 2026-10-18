"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import CountryCombobox from "@/components/onboarding/CountryCombobox"
import OnboardingMap from "@/components/onboarding/OnboardingMap"
import StepLayout, { StepHeading } from "@/components/onboarding/StepLayout"
import { FadeNumber, SeverityChip, eventMeta } from "@/components/onboarding/display"
import type { DisruptionEvent } from "@/lib/types"
import { findCountry } from "@/lib/countries"
import { MAX_SUPPLIERS, SUPPLY_SUGGESTIONS, isValidDraftSupplier, parsePastedSupplierRows, type DraftSupplier } from "@/lib/onboarding"
import { activeEventsForSuppliers, supplierTeaser } from "@/lib/onboardingInsights"
import { ui } from "@/lib/ui"

// Screen 4 (spec 6.4): an editable supplier table and a "Now watching" panel
// that reacts to every committed row with today's real events.

const GRID = "grid grid-cols-[1.3fr_1fr_1.2fr_0.8fr_40px] gap-3"
const cellInput =
  "h-10 w-full rounded-md border border-line-control bg-surface px-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
const SUGGESTIONS_ID = "onb-supply-suggestions"

type RowValues = { name: string; country: string; category: string; lead: string }
const EMPTY_ROW: RowValues = { name: "", country: "", category: "", lead: "" }

function toValues(s: DraftSupplier): RowValues {
  return { name: s.name, country: s.country, category: s.category, lead: s.leadTimeDays ? String(s.leadTimeDays) : "" }
}

function fromValues(id: string, v: RowValues): DraftSupplier {
  const lead = parseInt(v.lead, 10)
  const country = findCountry(v.country)?.name ?? v.country.trim()
  return {
    id,
    name: v.name.trim(),
    country,
    category: v.category.trim(),
    ...(Number.isFinite(lead) && lead > 0 ? { leadTimeDays: lead } : {}),
  }
}

function rowErrors(v: RowValues): string[] {
  const errs: string[] = []
  if (!v.name.trim()) errs.push("Add the supplier's name.")
  if (!v.country.trim()) errs.push("Add a country.")
  else if (!findCountry(v.country)) errs.push("Pick a country from the list.")
  return errs
}

const isBlank = (v: RowValues) => !v.name.trim() && !v.country.trim() && !v.category.trim() && !v.lead.trim()

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

interface EditRowProps {
  values: RowValues
  onChange: (v: RowValues) => void
  onCommit: () => void
  errors: string[]
  nameRef?: React.Ref<HTMLInputElement>
  onPaste?: (e: React.ClipboardEvent<HTMLInputElement>) => void
  onBlurOutside?: () => void
  label: string
  trailing?: React.ReactNode
}

function EditRow({ values, onChange, onCommit, errors, nameRef, onPaste, onBlurOutside, label, trailing }: EditRowProps) {
  const set = (field: keyof RowValues) => (value: string) => onChange({ ...values, [field]: value })
  // Enter commits the row instead of submitting the step, unless the row is
  // still blank (then Enter falls through to "Continue").
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isBlank(values)) {
      e.preventDefault()
      onCommit()
    }
  }
  return (
    <div
      role="group"
      aria-label={label}
      onBlur={e => {
        if (onBlurOutside && !e.currentTarget.contains(e.relatedTarget as Node | null)) onBlurOutside()
      }}
      className="border-b border-line-soft px-4 py-3 last:border-b-0"
    >
      <div className={`${GRID} items-start`}>
        <input
          ref={nameRef}
          type="text"
          aria-label="Supplier name"
          value={values.name}
          onChange={e => set("name")(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="Supplier name"
          className={cellInput}
        />
        <CountryCombobox
          label="Country"
          value={values.country}
          onChange={set("country")}
          onKeyDown={onKeyDown}
          inputClassName={cellInput}
          placeholder="Country"
        />
        <input
          type="text"
          aria-label="What they supply"
          list={SUGGESTIONS_ID}
          value={values.category}
          onChange={e => set("category")(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder="e.g. Sensors"
          className={cellInput}
        />
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label="Lead time in days"
          value={values.lead}
          onChange={e => set("lead")(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="optional"
          className={cellInput}
        />
        <span className="flex h-10 items-center justify-center">{trailing}</span>
      </div>
      {errors.length > 0 && (
        <p className="mt-2 text-[13px] text-ember-deep" role="alert">{errors.join(" ")}</p>
      )}
    </div>
  )
}

interface StepSuppliersProps {
  suppliers: DraftSupplier[]
  events: DisruptionEvent[]
  onChange: (suppliers: DraftSupplier[]) => void
  onBack: () => void
  onContinue: () => void
}

export default function StepSuppliers({ suppliers, events, onChange, onBack, onContinue }: StepSuppliersProps) {
  const [pending, setPending] = useState<RowValues>(EMPTY_ROW)
  const [pendingErrors, setPendingErrors] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<RowValues>(EMPTY_ROW)
  const [editErrors, setEditErrors] = useState<string[]>([])
  const [continueError, setContinueError] = useState<string | null>(null)
  const pendingNameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    pendingNameRef.current?.focus()
  }, [])

  const atLimit = suppliers.length >= MAX_SUPPLIERS
  const validSuppliers = useMemo(() => suppliers.filter(isValidDraftSupplier), [suppliers])
  const pendingValid = !isBlank(pending) && rowErrors(pending).length === 0
  const canContinue = validSuppliers.length > 0 || pendingValid

  // ── Right panel (committed rows only) ──
  const watched = useMemo(
    () =>
      validSuppliers.map(s => {
        const c = findCountry(s.country)!
        return { id: s.id, name: s.name, country: c.name, region: c.region }
      }),
    [validSuppliers],
  )
  const countryCount = new Set(watched.map(s => s.country)).size
  const activeCount = useMemo(() => activeEventsForSuppliers(watched, events).length, [watched, events])
  const teaser = useMemo(() => supplierTeaser(watched, events), [watched, events])

  // ── Table actions ──
  const commitPending = (): boolean => {
    if (isBlank(pending)) return true
    const errs = rowErrors(pending)
    setPendingErrors(errs)
    if (errs.length) return false
    onChange([...suppliers, fromValues(crypto.randomUUID(), pending)])
    setPending(EMPTY_ROW)
    pendingNameRef.current?.focus()
    return true
  }

  const startEdit = (s: DraftSupplier) => {
    if (editingId && !commitEdit()) return
    setEditingId(s.id)
    setEditValues(toValues(s))
    setEditErrors([])
  }

  const commitEdit = (): boolean => {
    if (!editingId) return true
    const errs = rowErrors(editValues)
    setEditErrors(errs)
    if (errs.length) return false
    onChange(suppliers.map(s => (s.id === editingId ? fromValues(editingId, editValues) : s)))
    setEditingId(null)
    return true
  }

  const remove = (id: string) => {
    if (editingId === id) setEditingId(null)
    onChange(suppliers.filter(s => s.id !== id))
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text")
    if (!/[\t\n]/.test(text)) return // a single value: let it paste normally
    e.preventDefault()
    const rows = parsePastedSupplierRows(text)
    const room = MAX_SUPPLIERS - suppliers.length
    // Pasted rows are kept even with an unrecognised country; they're flagged
    // in the table and left out of the profile until the country is fixed.
    const added = rows.slice(0, room).map(r => fromValues(crypto.randomUUID(), r))
    if (added.length) onChange([...suppliers, ...added])
    setPending(EMPTY_ROW)
    setPendingErrors([])
  }

  const submit = () => {
    setContinueError(null)
    if (editingId && !commitEdit()) return
    if (!isBlank(pending) && !commitPending()) return
    if (validSuppliers.length === 0 && !pendingValid) {
      setContinueError("Add at least one supplier with a country.")
      return
    }
    onContinue()
  }

  return (
    <StepLayout
      onSubmit={submit}
      panelLabel="Now watching"
      form={
        <>
          <StepHeading
            title="Who do you buy from?"
            sub="Start with the suppliers you'd worry about most. Three to five is plenty for now."
          />
          <datalist id={SUGGESTIONS_ID}>
            {SUPPLY_SUGGESTIONS.map(s => <option key={s} value={s} />)}
          </datalist>

          <div className="rounded-xl border border-line bg-surface">
            <div className={`${GRID} rounded-t-xl border-b border-line bg-paper-raised px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3`}>
              <span>Supplier</span>
              <span>Country</span>
              <span>What they supply</span>
              <span>Lead time (days)</span>
              <span className="sr-only">Remove</span>
            </div>

            {suppliers.map(s =>
              editingId === s.id ? (
                <EditRow
                  key={s.id}
                  label={`Edit ${s.name || "supplier"}`}
                  values={editValues}
                  onChange={setEditValues}
                  onCommit={commitEdit}
                  onBlurOutside={commitEdit}
                  errors={editErrors}
                  trailing={
                    <button type="button" onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`} className="text-ink-3 hover:text-ink">
                      <RemoveIcon />
                    </button>
                  }
                />
              ) : (
                <div
                  key={s.id}
                  onClick={() => startEdit(s)}
                  className={`${GRID} cursor-pointer items-center border-b border-line-soft px-4 py-3 text-[15px] last:border-b-0 hover:bg-paper-raised`}
                >
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      startEdit(s)
                    }}
                    className="truncate text-left font-semibold text-ink" aria-label={`Edit ${s.name}`}>
                    {s.name}
                  </button>
                  <span className="flex flex-col">
                    {findCountry(s.country) ? (
                      <>
                        <span>{s.country}</span>
                        <span className="text-xs text-ink-3">{findCountry(s.country)!.region}</span>
                      </>
                    ) : (
                      <>
                        <span>{s.country || "—"}</span>
                        <span className="text-xs text-ochre">Country needed</span>
                      </>
                    )}
                  </span>
                  <span className="truncate">{s.category || <span className="text-ink-3">—</span>}</span>
                  <span>{s.leadTimeDays ? `${s.leadTimeDays} d` : <span className="text-ink-3">—</span>}</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation()
                      remove(s.id)
                    }}
                    aria-label={`Remove ${s.name}`}
                    className="flex justify-center text-ink-3 hover:text-ink"
                  >
                    <RemoveIcon />
                  </button>
                </div>
              ),
            )}

            {!atLimit && (
              <EditRow
                label="New supplier"
                values={pending}
                onChange={v => {
                  setPending(v)
                  if (pendingErrors.length) setPendingErrors([])
                }}
                onCommit={commitPending}
                errors={pendingErrors}
                nameRef={pendingNameRef}
                onPaste={handlePaste}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3.5 text-sm">
            <button
              type="button"
              onClick={() => {
                if (commitPending()) pendingNameRef.current?.focus()
              }}
              disabled={atLimit}
              className="rounded-lg border border-dashed border-line-control px-3.5 py-2 text-sm text-ink transition-colors hover:border-ink disabled:opacity-50"
            >
              + Add another supplier
            </button>
            <span className={ui.meta}>{atLimit ? "Up to 10 suppliers for now." : "or paste rows from a spreadsheet"}</span>
          </div>
        </>
      }
      footer={
        <>
          <button type="button" onClick={onBack} className="text-sm text-ink-2 transition-colors hover:text-ink">← Back</button>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-4">
              <span className={`${ui.meta} hidden sm:inline`}>Share %, sub-suppliers and more can wait.</span>
              <button
                type="submit"
                disabled={!canContinue}
                className={`${ui.btnPrimary} shrink-0 px-6 py-3.5 text-[15px] disabled:cursor-not-allowed`}
              >
                Continue to ports →
              </button>
            </div>
            {(!canContinue || continueError) && (
              <p className={ui.meta} role={continueError ? "alert" : undefined}>
                {continueError ?? "Add at least one supplier with a country."}
              </p>
            )}
          </div>
        </>
      }
      panel={
        <>
          <div className="flex items-baseline justify-between gap-4">
            <p className={ui.eyebrow}>Now watching</p>
            <p className="text-[13px] text-ink-2" aria-live="polite">
              <FadeNumber value={countryCount} className="font-serif text-[22px] text-ink" />{" "}
              {countryCount === 1 ? "country" : "countries"} ·{" "}
              <FadeNumber value={activeCount} className={`font-serif text-[22px] ${activeCount > 0 ? "text-ember" : "text-ink"}`} />{" "}
              active {activeCount === 1 ? "event" : "events"}
            </p>
          </div>

          <OnboardingMap mode="suppliers" events={events} supplierCountries={watched.map(s => s.country)} />

          {watched.length > 0 &&
            (teaser ? (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-[18px]">
                <div className="flex items-center gap-2">
                  <SeverityChip severity={teaser.event.severity} />
                  <span className="text-xs text-ink-3">{eventMeta(teaser.event, true)}</span>
                </div>
                <p className="font-serif text-[21px] leading-tight text-ink">{teaser.event.title}</p>
                <p className="text-sm leading-relaxed text-ink-2">
                  {teaser.supplier.name} is in the affected country. Once you add products, we&apos;ll show which ones depend on it.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-[18px]">
                <span className={`${ui.chip} ${ui.chipPositive} self-start`}>ALL QUIET</span>
                <p className="text-sm leading-relaxed text-ink-2">
                  Nothing in today&apos;s news touches these suppliers. That&apos;s good news. We&apos;ll keep watching.
                </p>
              </div>
            ))}

          <p className={ui.meta}>Each supplier you add lights up here.</p>
        </>
      }
    />
  )
}
