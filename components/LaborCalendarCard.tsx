"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { LABOR_CONTRACTS, contractsWithinWindow, daysUntil } from "@/lib/laborCalendar"

export default function LaborCalendarCard() {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded || !profile || profile.tradeLanes.length === 0) return null

  const relevant = LABOR_CONTRACTS.filter(c =>
    c.tradeLanesAffected.some(l => profile.tradeLanes.includes(l))
  )
  if (relevant.length === 0) return null

  const imminent = contractsWithinWindow(profile.tradeLanes, 180)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">📅</span>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Labor Contract Calendar
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Port strikes cluster around known union contract expirations, not randomly.
      </p>

      {imminent.length > 0 ? (
        <div className="space-y-2">
          {imminent.map(c => (
            <div key={c.union} className="bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
              <p className="text-sm text-amber-300 font-medium">
                ⚠ {c.union}/{c.counterparty} contract expires in {daysUntil(c.contractExpirationDate)} days
              </p>
              <p className="text-xs text-amber-500/80 mt-0.5">{c.ports} — historically elevated labor risk around expiration.</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {relevant.map(c => (
            <div key={c.union} className="flex items-center justify-between bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm text-slate-300">{c.union} / {c.counterparty}</p>
                <p className="text-xs text-slate-500">{c.ports}</p>
              </div>
              <p className="text-xs text-slate-400">
                Expires {new Date(c.contractExpirationDate).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" })}
              </p>
            </div>
          ))}
          <p className="text-xs text-slate-600 mt-1">
            No expirations within 180 days — both major contracts were recently renewed.
          </p>
        </div>
      )}

      <p className="text-xs text-slate-600 mt-3 leading-relaxed">
        Manually verified reference data, last checked{" "}
        {new Date(relevant[0].lastVerified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}
        {relevant.map((c, i) => (
          <span key={c.union}>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-400">
              {c.union} source ({c.sourceLabel})
            </a>
            {i < relevant.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </div>
  )
}
