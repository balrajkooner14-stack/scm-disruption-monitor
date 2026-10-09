# Foreglow

> Supply chain risk intelligence. See it coming.

Foreglow reads the news, weather and trade policy that touch your suppliers, then shows
which products are exposed and what to do next.

Formerly SCM Disruption Monitor. "Foreglow" is a working name; the repository and the
deployment URL keep their original names.

**[Live app](https://scm-disruption-monitor.vercel.app)** · Next.js 14 + Vercel

## What it does

Aggregates supply chain disruption signals from five independent free sources, scores
each event against a company profile you define (suppliers, product lines, inventory
positions, trade lanes), and surfaces the ones that actually touch your network — rather
than a generic global news feed.

On top of the feed it runs inventory reorder calculations, supplier health scoring,
HHI concentration risk, a multi-tier dependency graph with single-point-of-failure
detection, and AI-generated recommendations grounded in your own data.

## Getting started in the app

Sign up with Google, Microsoft or a 6-digit email code (provider buttons appear once
they're configured), or try it without an account. A guided setup at `/onboarding`
takes about four minutes — company basics, suppliers (typed in or uploaded from a
spreadsheet), entry ports and products — and every step shows what today's real events
mean for what you just entered. A sample company is available for a look around
before sharing any data. The dashboard's setup checklist then collects the rest of the
profile over time.

## Data sources

Every source is free and requires no paid account.

| Source | Provides | Key required |
|---|---|---|
| Trade-press RSS | Port, tariff, labor and geopolitical news from 6 supply chain publications | no |
| GDELT DOC 2.0 | Broad global news sweep across 4,500+ sources | no |
| GDACS | Earthquakes, cyclones, floods, volcanoes, droughts, wildfires | no |
| NOAA / NWS | US weather warnings, filtered to genuinely disruptive types | no |
| Yahoo Finance | Commodity futures and FX rates | no |
| USITC HTS | Duty-rate lookup by HS code | no |
| US Treasury OFAC | Supplier name screening against the SDN list (built, currently disabled behind a feature flag) | no |
| Google Gemini | AI summaries, advisor, chat, scenario analysis | yes (free tier) |
| Supabase | Auth and cross-device persistence | yes (free tier) |

Trade-press RSS is the primary source for port, tariff, labor and geopolitical
coverage. GDELT is retained for breadth but is unreliable from datacenter IPs —
the feed is designed to work without it.

## How it works

**Ingestion.** Sources are fetched in parallel at build time and re-fetched every 30
minutes via ISR. Each source has its own last-known-good cache, so a publisher outage
or a rate-limited API degrades to slightly stale data rather than an empty feed.

**Scoring.** Events are classified by category and severity from headline keywords
(word-boundary matched), then scored 0-100 against the company profile — weighted by
regional supply share, pain-point overlap, severity, direct supplier-country mentions,
trade-lane keywords, and current inventory urgency.

**Analysis.** Gemini generates a daily brief, proactive recommendations, per-event
explanations, cost estimates and what-if scenario analysis — each prompted with the
user's actual supplier and inventory data, plus computed dependency paths from the
supply chain graph rather than the model guessing at them.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript strict) |
| Styling | Tailwind CSS with the First Light design tokens (`lib/ui.ts`, `lib/brand.ts`) |
| Type | Newsreader (headings) + Public Sans (UI) via `next/font/google` |
| Map | react-simple-maps |
| Charts | Recharts |
| AI | Google Gemini 2.5 Flash (`@google/genai`), with Google Search grounding |
| Auth + DB | Supabase (`@supabase/ssr`), Row Level Security |
| PDF export | jsPDF |
| Hosting | Vercel |

## Local setup

```bash
git clone https://github.com/balrajkooner14-stack/scm-disruption-monitor
cd scm-disruption-monitor
npm install
cp .env.example .env.local   # then fill in your keys
npm run dev
```

The app runs fully in guest mode without Supabase — profile and history are kept in
`localStorage`. Supabase only adds sign-in and cross-device sync.

Optional environment flags: `NEXT_PUBLIC_AUTH_GOOGLE=1` and `NEXT_PUBLIC_AUTH_MICROSOFT=1`
show those sign-in buttons once the providers are configured in Supabase;
`NEXT_PUBLIC_SETUP_CALL_URL` shows "Book a setup call" links. The database change for
v5.1 is in `supabase/migrations/`.

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
npm run verify   # test suite (compiles lib/ then runs scripts/verify-*.js)
```

`npm run verify` is the project's test suite. There is no test framework installed;
the harnesses under `scripts/` compile the library with `tsc` and assert against it
directly.

## Project notes

`CLAUDE.md` holds the working memory for this project — architecture, per-version
history with the reasoning behind each decision, frozen rules that must not be changed
casually, and the known-issues list. Read it before making changes.

## About

Built by Balraj Kooner. Not financial advice.
