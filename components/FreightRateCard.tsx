"use client"

import type { FreightRate } from "@/app/api/market-data/route"
import { formatSignedPercent } from "@/components/MarketRow"
import { ui } from "@/lib/ui"

interface FreightRateCardProps {
  rates: FreightRate[]
}

export default function FreightRateCard({ rates }: FreightRateCardProps) {
  const fmt = new Intl.NumberFormat("en-US")
  const verifiedDate = rates[0]?.lastVerified
    ? new Date(rates[0].lastVerified).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "unknown"

  return (
    <section className={`${ui.card} flex flex-col gap-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className={ui.h2}>Container freight rates</h2>
        <span className={`${ui.chip} ${ui.chipNeutral}`}>Reference · not live · as of {verifiedDate}</span>
      </div>

      {rates.length === 0 ? (
        <p className={ui.emptyText}>No reference freight rates available.</p>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
          {rates.map((r) => (
            <div key={r.lane} className={`${ui.cardInner} flex flex-col gap-1.5`}>
              <p className="text-[13px] text-ink-2">{r.lane}</p>
              <p className="font-serif text-3xl text-ink tabular-nums">${fmt.format(r.rate)}</p>
              <p className="text-xs text-ink-3">{r.unit} · {formatSignedPercent(r.change)}</p>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-3">
        Manually verified reference rates as of {verifiedDate} — not a live feed
        (no free live ocean freight index exists). Rising rates signal
        congestion or capacity crunch as of that check.
      </p>
    </section>
  )
}
