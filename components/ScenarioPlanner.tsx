"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { ScenarioInput } from "@/app/api/scenario/route"
import { ui } from "@/lib/ui"

interface ScenarioPlannerProps {
  events: ScoredEvent[]
  defaultOpen?: boolean
}

const DISRUPTION_TYPES = [
  "Port closure or severe congestion",
  "Supplier bankruptcy or shutdown",
  "Major labor strike",
  "New tariffs or trade sanctions",
  "Natural disaster (earthquake/flood/storm)",
  "Geopolitical conflict / border closure",
  "Logistics network collapse (freight rates spike)",
  "Raw material shortage",
  "Cyber attack on supply chain",
  "Pandemic-level demand shock",
]

const DURATION_OPTIONS = [
  { value: 1, label: "1 week" },
  { value: 2, label: "2 weeks" },
  { value: 4, label: "1 month" },
  { value: 8, label: "2 months" },
  { value: 12, label: "3 months" },
]

const RESPONSE_ACTIONS = [
  "Increase safety stock immediately",
  "Find and qualify alternate suppliers",
  "Switch to air freight from ocean",
  "Activate secondary supplier",
  "Reduce production output temporarily",
  "Pass costs to customers via price increase",
  "Do nothing and monitor the situation",
  "Custom response (describe below)",
]

// Display-only formatting of the streamed analysis: numbered section titles
// become headings, "- "/"* "/"• " lines become bullets, markdown bold markers
// are dropped. The raw text (used by "Copy analysis") is untouched.
const HEADING_RE = /^\d\.\s+[A-Z][A-Z0-9 ,/&()'-]+(\(.*\))?:?$/
const BULLET_RE = /^\s*(?:[-*•]|\d+[.)])\s+/

function sentenceCase(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function ScenarioResult({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <>
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim()
        if (!line) return null
        if (HEADING_RE.test(line)) {
          const title = line.replace(/^\d\.\s+/, "").replace(/:$/, "")
          return (
            <h3 key={i} className={`${ui.h3} mt-5 first:mt-0 mb-2`}>
              {sentenceCase(title)}
            </h3>
          )
        }
        if (BULLET_RE.test(line) && !HEADING_RE.test(line)) {
          return (
            <p key={i} className={`${ui.body} flex gap-2 pl-1`}>
              <span className="text-ember flex-shrink-0" aria-hidden="true">•</span>
              <span>{line.replace(BULLET_RE, "")}</span>
            </p>
          )
        }
        return (
          <p key={i} className={`${ui.body} mb-2`}>
            {line}
          </p>
        )
      })}
    </>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-180" : ""}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

export default function ScenarioPlanner({ events, defaultOpen }: ScenarioPlannerProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [result, setResult] = useState<string>("")
  const [hasResult, setHasResult] = useState(false)
  const [scenario, setScenario] = useState<ScenarioInput>({
    disruptionType: "",
    affectedRegion: "",
    durationWeeks: 4,
    responseAction: "",
    customContext: "",
  })
  const abortRef = useRef<AbortController | null>(null)

  // Quick-fill options from profile suppliers
  const supplierCountries = profile
    ? Array.from(new Set(profile.suppliers.map(s => s.country)))
    : []

  const canRun =
    scenario.disruptionType !== "" &&
    scenario.affectedRegion !== "" &&
    scenario.durationWeeks > 0 &&
    scenario.responseAction !== "" &&
    !!profile

  const runScenario = async () => {
    if (!canRun || isStreaming) return
    setIsStreaming(true)
    setResult("")
    setHasResult(false)
    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, profile, events }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error("Scenario request failed")
      if (!res.body) throw new Error("No response body")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setResult(accumulated)
      }

      setHasResult(true)
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setResult("Failed to generate scenario analysis. Please try again.")
      setHasResult(true)
    } finally {
      setIsStreaming(false)
    }
  }

  const resetScenario = () => {
    if (isStreaming) abortRef.current?.abort()
    setResult("")
    setHasResult(false)
    setIsStreaming(false)
  }

  // No profile state
  if (isLoaded && !profile) {
    return (
      <section className={`${ui.card} p-7 space-y-3`}>
        <h2 className={ui.h2}>What if…</h2>
        <p className={ui.body}>
          Model disruption scenarios against your specific supply chain.
          Requires a company profile to calculate inventory impact.
        </p>
        <Link href="/profile" className={ui.btnAccent}>
          Set up your profile
        </Link>
      </section>
    )
  }

  const durationLabel = DURATION_OPTIONS.find(d => d.value === scenario.durationWeeks)?.label

  return (
    <section className={`${ui.card} p-7 flex flex-col gap-5`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <h2 className={ui.h2}>What if…</h2>
            {hasResult && <span className={`${ui.chip} ${ui.chipPositive}`}>ANALYSIS READY</span>}
          </div>
          <p className={ui.body}>
            Model a disruption against {profile?.companyName ?? "your"}&apos;s network and get the
            projected impact and a response plan.
          </p>
        </div>
        <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} className={ui.btnGhost}>
          <Chevron open={isOpen} />
          {isOpen ? "Collapse" : "Run a scenario"}
        </button>
      </div>

      {isOpen && (
        <div>
          {!hasResult ? (
            // Input form
            <div className="space-y-5">
              <div className="grid md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label htmlFor="scenario-type" className={`block ${ui.label}`}>Type of disruption</label>
                  <select
                    id="scenario-type"
                    value={scenario.disruptionType}
                    onChange={e =>
                      setScenario(s => ({ ...s, disruptionType: e.target.value }))
                    }
                    className={ui.input}
                  >
                    <option value="">Select disruption type…</option>
                    {DISRUPTION_TYPES.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="scenario-where" className={`block ${ui.label}`}>Where</label>
                  <input
                    id="scenario-where"
                    type="text"
                    value={scenario.affectedRegion}
                    onChange={e =>
                      setScenario(s => ({ ...s, affectedRegion: e.target.value }))
                    }
                    placeholder="e.g. Vietnam, Asia Pacific, Strait of Hormuz"
                    className={ui.input}
                  />
                </div>
              </div>

              {supplierCountries.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className={ui.meta}>Your supplier countries:</span>
                  {supplierCountries.map(c => (
                    <button
                      key={c}
                      onClick={() => setScenario(s => ({ ...s, affectedRegion: c }))}
                      aria-pressed={scenario.affectedRegion === c}
                      className={scenario.affectedRegion === c ? ui.pillActive : ui.pill}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <p className={ui.label} id="scenario-duration">How long</p>
                <div className="flex gap-2 flex-wrap" role="group" aria-labelledby="scenario-duration">
                  {DURATION_OPTIONS.map(d => {
                    const selected = scenario.durationWeeks === d.value
                    return (
                      <button
                        key={d.value}
                        onClick={() => setScenario(s => ({ ...s, durationWeeks: d.value }))}
                        aria-pressed={selected}
                        className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                          selected
                            ? "border-ink bg-ink text-paper"
                            : "border-line-strong text-ink hover:border-ink"
                        }`}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="scenario-response" className={`block ${ui.label}`}>Planned response</label>
                <select
                  id="scenario-response"
                  value={scenario.responseAction}
                  onChange={e =>
                    setScenario(s => ({ ...s, responseAction: e.target.value }))
                  }
                  className={ui.input}
                >
                  <option value="">Select your response…</option>
                  {RESPONSE_ACTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="scenario-context" className={`block ${ui.label}`}>
                  Additional context (optional)
                </label>
                <textarea
                  id="scenario-context"
                  value={scenario.customContext}
                  onChange={e =>
                    setScenario(s => ({ ...s, customContext: e.target.value }))
                  }
                  placeholder="Any other details about this scenario, your current situation, or specific concerns"
                  rows={2}
                  className={`${ui.input} resize-none`}
                />
              </div>

              <button
                onClick={runScenario}
                disabled={!canRun || isStreaming}
                className={`${ui.btnAccent} px-6 py-3.5 text-[15px] disabled:cursor-not-allowed`}
              >
                {isStreaming ? "Analyzing your supply chain…" : "Run scenario"}
              </button>
            </div>
          ) : (
            // Results view
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[scenario.affectedRegion, scenario.disruptionType, durationLabel, scenario.responseAction]
                  .filter(Boolean)
                  .map(label => (
                    <span key={label} className={`${ui.chip} ${ui.chipNeutral}`}>{label}</span>
                  ))}
              </div>

              <div className={`${ui.cardInner} p-6 min-h-32`} aria-live="polite">
                <ScenarioResult text={result} />
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-ink-3 ml-0.5 rounded-sm align-middle" aria-hidden="true" />
                )}
              </div>

              {!isStreaming && (
                <div className="flex flex-wrap gap-3">
                  <button onClick={resetScenario} className={ui.btnSecondary}>
                    Run another scenario
                  </button>
                  <button
                    onClick={() => {
                      const text =
                        `SCENARIO ANALYSIS — ${profile?.companyName}\n` +
                        `Disruption: ${scenario.disruptionType}\n` +
                        `Region: ${scenario.affectedRegion}\n` +
                        `Duration: ${durationLabel ?? ""}\n` +
                        `Response: ${scenario.responseAction}\n\n` +
                        result
                      navigator.clipboard.writeText(text)
                    }}
                    className={ui.btnSecondary}
                  >
                    Copy analysis
                  </button>
                </div>
              )}

              <p className="text-xs text-ink-3">
                Google Gemini 2.5 Flash · Based on your company profile and {events.length} live events · verify before acting
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
