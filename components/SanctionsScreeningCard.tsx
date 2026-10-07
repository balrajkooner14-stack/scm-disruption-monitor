"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import type { SanctionsMatch } from "@/lib/sanctionsScreening"
import { ui } from "@/lib/ui"

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
    <section className={`${ui.card} flex flex-col gap-3`}>
      <div className="space-y-1">
        <h2 className={ui.h3}>Sanctions screening</h2>
        <p className={ui.meta}>
          Checks your suppliers&apos; names against the US Treasury OFAC Specially
          Designated Nationals (SDN) list.
        </p>
      </div>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          {profile.suppliers.map(s => (
            <div key={s.id} className={`${ui.skeleton} h-8`} />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <p className={ui.errorBox}>Could not reach the OFAC sanctions list right now. Try refreshing.</p>
      )}

      {!isLoading && !error && matches !== null && (
        <div>
          {profile.suppliers.map(supplier => {
            const match = matches.find(m => m.supplierId === supplier.id)
            return (
              <div key={supplier.id} className="py-2.5 border-t border-line-soft space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{supplier.name}</span>
                  {match ? (
                    <span className={`${ui.chip} ${ui.chipWarning}`}>POSSIBLE MATCH — VERIFY MANUALLY</span>
                  ) : (
                    <span className={`${ui.chip} ${ui.chipPositive}`}>NO MATCH FOUND</span>
                  )}
                </div>
                {match && (
                  <p className="text-xs leading-relaxed text-ochre">
                    Closest OFAC entry: &quot;{match.matchedName}&quot; — this is an
                    automated name comparison only, not a confirmed match. Verify
                    directly against the{" "}
                    <a
                      href="https://sanctionssearch.ofac.treas.gov/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:text-ember"
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

      <p className="text-xs leading-relaxed text-ink-3">
        Automated name matching against ~
        {matches ? "19,000" : "the current"} SDN entries, by name only (no
        address/country cross-check in this pass). This is a screening aid,
        not a legal or compliance determination — always verify independently
        and consult counsel before acting on a possible match.
        {matchedIds.size === 0 && matches !== null && " No matches found for your current supplier list."}
      </p>
    </section>
  )
}
