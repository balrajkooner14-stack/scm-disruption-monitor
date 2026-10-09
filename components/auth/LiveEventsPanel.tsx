"use client"

import { useEffect, useMemo, useState } from "react"
import type { DisruptionEvent } from "@/lib/types"
import { pickHeadlineEvents } from "@/lib/onboardingInsights"
import OnboardingMap from "@/components/onboarding/OnboardingMap"

// Right-hand panel on /signup and /login: today's real events, shown before
// we ask for anything (spec 5.3). Hidden below 1024px.

function formatNow(d: Date): string {
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" })
  const month = d.toLocaleDateString("en-US", { month: "short" })
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return `${weekday} ${d.getDate()} ${month}, ${time}`
}

export default function LiveEventsPanel({ events }: { events: DisruptionEvent[] }) {
  // Set after mount: the page is prerendered, so a render-time clock would
  // always mismatch on hydration.
  const [now, setNow] = useState<string | null>(null)
  useEffect(() => {
    setNow(formatNow(new Date()))
  }, [])

  const tiles = useMemo(() => pickHeadlineEvents(events, 3), [events])
  const hasEvents = events.length > 0

  return (
    <section
      aria-label="Today's supply chain disruptions"
      className="hidden lg:flex flex-1 flex-col justify-center gap-[22px] bg-ink text-paper px-16 py-12"
    >
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-ink-muted">
          Right now{now ? ` · ${now}` : ""}
        </p>
        <p className="flex items-center gap-2 text-[13px] text-on-ink-muted">
          <span className="h-2 w-2 rounded-full bg-[#7FA88A]" aria-hidden="true" />
          Live
        </p>
      </div>

      <h2 className="font-serif text-[40px] leading-[1.12] font-normal">
        {hasEvents
          ? `${events.length} disruption${events.length === 1 ? " is" : "s are"} moving through global supply chains today.`
          : "Foreglow watches news, weather and trade policy around the clock."}
      </h2>

      <div className="rounded-xl bg-paper p-[18px]">
        <OnboardingMap events={events} mode="heat" />
      </div>

      {hasEvents && (
        <ul className="grid grid-cols-3 gap-4">
          {tiles.map(e => (
            <li
              key={e.id}
              className="flex flex-col gap-1.5 rounded-[10px] border border-[#3A4552] px-4 py-3.5"
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-dawn">
                {e.category}
              </span>
              <span className="line-clamp-3 text-sm leading-snug">{e.title}</span>
            </li>
          ))}
        </ul>
      )}

      {hasEvents && (
        <p className="text-[15px] text-on-ink-muted">
          Which of these touch your suppliers? Add them and find out.
        </p>
      )}
    </section>
  )
}
