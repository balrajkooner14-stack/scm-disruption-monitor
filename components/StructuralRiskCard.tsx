"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { relevantStructuralRisks, StructuralRisk, StructuralRiskSeverity } from "@/lib/structuralRisk"
import type { StructuralRiskRadarResponse, RadarFinding } from "@/app/api/structural-risk-radar/route"

const SEVERITY_CONFIG: Record<StructuralRiskSeverity, { badge: string; card: string }> = {
  Critical: { badge: "bg-red-600 text-white", card: "bg-red-950/40 border-red-800" },
  Elevated: { badge: "bg-amber-600 text-white", card: "bg-amber-950/40 border-amber-800" },
  Watch: { badge: "bg-slate-600 text-slate-200", card: "bg-slate-900/40 border-slate-700" },
}

export default function StructuralRiskCard() {
  const { profile, isLoaded } = useCompanyProfile()
  const [radar, setRadar] = useState<StructuralRiskRadarResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (!isLoaded || !profile || profile.suppliers.length === 0 || hasFetched) return
    setHasFetched(true)
    setIsLoading(true)
    setError(false)

    fetch("/api/structural-risk-radar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed")
        return res.json()
      })
      .then((data: StructuralRiskRadarResponse) => setRadar(data))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, profile, hasFetched])

  if (!isLoaded || !profile || profile.suppliers.length === 0) return null

  const relevant = relevantStructuralRisks(profile)
  const expanded = relevant.filter(r => r.severity === "Critical" || r.severity === "Elevated")
  const collapsed = relevant.filter(r => r.severity === "Watch")

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🧭</span>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Long-Term Structural Risk
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Standing chokepoints, single-source materials, and capacity concentration — distinct
        from today&apos;s news feed below. These don&apos;t change day to day, but they shape
        how bad a disruption can get when one hits.
      </p>

      {relevant.length > 0 && (
        <>
          <div className="space-y-2">
            {expanded.map(risk => (
              <StructuralRiskRow key={risk.id} risk={risk} />
            ))}
          </div>

          {collapsed.length > 0 && (
            <div className="space-y-2 mt-2">
              {collapsed.map(risk => (
                <div key={risk.id} className="flex items-center justify-between bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm text-slate-300">{risk.name}</p>
                    <p className="text-xs text-slate-500">{risk.riskType}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${SEVERITY_CONFIG.Watch.badge}`}>
                    Watch
                  </span>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-600 mt-3 leading-relaxed">
            Manually verified reference data, last checked{" "}
            {new Date(relevant[0].lastVerified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}
            {relevant.map((r, i) => (
              <span key={r.id}>
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">
                  {r.name} source ({r.sourceLabel})
                </a>
                {i < relevant.length - 1 ? " · " : ""}
              </span>
            ))}
          </p>
        </>
      )}

      <div className={relevant.length > 0 ? "mt-4 pt-4 border-t border-slate-700" : ""}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm">🛰️</span>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            AI Risk Radar
          </p>
        </div>
        <p className="text-xs text-slate-600 mb-3">
          Gemini + live Google Search, scoped to your actual supplier categories and raw
          materials — surfaces emerging risks the curated list above doesn&apos;t cover yet.
          Unverified by a human — always confirm before acting.
        </p>

        {isLoading && (
          <div className="space-y-2 animate-pulse">
            <div className="h-12 bg-slate-700/50 rounded-lg" />
            <div className="h-12 bg-slate-700/50 rounded-lg" />
          </div>
        )}

        {!isLoading && error && (
          <div className="bg-red-950/50 border border-red-800 rounded-lg p-3">
            <p className="text-xs text-red-400">
              Could not reach the AI risk radar right now. Try refreshing.
            </p>
          </div>
        )}

        {!isLoading && !error && radar && radar.findings.length === 0 && (
          <p className="text-xs text-slate-600">
            No new structural risks surfaced for your current supplier categories.
          </p>
        )}

        {!isLoading && !error && radar && radar.findings.length > 0 && (
          <div className="space-y-2">
            {radar.findings.map((finding, i) => (
              <RadarFindingRow key={i} finding={finding} />
            ))}
            <p className="text-xs text-amber-500/70 leading-relaxed">
              AI-sourced · unverified, refreshed {new Date(radar.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {radar.isStale ? " (cached)" : ""}.{" "}
              {radar.sources.length > 0 && (
                <>
                  Search sources:{" "}
                  {radar.sources.map((s, i) => (
                    <span key={s.uri}>
                      <a href={s.uri} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-400">
                        {s.title}
                      </a>
                      {i < radar.sources.length - 1 ? " · " : ""}
                    </span>
                  ))}
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function StructuralRiskRow({ risk }: { risk: StructuralRisk }) {
  const config = SEVERITY_CONFIG[risk.severity]
  return (
    <div className={`${config.card} border rounded-lg px-3 py-2.5`}>
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-slate-100 leading-tight">{risk.name}</p>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${config.badge}`}>
          {risk.severity}
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-1">{risk.riskType}</p>
      <p className="text-xs text-slate-400 leading-relaxed">{risk.description}</p>
    </div>
  )
}

function RadarFindingRow({ finding }: { finding: RadarFinding }) {
  return (
    <div className="bg-amber-950/30 border border-amber-900 rounded-lg px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-slate-100 leading-tight">{finding.name}</p>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-amber-900/60 text-amber-300">
          AI-sourced
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-1">{finding.riskType}</p>
      <p className="text-xs text-slate-400 leading-relaxed">{finding.description}</p>
      <p className="text-xs text-amber-400/80 leading-relaxed mt-1">{finding.relevanceToProfile}</p>
    </div>
  )
}
