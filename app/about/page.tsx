import type { Metadata } from "next"
import Navbar from "@/components/Navbar"
import SiteFooter from "@/components/SiteFooter"
import { BRAND } from "@/lib/brand"
import { ui } from "@/lib/ui"

export const metadata: Metadata = {
  title: "About",
}

const linkClass = "text-ember underline transition-colors hover:text-ember-deep"

const DATA_SOURCES: { name: string; href: string; what: string }[] = [
  {
    name: "Trade press (RSS)",
    href: "https://www.supplychaindive.com/",
    what:
      "Supply Chain Dive, FreightWaves, The Maritime Executive, gCaptain, Splash247 and JOC. The primary source for port, tariff, labor and geopolitical news.",
  },
  {
    name: "GDELT Project",
    href: "https://www.gdeltproject.org/",
    what: "Global news monitoring across thousands of sources, queried for supply chain, port and trade-policy coverage.",
  },
  {
    name: "GDACS",
    href: "https://www.gdacs.org/",
    what: "Global disaster alerts: earthquakes, tropical cyclones, floods, volcanoes, droughts and wildfires.",
  },
  {
    name: "NOAA National Weather Service",
    href: "https://www.weather.gov/",
    what: "US severe-weather warnings, filtered to event types that disrupt freight (hurricanes, floods, blizzards and similar).",
  },
  {
    name: "Yahoo Finance",
    href: "https://finance.yahoo.com/",
    what: "Commodity futures (crude oil, natural gas, copper, wheat) and currency rates for your supplier countries.",
  },
  {
    name: "USITC Harmonized Tariff Schedule",
    href: "https://hts.usitc.gov/",
    what: "Published US duty rates, looked up by the HS code on each product line.",
  },
  {
    name: "Google Gemini 2.5 Flash",
    href: "https://ai.google.dev/",
    what: "Summaries, recommendations, scenario analysis and the AI risk radar (with live Google Search grounding).",
  },
]

const SEVERITY_ROWS: { chip: string; label: string; score: number; keywords: string }[] = [
  { chip: ui.chipCritical, label: "CRITICAL", score: 3, keywords: "strike, closure, sanctions, blocked, halt, shutdown, ban" },
  { chip: ui.chipWarning, label: "WARNING", score: 2, keywords: "delay, shortage, disruption, tariff, congestion, reduced" },
  { chip: ui.chipMonitor, label: "MONITOR", score: 1, keywords: "All other events" },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-paper">
      <Navbar />
      <article className="max-w-3xl mx-auto px-4 py-14 space-y-12">
        <header className="space-y-3">
          <p className={ui.eyebrow}>About</p>
          <h1 className={ui.h1}>About {BRAND.name}</h1>
          <p className="text-lg leading-relaxed text-ink-2">{BRAND.description}</p>
        </header>

        <section className="space-y-3">
          <h2 className={ui.h2}>What it does</h2>
          <p className={ui.body}>
            {BRAND.name} watches the news, weather and trade policy that touch your suppliers. It
            scores each event against your company profile (supplier countries, trade lanes and
            product lines), traces how a disruption would cascade through your supplier tiers and
            raw materials, and turns that into inventory alerts, recommendations and what-if
            scenarios you can act on.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className={ui.h2}>Where the data comes from</h2>
          <dl className="divide-y divide-line-soft border-y border-line-soft">
            {DATA_SOURCES.map(source => (
              <div key={source.name} className="grid sm:grid-cols-[200px_1fr] gap-x-6 gap-y-1 py-3.5">
                <dt className="text-[15px] font-semibold text-ink">
                  <a href={source.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {source.name}
                  </a>
                </dt>
                <dd className={ui.body}>{source.what}</dd>
              </div>
            ))}
          </dl>
          <p className={ui.meta}>
            Container freight rates are manually verified reference figures, not a live feed. The
            labor-contract calendar and long-term structural risk list are hand-curated, each entry
            sourced and dated.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className={ui.h2}>How AI is used, and its limits</h2>
          <p className={ui.body}>
            Gemini writes the daily summary, the per-event briefs, the advisor&apos;s
            recommendations, cost estimates and scenario analyses, always from your profile and
            today&apos;s events. Numbers that can be computed (inventory days, concentration,
            downstream impact paths) are calculated in code first and given to the model as fact.
          </p>
          <p className={ui.body}>
            AI output can be wrong. Anything marked AI-sourced is unverified: check the cited
            sources before acting. Nothing here is financial, legal or compliance advice.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className={ui.h2}>Severity methodology</h2>
          <p className={ui.body}>
            News headlines are scored by keyword, matched at word boundaries. Disaster and
            weather alerts use the severity their source publishes.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wider text-ink-3">
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Level</th>
                  <th scope="col" className="py-2.5 pr-4 font-semibold">Score</th>
                  <th scope="col" className="py-2.5 font-semibold">Keywords</th>
                </tr>
              </thead>
              <tbody>
                {SEVERITY_ROWS.map(row => (
                  <tr key={row.label} className="border-t border-line-soft">
                    <td className="py-3.5 pr-4">
                      <span className={`${ui.chip} ${row.chip}`}>{row.label}</span>
                    </td>
                    <td className="py-3.5 pr-4 text-[15px] text-ink tabular-nums">{row.score}</td>
                    <td className="py-3.5 text-[15px] text-ink-2">{row.keywords}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className={ui.meta}>Built by Balraj Kooner.</p>
      </article>
      <SiteFooter />
    </main>
  )
}
