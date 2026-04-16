# SCM Disruption Monitor — Project Memory

## What this project is
Full-stack Next.js 14 (App Router, TypeScript) supply chain risk monitoring dashboard.
Portfolio project for a Supply Chain Management master's student with a systematic 
trading and financial markets background.

## Live project
- GitHub: https://github.com/balrajkooner14-stack/scm-disruption-monitor
- Live URL: https://scm-disruption-monitor.vercel.app
- Status: v1.2 live

## Tech stack
- Framework: Next.js 14, App Router, TypeScript
- Styling: Tailwind CSS
- Map: react-simple-maps (world heatmap)
- News API: GDELT DOC 2.0 — https://api.gdeltproject.org/api/v2/doc/doc (FREE, no key)
- AI summary: Google Gemini API — model: gemini-2.5-flash — env var: GEMINI_API_KEY
- AI SDK: @google/genai (NOT the deprecated @google/generative-ai)
- Hosting: Vercel Hobby (free tier)

## Folder structure
/app            → Pages: page.tsx, /about/page.tsx, /api/analyze/route.ts
/components     → KPIBar, WorldMap, DisruptionFeed, AIInsightPanel, Navbar, CategoryChart, DashboardClient
/lib            → types.ts, fetchDisruptions.ts
/data           → fallback.json

## Severity scoring rules (DO NOT CHANGE without asking)
Score 3 CRITICAL: strike, closure, sanctions, blocked, halt, shutdown, ban
Score 2 WARNING: delay, shortage, disruption, tariff, congestion, reduced
Score 1 MONITOR: everything else

## GDELT queries (all with timespan=24H, maxrecords=25, format=json, mode=artlist)
Query 1: "supply chain disruption" → category: General
Query 2: "port strike OR port closure OR freight delay" → category: Port or Labor
Query 3: "tariff OR sanctions OR trade war" → category: Tariff or Geopolitical

## AI caching rule (DO NOT CHANGE)
/app/api/analyze/route.ts caches AI summary 10 minutes using module-level variable.
Do not remove this logic.

## Coding rules
- TypeScript strict — no implicit any
- Tailwind only for styling
- All external links: target="_blank" rel="noopener noreferrer"
- Every component must handle: loading state, error state, empty state
- App must work with fallback data if all APIs fail
- Never commit .env.local
- Always run: npm run build before declaring any change done
- Commit format: git commit -m "feat: [description]"

## Version history
v0.1 — Scaffold and config files
v1.0 — Full working dashboard: GDELT feed, Gemini AI summary, world map, KPI bar
v1.1 — Fixed map choropleth coloring, category assignment, region mapping,
        premium UI redesign, category bar chart, cross-filtering between
        map and feed, critical event pulse animation, connected GitHub
        to Vercel for auto-deploy (Apr 14, 2026)
v1.2 — Interactivity overhaul: staggered card animations, clickable KPI
        filters, live search bar, refresh button with spinner, improved
        card hover states, live real-time clock, micro-animations on all
        interactive elements (Apr 15, 2026)

## Backlog
- [x] Switched to Gemini 2.5 Flash (free) — completed
- [x] Premium UI redesign with visual hierarchy (completed Apr 14, 2026)
- [x] Category bar chart added (completed Apr 14, 2026)
- [x] Map choropleth coloring fixed (completed Apr 14, 2026)
- [x] Category filter tabs fixed (completed Apr 14, 2026)
- [x] Cross-filtering map ↔ feed (completed Apr 14, 2026)
- [x] Connected GitHub to Vercel auto-deploy (completed Apr 14, 2026)
- [x] Staggered card entrance animations (completed Apr 15, 2026)
- [x] Clickable KPI filters (Critical + Most Affected Region) (completed Apr 15, 2026)
- [x] Live search bar with clear button and result count (completed Apr 15, 2026)
- [x] Refresh button with spinner (completed Apr 15, 2026)
- [x] Improved card hover states with border expansion (completed Apr 15, 2026)
- [x] Live real-time clock in Navbar (completed Apr 15, 2026)
- [x] Micro-animations on pills, map fill, KPI cards (completed Apr 15, 2026)
- [ ] AI Chat Panel — interactive chat with full feed as context (NEXT)
- [ ] Per-event "Why This Matters" AI brief on card click
- [ ] Company Impact Analyzer — type a company, get risk assessment
- [ ] 7-day trend sparklines per category
- [ ] Grounded Deep Dive button per event
- [ ] Add 30-day historical chart
- [ ] Add country-level filter
