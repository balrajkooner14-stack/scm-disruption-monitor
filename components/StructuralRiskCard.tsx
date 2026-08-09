"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { relevantStructuralRisks, StructuralRisk, StructuralRiskSeverity } from "@/lib/structuralRisk"

const SEVERITY_CONFIG: Record<StructuralRiskSeverity, { badge: string; card: string }> = {
  Critical: { badge: "bg-red-600 text-white", card: "bg-red-950/40 border-red-800" },
  Elevated: { badge: "bg-amber-600 text-white", card: "bg-amber-950/40 border-amber-800" },
  Watch: { badge: "bg-slate-600 text-slate-200", card: "bg-slate-900/40 border-slate-700" },
}

export default function StructuralRiskCard() {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded || !profile) return null

  const relevant = relevantStructuralRisks(profile)
  if (relevant.length === 0) return null

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
