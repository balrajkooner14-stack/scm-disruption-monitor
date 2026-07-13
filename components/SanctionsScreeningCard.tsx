"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { SanctionsMatch } from "@/lib/sanctionsScreening"

export default function SanctionsScreeningCard() {
  const { profile, isLoaded } = useCompanyProfile()
  const [matches, setMatches] = useState<SanctionsMatch[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const [hasFetched, setHasFetched] = useState(false)

  useEffect(() => {
    if (!isLoaded || !profile || profile.suppliers.length === 0 || hasFetched) return
    setHasFetched(true)
    setIsLoading(true)
    setError(false)

    fetch("/api/sanctions-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        suppliers: profile.suppliers.map(s => ({ id: s.id, name: s.name })),
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed")
        return res.json()
      })
      .then(data => setMatches(data.matches ?? []))
      .catch(() => setError(true))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, profile, hasFetched])

  if (!isLoaded || !profile || profile.suppliers.length === 0) return null

  const matchedIds = new Set((matches ?? []).map(m => m.supplierId))

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🔍</span>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Sanctions Screening
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Checks your suppliers&apos; names against the US Treasury OFAC Specially
        Designated Nationals (SDN) list.
      </p>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {profile.suppliers.map(s => (
            <div key={s.id} className="h-8 bg-slate-700/50 rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-3">
          <p className="text-xs text-red-400">
            Could not reach the OFAC sanctions list right now. Try refreshing.
          </p>
        </div>
      )}

      {!isLoading && !error && matches !== null && (
        <div className="space-y-2">
          {profile.suppliers.map(supplier => {
            const match = matches.find(m => m.supplierId === supplier.id)
            return (
              <div
                key={supplier.id}
                className={`rounded-lg px-3 py-2 border ${
                  match
                    ? "bg-amber-950/40 border-amber-800"
                    : "bg-slate-900/40 border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">{supplier.name}</span>
                  {match ? (
                    <span className="text-xs font-semibold text-amber-400">
                      ⚠ Possible match — verify manually
                    </span>
                  ) : (
                    <span className="text-xs text-green-400">✓ No match found</span>
                  )}
                </div>
                {match && (
                  <p className="text-xs text-amber-500/80 mt-1">
                    Closest OFAC entry: &quot;{match.matchedName}&quot; — this is an
                    automated name comparison only, not a confirmed match. Verify
                    directly against the{" "}
                    <a
                      href="https://sanctionssearch.ofac.treas.gov/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-amber-400"
                    >
                      official OFAC Sanctions Search
                    </a>{" "}
                    before taking any action.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-slate-600 mt-4 leading-relaxed">
        Automated name matching against ~
        {matches ? "19,000" : "the current"} SDN entries, by name only (no
        address/country cross-check in this pass). This is a screening aid,
        not a legal or compliance determination — always verify independently
        and consult counsel before acting on a possible match.
        {matchedIds.size === 0 && matches !== null && " No matches found for your current supplier list."}
      </p>
    </div>
  )
}
