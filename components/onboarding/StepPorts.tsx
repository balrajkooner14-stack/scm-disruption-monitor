"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import StepLayout, { StepHeading } from "@/components/onboarding/StepLayout"
import { SeverityChip, eventMeta } from "@/components/onboarding/display"
import type { DisruptionEvent } from "@/lib/types"
import type { TransportMode } from "@/lib/profile"
import { TRANSPORT_CHIPS, type OnboardingPath } from "@/lib/onboarding"
import { portWatchHeadline } from "@/lib/onboardingInsights"
import { PORTS, customPortId, isCustomPortId, matchEventsToPorts, portName } from "@/lib/ports"
import { ui } from "@/lib/ui"

// Screen 5 (spec 6.5): entry ports and transport modes, with a "Port watch"
// panel showing today's real events at each selected port.

const MAX_PORT_CARDS = 4

const tileBase = "flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3.5 text-left text-[15px] transition-colors"
const tileOn = `${tileBase} border-ink bg-ink text-paper`
const tileOff = `${tileBase} border-line-strong bg-surface text-ink hover:border-ink`

interface StepPortsProps {
  entryPorts: string[]
  transport: TransportMode[]
  events: DisruptionEvent[]
  path: OnboardingPath
  companyName: string
  onChange: (patch: { entryPorts?: string[]; transport?: TransportMode[] }) => void
  onBack: () => void
  onContinue: () => void
}

export default function StepPorts({ entryPorts, transport, events, path, companyName, onChange, onBack, onContinue }: StepPortsProps) {
  const [addingCustom, setAddingCustom] = useState(false)
  const [customName, setCustomName] = useState("")
  const firstTileRef = useRef<HTMLButtonElement>(null)
  const customInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    firstTileRef.current?.focus()
  }, [])
  useEffect(() => {
    if (addingCustom) customInputRef.current?.focus()
  }, [addingCustom])

  const togglePort = (id: string) =>
    onChange({ entryPorts: entryPorts.includes(id) ? entryPorts.filter(p => p !== id) : [...entryPorts, id] })
  const toggleTransport = (mode: TransportMode) =>
    onChange({ transport: transport.includes(mode) ? transport.filter(m => m !== mode) : [...transport, mode] })

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    const id = customPortId(name)
    if (!entryPorts.some(p => p.toLowerCase() === id.toLowerCase())) onChange({ entryPorts: [...entryPorts, id] })
    setCustomName("")
    setAddingCustom(false)
  }

  const matches = useMemo(() => matchEventsToPorts(events, entryPorts), [events, entryPorts])
  const withNews = entryPorts.filter(id => matches[id]?.length > 0).length
  const customPorts = entryPorts.filter(isCustomPortId)

  const primaryLabel =
    path === "import" ? `See what's touching ${companyName.trim() || "your company"} →` : "Continue to products →"

  return (
    <StepLayout
      onSubmit={onContinue}
      panelLabel="Port watch"
      form={
        <>
          <StepHeading
            title="Where do your goods come in?"
            sub="Strikes, closures and congestion happen at specific ports. Tell us yours and we'll catch them."
          />

          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 ${ui.label}`}>US ports and crossings you use</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PORTS.map((p, i) => {
                const on = entryPorts.includes(p.id)
                return (
                  <button
                    key={p.id}
                    ref={i === 0 ? firstTileRef : undefined}
                    type="button"
                    aria-pressed={on}
                    onClick={() => togglePort(p.id)}
                    className={on ? tileOn : tileOff}
                  >
                    <span>{p.name}</span>
                    <span className={`text-xs ${on ? "text-on-ink-muted" : "text-ink-3"}`}>{p.coast}</span>
                  </button>
                )
              })}
              {customPorts.map(id => (
                <button key={id} type="button" aria-pressed onClick={() => togglePort(id)} className={tileOn}>
                  <span>{portName(id)}</span>
                  <span className="text-xs text-on-ink-muted">Your port</span>
                </button>
              ))}
              {addingCustom ? (
                <div className="flex gap-2 sm:col-span-2">
                  <input
                    ref={customInputRef}
                    type="text"
                    aria-label="Port or crossing name"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCustom()
                      } else if (e.key === "Escape") {
                        setAddingCustom(false)
                      }
                    }}
                    placeholder="e.g. Baltimore"
                    className={`${ui.input} h-[50px]`}
                  />
                  <button type="button" onClick={addCustom} disabled={!customName.trim()} className={`${ui.btnSecondary} shrink-0`}>
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCustom(true)}
                  className={`${tileBase} border-dashed border-line-control bg-surface text-ink hover:border-ink sm:col-span-2`}
                >
                  + Another port
                </button>
              )}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className={`mb-2 ${ui.label}`}>How it mostly travels</legend>
            <div className="flex flex-wrap gap-2">
              {TRANSPORT_CHIPS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={transport.includes(c.value)}
                  onClick={() => toggleTransport(c.value)}
                  className={transport.includes(c.value) ? ui.choiceChipOn : ui.choiceChip}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      }
      footer={
        <>
          <button type="button" onClick={onBack} className="text-sm text-ink-2 transition-colors hover:text-ink">← Back</button>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                onChange({ entryPorts: [] })
                onContinue()
              }}
              className="text-sm text-ink-2 transition-colors hover:text-ink"
            >
              Not sure, skip
            </button>
            <button type="submit" className={`${ui.btnPrimary} shrink-0 px-6 py-3.5 text-[15px]`}>
              {primaryLabel}
            </button>
          </div>
        </>
      }
      panel={
        <>
          <p className={ui.eyebrow}>Port watch</p>
          <p key={`${entryPorts.length}:${withNews}`} className="animate-[fadeIn_150ms_ease-out] font-serif text-[28px] leading-[1.2] text-ink" aria-live="polite">
            {portWatchHeadline(entryPorts.length, withNews)}
          </p>
          {entryPorts.slice(0, MAX_PORT_CARDS).map(id => {
            const top = matches[id]?.[0]
            return (
              <article key={id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-[18px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-ink">{portName(id)}</span>
                  {top ? <SeverityChip severity={top.severity} /> : <span className={`${ui.chip} ${ui.chipPositive}`}>CLEAR</span>}
                </div>
                <p className="text-sm leading-relaxed text-ink-2">{top ? top.title : "Nothing reported here today."}</p>
                {top && <p className="text-xs text-ink-3">{eventMeta(top)}</p>}
              </article>
            )
          })}
          {entryPorts.length > MAX_PORT_CARDS && (
            <p className={ui.meta}>Showing {MAX_PORT_CARDS} of your {entryPorts.length} entry points.</p>
          )}
          <p className="text-[13px] leading-relaxed text-ink-3">
            Without ports, Foreglow matches events by region only. Adding them is the biggest single improvement to your alerts.
          </p>
        </>
      }
    />
  )
}
