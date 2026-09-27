# SCM Disruption Monitor

> Supply chain risk intelligence — live disruption signals scored against your own supplier network

**[Live demo](https://scm-disruption-monitor.vercel.app)** · Next.js 14 + Vercel

## What it does

Aggregates supply chain disruption signals from five independent free sources, scores
each event against a company profile you define (suppliers, product lines, inventory
positions, trade lanes), and surfaces the ones that actually touch your network — rather
than a generic global news feed.

On top of the feed it runs inventory reorder calculations, supplier health scoring,
HHI concentration risk, a multi-tier dependency graph with single-point-of-failure
detection, and AI-generated recommendations grounded in your own data.

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
| US Treasury OFAC | Supplier name screening against the SDN list | no |
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
| Styling | Tailwind CSS |
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

A portfolio project pairing supply chain management domain knowledge with full-stack
development and applied AI. Not financial advice.
