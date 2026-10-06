"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { relevantStructuralRisks, StructuralRisk, StructuralRiskSeverity } from "@/lib/structuralRisk"
import { ui } from "@/lib/ui"

// App-wide severity system: Critical → critical, Elevated → warning, Watch → monitor.
const SEVERITY_CHIP: Record<StructuralRiskSeverity, string> = {
  Critical: ui.chipCritical,
  Elevated: ui.chipWarning,
  Watch: ui.chipMonitor,
}

export default function StructuralRiskCard() {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded || !profile || profile.suppliers.length === 0) return null

  const relevant = relevantStructuralRisks(profile)
  // Nothing curated matches this profile's trade lanes or supplier categories, so
  // there's nothing sourced to show. The AI Risk Radar (AIRiskRadarCard) is
  // independently profile-scoped and covers that case on its own.
  if (relevant.length === 0) return null

  const expanded = relevant.filter(r => r.severity === "Critical" || r.severity === "Elevated")
  const collapsed = relevant.filter(r => r.severity === "Watch")

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-x-10 gap-y-1">
        <h2 className={ui.h2}>Long-term structural risk</h2>
        <p className={`${ui.meta} max-w-2xl md:text-right`}>
          Standing chokepoints, single-source materials, and capacity concentration — distinct
          from today&apos;s news feed above. These don&apos;t change day to day, but they shape
          how bad a disruption can get when one hits.
        </p>
      </div>

      {expanded.length > 0 && (
        <div className="grid md:grid-cols-3 gap-4">
          {expanded.map(risk => (
            <StructuralRiskRow key={risk.id} risk={risk} />
          ))}
        </div>
      )}

      {collapsed.length > 0 && (
        <div>
          {collapsed.map(risk => (
            <div key={risk.id} className="flex items-center justify-between gap-3 py-2 border-t border-line-soft">
              <div>
                <p className="text-sm text-ink">{risk.name}</p>
                <p className="text-xs text-ink-3">{risk.riskType}</p>
              </div>
              <span className={`${ui.chip} ${SEVERITY_CHIP.Watch} flex-shrink-0`}>WATCH</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-ink-3">
        Manually verified reference data, last checked{" "}
        {new Date(relevant[0].lastVerified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}
        {relevant.map((r, i) => (
          <span key={r.id}>
            <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-ember">
              {r.name} source ({r.sourceLabel})
            </a>
            {i < relevant.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </section>
  )
}

function StructuralRiskRow({ risk }: { risk: StructuralRisk }) {
  return (
    <article className={`${ui.cardInner} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-ink-3">{risk.riskType}</p>
        <span className={`${ui.chip} ${SEVERITY_CHIP[risk.severity]} flex-shrink-0`}>
          {risk.severity.toUpperCase()}
        </span>
      </div>
      <h3 className={ui.h3}>{risk.name}</h3>
      <p className="text-sm leading-relaxed text-ink-2">{risk.description}</p>
    </article>
  )
}
