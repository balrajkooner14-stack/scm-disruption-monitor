"use client"

import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { LABOR_CONTRACTS, contractsWithinWindow, daysUntil } from "@/lib/laborCalendar"
import { ui } from "@/lib/ui"

export default function LaborCalendarCard() {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded || !profile || profile.tradeLanes.length === 0) return null

  const relevant = LABOR_CONTRACTS.filter(c =>
    c.tradeLanesAffected.some(l => profile.tradeLanes.includes(l))
  )
  if (relevant.length === 0) return null

  // contractsWithinWindow only tests `daysUntil <= windowDays`, so an already-expired
  // contract (negative days) passes it and would render as "expires in -412 days".
  // Filtering to >= 0 here keeps lib/laborCalendar.ts untouched.
  const imminent = contractsWithinWindow(profile.tradeLanes, 180)
    .filter(c => daysUntil(c.contractExpirationDate) >= 0)

  // Deliberately renders nothing unless an expiration is actually 0-180 days out —
  // a contract expiring years from now is not news and was crowding the Overview
  // tab. Both currently-tracked contracts (ILWU/PMA 2028-07-01, ILA/USMX
  // 2030-09-30) are outside that window, so this card is dormant until roughly
  // Jan 2028. That's expected, not a bug.
  if (imminent.length === 0) return null

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div className="space-y-1">
        <h2 className={ui.h2}>Labor contract calendar</h2>
        <p className={ui.meta}>
          Port strikes cluster around known union contract expirations, not randomly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {imminent.map(c => (
          <article key={c.union} className={`${ui.cardInner} flex flex-col gap-2`}>
            <span className={`${ui.chip} ${ui.chipWarning} self-start`}>
              EXPIRES IN {daysUntil(c.contractExpirationDate)} DAYS
            </span>
            <h3 className={ui.h3}>{c.union}/{c.counterparty} contract</h3>
            <p className="text-sm leading-relaxed text-ink-2">
              {c.ports} — historically elevated labor risk around expiration.
            </p>
          </article>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-ink-3">
        Manually verified reference data, last checked{" "}
        {new Date(relevant[0].lastVerified).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}
        {relevant.map((c, i) => (
          <span key={c.union}>
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline transition-colors hover:text-ember">
              {c.union} source ({c.sourceLabel})
            </a>
            {i < relevant.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </section>
  )
}
