"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { ScenarioInput } from "@/app/api/scenario/route"

interface ScenarioPlannerProps {
  events: ScoredEvent[]
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

export default function ScenarioPlanner({ events }: ScenarioPlannerProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const [isOpen, setIsOpen] = useState(false)
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
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🔮</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            Scenario Planner
          </h2>
          <span className="text-xs text-slate-500 ml-1">What-If Analysis</span>
        </div>
        <div className="text-center py-4">
          <p className="text-slate-400 text-sm mb-3">
            Model disruption scenarios against your specific supply chain.
            Requires a company profile to calculate inventory impact.
          </p>
          <Link
            href="/profile"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white
                       text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Set Up Profile to Unlock →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-6 py-4
                   hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔮</span>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-widest">
            Scenario Planner
          </h2>
          <span className="text-xs text-slate-500 ml-1">What-If Analysis</span>
          {hasResult && (
            <span className="text-xs bg-green-900 text-green-400 border
                             border-green-700 px-2 py-0.5 rounded-full ml-2">
              Analysis ready
            </span>
          )}
        </div>
        <span className="text-slate-500 text-sm">
          {isOpen ? "▲ Collapse" : "▼ Run a scenario"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-700 p-6">
          {!hasResult ? (
            // Input form
            <div className="space-y-5">
              <p className="text-slate-400 text-sm">
                Model a disruption scenario against{" "}
                <span className="text-white font-medium">
                  {profile?.companyName}
                </span>
                {" "}to see projected impact and recommended actions.
              </p>

              {/* Disruption type */}
              <div>
                <label className="block text-xs font-semibold text-slate-400
                                  uppercase tracking-wider mb-2">
                  What type of disruption?
                </label>
                <select
                  value={scenario.disruptionType}
                  onChange={e =>
                    setScenario(s => ({ ...s, disruptionType: e.target.value }))
                  }
                  className="w-full bg-slate-700 border border-slate-600
                             rounded-lg px-3 py-2 text-sm text-slate-200
                             focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select disruption type...</option>
                  {DISRUPTION_TYPES.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              {/* Affected region with quick-fill */}
              <div>
                <label className="block text-xs font-semibold text-slate-400
                                  uppercase tracking-wider mb-2">
                  Where? (region or specific country)
                </label>
                <input
                  type="text"
                  value={scenario.affectedRegion}
                  onChange={e =>
                    setScenario(s => ({ ...s, affectedRegion: e.target.value }))
                  }
                  placeholder="e.g. Vietnam, Asia Pacific, Strait of Hormuz..."
                  className="w-full bg-slate-700 border border-slate-600
                             rounded-lg px-3 py-2 text-sm text-slate-200
                             placeholder-slate-500 focus:outline-none
                             focus:border-blue-500 mb-2"
                />
                {supplierCountries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-slate-600">Your suppliers:</span>
                    {supplierCountries.map(c => (
                      <button
                        key={c}
                        onClick={() =>
                          setScenario(s => ({ ...s, affectedRegion: c }))
                        }
                        className="text-xs bg-slate-700 hover:bg-slate-600
                                   text-amber-400 border border-slate-600
                                   px-2 py-0.5 rounded-full transition-colors"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="block text-xs font-semibold text-slate-400
                                  uppercase tracking-wider mb-2">
                  How long does it last?
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map(d => (
                    <button
                      key={d.value}
                      onClick={() =>
                        setScenario(s => ({ ...s, durationWeeks: d.value }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-sm border
                                  transition-colors ${
                        scenario.durationWeeks === d.value
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-slate-700 border-slate-600 text-slate-300 hover:border-slate-500"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Response action */}
              <div>
                <label className="block text-xs font-semibold text-slate-400
                                  uppercase tracking-wider mb-2">
                  What&apos;s your planned response?
                </label>
                <select
                  value={scenario.responseAction}
                  onChange={e =>
                    setScenario(s => ({ ...s, responseAction: e.target.value }))
                  }
                  className="w-full bg-slate-700 border border-slate-600
                             rounded-lg px-3 py-2 text-sm text-slate-200
                             focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select your response...</option>
                  {RESPONSE_ACTIONS.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Optional custom context */}
              <div>
                <label className="block text-xs font-semibold text-slate-400
                                  uppercase tracking-wider mb-2">
                  Additional context{" "}
                  <span className="text-slate-600 normal-case font-normal">(optional)</span>
                </label>
                <textarea
                  value={scenario.customContext}
                  onChange={e =>
                    setScenario(s => ({ ...s, customContext: e.target.value }))
                  }
                  placeholder="Any other details about this scenario, your current situation, or specific concerns..."
                  rows={2}
                  className="w-full bg-slate-700 border border-slate-600
                             rounded-lg px-3 py-2 text-sm text-slate-200
                             placeholder-slate-500 focus:outline-none
                             focus:border-blue-500 resize-none"
                />
              </div>

              {/* Run button */}
              <button
                onClick={runScenario}
                disabled={!canRun || isStreaming}
                className="w-full bg-blue-600 hover:bg-blue-500
                           disabled:opacity-40 disabled:cursor-not-allowed
                           text-white font-medium py-3 rounded-lg
                           transition-colors flex items-center justify-center gap-2"
              >
                {isStreaming ? (
                  <>
                    <span className="animate-spin inline-block">↻</span>
                    Analyzing your supply chain...
                  </>
                ) : (
                  "🔮 Run Scenario Analysis"
                )}
              </button>
            </div>
          ) : (
            // Results view
            <div>
              {/* Scenario summary badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs bg-slate-700 text-slate-300
                                 border border-slate-600 px-2 py-1 rounded-lg">
                  📍 {scenario.affectedRegion}
                </span>
                <span className="text-xs bg-slate-700 text-slate-300
                                 border border-slate-600 px-2 py-1 rounded-lg">
                  ⚠️ {scenario.disruptionType}
                </span>
                <span className="text-xs bg-slate-700 text-slate-300
                                 border border-slate-600 px-2 py-1 rounded-lg">
                  ⏱ {DURATION_OPTIONS.find(d => d.value === scenario.durationWeeks)?.label}
                </span>
                <span className="text-xs bg-slate-700 text-slate-300
                                 border border-slate-600 px-2 py-1 rounded-lg">
                  🎯 {scenario.responseAction}
                </span>
              </div>

              {/* Streaming result */}
              <div className="bg-slate-900 border border-slate-700 rounded-lg
                              p-5 text-sm text-slate-200 leading-relaxed
                              whitespace-pre-wrap min-h-32">
                {result}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 bg-blue-400
                                   ml-0.5 animate-pulse rounded-sm align-middle" />
                )}
              </div>

              {/* Actions */}
              {!isStreaming && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={resetScenario}
                    className="flex-1 bg-slate-700 hover:bg-slate-600
                               text-slate-300 text-sm font-medium py-2
                               rounded-lg transition-colors border border-slate-600"
                  >
                    ← Run Another Scenario
                  </button>
                  <button
                    onClick={() => {
                      const durationLabel =
                        DURATION_OPTIONS.find(d => d.value === scenario.durationWeeks)?.label ?? ""
                      const text =
                        `SCENARIO ANALYSIS — ${profile?.companyName}\n` +
                        `Disruption: ${scenario.disruptionType}\n` +
                        `Region: ${scenario.affectedRegion}\n` +
                        `Duration: ${durationLabel}\n` +
                        `Response: ${scenario.responseAction}\n\n` +
                        result
                      navigator.clipboard.writeText(text)
                    }}
                    className="flex-1 bg-slate-700 hover:bg-slate-600
                               text-slate-300 text-sm font-medium py-2
                               rounded-lg transition-colors border border-slate-600"
                  >
                    📋 Copy Analysis
                  </button>
                </div>
              )}

              <p className="text-xs text-slate-600 mt-3 text-center">
                Powered by Gemini 2.5 Flash · Based on your company profile and {events.length} live events
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
