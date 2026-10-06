"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { StructuralRiskRadarResponse, RadarFinding } from "@/app/api/structural-risk-radar/route"
import { ui } from "@/lib/ui"

export default function AIRiskRadarCard() {
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

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-x-10 gap-y-1">
        <h2 className={ui.h2}>AI risk radar</h2>
        <p className={`${ui.meta} max-w-2xl md:text-right`}>
          Gemini with live Google Search, scoped to your supplier categories. AI-sourced and
          unverified: confirm before acting.
        </p>
      </div>

      {isLoading && (
        <div className="grid md:grid-cols-2 gap-4" aria-busy="true">
          <div className={`${ui.skeleton} h-32 rounded-[10px]`} />
          <div className={`${ui.skeleton} h-32 rounded-[10px]`} />
        </div>
      )}

      {!isLoading && error && (
        <p className={ui.errorBox}>Could not reach the AI risk radar right now. Try refreshing.</p>
      )}

      {!isLoading && !error && radar && radar.findings.length === 0 && (
        <p className={ui.emptyText}>
          No new structural risks surfaced for your current supplier categories.
        </p>
      )}

      {!isLoading && !error && radar && radar.findings.length > 0 && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {radar.findings.map((finding, i) => (
              <RadarFindingRow key={i} finding={finding} />
            ))}
          </div>
          <p className="text-xs leading-relaxed text-ink-3">
            AI-sourced · unverified, refreshed {new Date(radar.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {radar.isStale ? " (cached)" : ""}.{" "}
            {radar.sources.length > 0 && (
              <>
                Search sources:{" "}
                {radar.sources.map((s, i) => (
                  <span key={s.uri}>
                    <a href={s.uri} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-ember">
                      {s.title}
                    </a>
                    {i < radar.sources.length - 1 ? " · " : ""}
                  </span>
                ))}
              </>
            )}
          </p>
        </>
      )}
    </section>
  )
}

function RadarFindingRow({ finding }: { finding: RadarFinding }) {
  return (
    <article className={`${ui.cardInner} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{finding.riskType}</p>
        <span className={`${ui.chip} ${ui.chipAi} flex-shrink-0`}>AI-SOURCED</span>
      </div>
      <h3 className={ui.h3}>{finding.name}</h3>
      <p className="text-sm leading-relaxed text-ink-2">{finding.description}</p>
      <p className="text-sm leading-relaxed text-ember-deep">{finding.relevanceToProfile}</p>
    </article>
  )
}
