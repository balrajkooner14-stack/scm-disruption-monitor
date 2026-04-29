# SCM Disruption Monitor — Project Memory

## What this project is
Full-stack Next.js 14 (App Router, TypeScript) supply chain risk monitoring dashboard.
Portfolio project for a Supply Chain Management master's student with a systematic 
trading and financial markets background.

## Live project
- GitHub: https://github.com/balrajkooner14-stack/scm-disruption-monitor
- Live URL: https://scm-disruption-monitor.vercel.app
- Status: v2.7 live

## Tech stack
- Framework: Next.js 14, App Router, TypeScript
- Styling: Tailwind CSS
- Map: react-simple-maps (world heatmap)
- News API: GDELT DOC 2.0 — https://api.gdeltproject.org/api/v2/doc/doc (FREE, no key)
- AI summary: Google Gemini API — model: gemini-2.5-flash — env var: GEMINI_API_KEY
- AI SDK: @google/genai (NOT the deprecated @google/generative-ai)
- Commodity data: Yahoo Finance futures API (FREE, no key) — CL=F, NG=F, HG=F, ZW=F
- PDF export: jsPDF v4 (client-side, browser-only)
- Hosting: Vercel Hobby (free tier)

## Folder structure
/app
  page.tsx                        → Home: fetches events, renders Navbar + DashboardClient (AIInsightPanel now inside DashboardClient)
  /about/page.tsx                 → Static about page
  /profile/page.tsx               → 5-step company profile form
  /scenarios/page.tsx             → Standalone scenario planner page
  /api/analyze/route.ts           → Gemini AI summary (profile-aware, 10min cache)
  /api/advisor/route.ts           → Proactive AI recommendations (profile + events, 10min cache)
  /api/chat/route.ts              → Streaming multi-turn chat (profile + events context)
  /api/scenario/route.ts          → Streaming what-if analysis (5-section structured output)
  /api/market-data/route.ts       → Yahoo Finance futures commodity prices + static freight rates (24hr cache)
  /api/event-brief/route.ts       → Per-event Gemini brief (profile-aware, structured JSON: brief/impact/recommendation)

/components
  Navbar.tsx                      → Sticky nav: logo, LIVE indicator, clock, profile button, dark mode
  AIInsightPanel.tsx              → Gemini AI summary panel (profile-aware, 10min cache)
  DashboardClient.tsx             → 4-tab hub: Overview / Advisor / Scenarios / Analytics
  KPIBar.tsx                      → KPI cards (profile-aware: events affecting you, risk region)
  WorldMap.tsx                    → Choropleth heatmap (supplier countries highlighted cyan #22d3ee)
  DisruptionFeed.tsx              → Event cards with relevance scores, search, sort toggle, click-to-expand brief
  EventBriefPanel.tsx             → Expandable per-event AI brief: impact badge, explanation, recommendation
  DailyBriefButton.tsx            → PDF export trigger: loading state, success flash, auto-named download
  CategoryChart.tsx               → Bar chart: events by category (recharts)
  AIAdvisor.tsx                   → Proactive AI recommendations panel (collapsible cards)
  AIChatPanel.tsx                 → Floating chat bubble, streaming multi-turn AI chat
  ScenarioPlanner.tsx             → What-if scenario form + streaming analysis output
  ScenarioPageClient.tsx          → Client wrapper for /scenarios page
  ProfilePromptModal.tsx          → First-visit modal prompting profile setup
  AnalyticsTab.tsx                → Analytics tab: CategoryChart + CommodityChart + FreightRateCard
  CommodityChart.tsx              → Yahoo Finance commodity sparklines (sector-relevant highlights)
  FreightRateCard.tsx             → Container freight rates by trade lane
  InventoryRiskPanel.tsx          → Product risk cards: progress bars, reorder alerts, disruption indicators
  SupplierHealthScorecard.tsx     → Supplier score cards with grade badges, inline edit forms, live score preview, disruption+low-score compound warning
  CostImpactPanel.tsx             → Financial impact panel: 3-metric display (revenue at risk / mitigation cost / net risk reduction), urgency bar, lazy-fetch on first open
  ConcentrationRiskCard.tsx       → Expandable HHI score card with scale bar, country/region breakdown bars, recommendation panel. No props — reads profile via useCompanyProfile
  DisruptionHistoryTab.tsx        → Full History tab: timeline grouped by month, severity dots, filter pills (All/Profile/Critical), expandable entries, Export CSV, Clear with confirm

/lib
  types.ts                        → DisruptionEvent, DisruptionCategory
  fetchDisruptions.ts             → GDELT fetcher (3 queries, deduplication, fallback)
  scoreEvents.ts                  → ScoredEvent type, scoreEventsForProfile()
  profile.ts                      → CompanyProfile type + all sub-types, PROFILE_STORAGE_KEY
  generateBrief.ts                → jsPDF layout engine: BriefData interface, generateDailyBrief()
  inventoryRisk.ts                → Risk calculation engine: calculateInventoryRisk(), getDaysSinceDate(), getInventoryBarColor()
  supplierHealth.ts               → Score calculation engine: calculateCompositeScore(), getGrade(), buildHealthScores(), loadHealthEntries(), saveHealthEntry(). Storage key: scm_supplier_health
  concentrationRisk.ts            → HHI calculation engine: calculateConcentrationRisk(), buildBreakdown(). 4 levels: diversified (<1500), moderate (1500-2500), concentrated (2500-5000), critical (>5000)
  disruptionHistory.ts            → localStorage log engine: saveEventsToHistory(), loadHistory(), exportHistoryAsCSV(), groupEntriesByMonth(). Storage key: scm_disruption_history. 90-day retention, 500 entry cap, dedup by URL+date

/hooks
  useCompanyProfile.ts            → "use client" hook: profile state, saveProfile, clearProfile

/data
  fallback.json                   → Fallback events if GDELT is down

## API routes
- /api/analyze    — Gemini AI summary (profile-aware, 10min cache, key: profile.updatedAt or "generic")
- /api/advisor    — Proactive recommendations JSON array (profile + top 15 events, 10min Map cache)
- /api/chat       — Streaming chat via ai.chats.create() + sendMessageStream (ReadableStream)
- /api/scenario   — Streaming what-if analysis via generateContentStream (ReadableStream)
- /api/market-data — Yahoo Finance futures (CL=F/NG=F/HG=F/ZW=F), 13 months, unit-scaled,
                     static freight rates for 4 lanes, 24hr module-level cache (CACHE_VERSION="v3")
- /api/event-brief — Per-event Gemini brief, profile-aware context, returns {brief, impact, recommendation},
                     graceful 200 fallback on error, client-side cached in DisruptionFeed state
- /api/cost-estimate — Financial impact estimate per supplier+event: revenue at risk range, mitigation cost,
                       net risk reduction, urgency days. 30min server cache keyed by supplier.id+event.url

## Severity scoring rules (DO NOT CHANGE without asking)
Score 3 CRITICAL: strike, closure, sanctions, blocked, halt, shutdown, ban
Score 2 WARNING: delay, shortage, disruption, tariff, congestion, reduced
Score 1 MONITOR: everything else

## GDELT queries (all with timespan=24H, maxrecords=25, format=json, mode=artlist)
Query 1: "supply chain disruption" → category: General
Query 2: "port strike OR port closure OR freight delay" → category: Port or Labor
Query 3: "tariff OR sanctions OR trade war" → category: Tariff or Geopolitical

## Caching rules (DO NOT CHANGE)
- /api/analyze: 10min module-level variable, key: profile ? `profile:${companyName}:${updatedAt}` : "generic"
- /api/advisor: 10min Map<string, {data, timestamp}>, key: profile.updatedAt + events[0].title
- /api/market-data: 24hr module-level variable, CACHE_VERSION="v3", serves stale on Yahoo Finance failure

## localStorage keys
- scm_company_profile — company profile data (CompanyProfile type)
- scm_supplier_health — supplier performance scores (Record<supplierId, SupplierHealthEntry>)
- scm_inventory_log — inventory risk alert log
- scm_disruption_history — 90-day event history (HistoryEntry[], max 500 entries)
- scm_active_tab — last active tab ("overview"|"advisor"|"scenarios"|"analytics"|"history")

## Key type notes
- ScoredEvent extends DisruptionEvent — structural subtyping, passes wherever DisruptionEvent[] expected
- import type {...} used in client components importing from API route files (prevents server code in client bundle)
- Array.from(new Set(...)) required instead of [...new Set()] (TypeScript target compatibility)
- useCompanyProfile() reads/writes localStorage via PROFILE_STORAGE_KEY

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
v2.0 — Major platform rebuild across 7 phases (Apr 24–25, 2026):
        Phase 1: Company profile system (/lib/profile.ts, /hooks/useCompanyProfile.ts,
                 /app/profile/page.tsx, ProfilePromptModal)
        Phase 2: Profile-aware map + relevance scoring (/lib/scoreEvents.ts,
                 ScoredEvent type, personalized KPIs, supplier country map highlights)
        Phase 3: AI Advisor panel (/app/api/advisor/route.ts, /components/AIAdvisor.tsx,
                 proactive CRITICAL/HIGH/MEDIUM recommendations)
        Phase 4: AI Chat Panel + personalized summary (/app/api/chat/route.ts,
                 /components/AIChatPanel.tsx, streaming multi-turn chat, profile-aware
                 AIInsightPanel)
        Phase 5: Scenario Planner (/app/api/scenario/route.ts,
                 /components/ScenarioPlanner.tsx, /app/scenarios/page.tsx,
                 inventory risk calculation per product line)
        Phase 6: Tabbed layout — Overview/Advisor/Scenarios/Analytics tabs,
                 tab persistence in localStorage, critical event badge on Overview tab,
                 profile match badge on Advisor tab, simplified Navbar
        Phase 7: External data feeds (/app/api/market-data/route.ts,
                 /components/CommodityChart.tsx, /components/FreightRateCard.tsx,
                 /components/AnalyticsTab.tsx, World Bank commodity API,
                 sector-relevant commodity highlighting, 24hr server cache)
v2.1 — Post-launch fixes and new features (Apr 26, 2026):
        Fix: Commodity prices switched from broken World Bank API to Yahoo Finance
             futures (CL=F, NG=F, HG=F, ZW=F) with unit-scale conversions
        Fix: Supplier country map color changed to cyan #22d3ee for clear visual
             distinction from heat map amber/orange/red colors
        Feature: Per-event AI brief — clicking any event card expands a "Why This
                 Matters" panel with impact rating (High/Medium/Low), supply chain
                 explanation, and recommendation. Client-side cache (briefCache keyed
                 by event.url) prevents repeat API calls.
        Feature: PDF Daily Brief export — jsPDF-powered one-click download with dark
                 header, KPI boxes, AI recommendations (up to 4), top events (up to 8),
                 commodity snapshot, page numbers. Auto-named scm-brief-[company]-[date].pdf.
                 AIInsightPanel moved inside DashboardClient to enable state lifting.
v2.2 — Chat streaming fix (Apr 26, 2026): [commit: 2c54817]
        Fix: AI Chat Panel streaming timeout resolved for Vercel Hobby tier.
             Added export const maxDuration = 30 to /app/api/chat/route.ts and
             /app/api/scenario/route.ts to extend serverless function timeout
             from 10s to 30s. Added thinkingBudget: 0 to Gemini config to reduce
             time-to-first-token from ~10s to ~2-3s. Chat panel now fully
             functional in production.
v2.7 — Disruption History Log + All 5 Operational Features Complete (Apr 28, 2026):
        Feature 1: Inventory Risk Calculator — /lib/inventoryRisk.ts,
          /components/InventoryRiskPanel.tsx, live reorder alerts,
          disruption-aware risk levels, KPI bar integration
        Feature 2: Supplier Health Scorecard — /lib/supplierHealth.ts,
          /components/SupplierHealthScorecard.tsx, composite scoring,
          inline edit forms, compound disruption warnings, AI Advisor
          integration
        Feature 3: Cost Impact Estimator — /app/api/cost-estimate/route.ts,
          /components/CostImpactPanel.tsx, financial framing on advisor
          cards, revenue at risk vs mitigation cost, urgency bar
        Feature 4: Concentration Risk Score — /lib/concentrationRisk.ts,
          /components/ConcentrationRiskCard.tsx, HHI calculation,
          country/region breakdown, KPI bar priority logic
        Feature 5: Disruption History Log — /lib/disruptionHistory.ts,
          /components/DisruptionHistoryTab.tsx, 90-day rolling log,
          CSV export, 5th History tab, PDF historical context section

v2.6 — Supplier Concentration Risk Score (Apr 28, 2026):
        Feature: HHI-based concentration risk scoring.
                 Pure calculation engine in /lib/concentrationRisk.ts —
                 HHI = sum of squared supplier share percentages. Thresholds:
                 <1500 diversified, 1500-2500 moderate, 2500-5000 concentrated,
                 >5000 critical. ConcentrationRiskCard shows HHI score, scale bar
                 with white position marker, country/region breakdown bars, and
                 recommendation panel. KPI bar card 4 updated with 5-level priority
                 logic (inventory critical > concentration risk > inventory warning >
                 network HHI > data window). Wired into Advisor tab between AIAdvisor
                 and SupplierHealthScorecard. concentrationRisk line added to PDF.

v2.5 — Cost Impact Estimator (Apr 28, 2026):
        Feature: Financial framing for disruption recommendations.
                 /app/api/cost-estimate/route.ts — Gemini calculates revenue at risk
                 (low/high range), mitigation cost, net risk reduction, urgency days,
                 confidence level, and assumptions. 30min server cache per supplier+event.
                 CostImpactPanel — lazy-fetch on first open, 3-metric display, urgency
                 progress bar. Wired into AIAdvisor expanded cards with "View cost
                 estimate" toggle button. BriefData.recommendations extended with
                 optional affectedSuppliers and costEstimates fields; PDF brief shows
                 amber financial impact line per recommendation when cost data available.

v2.4 — Supplier Health Scorecard (Apr 28, 2026):
        Feature: Supplier Health Scorecard with performance logging and AI integration.
                 Score calculation engine in /lib/supplierHealth.ts — composite score
                 weighted: on-time delivery 50%, quality 35%, delay penalty 15%.
                 Grade thresholds: Excellent (85+), Good (70+), Fair (55+), Poor (40+),
                 Critical (<40). SupplierHealthScorecard component shows score circles,
                 grade badges, metrics row, inline edit form with live score preview,
                 and compound warning when low-score supplier is in disrupted region.
                 Wired into Advisor tab below AIAdvisor. AIAdvisor passes health summary
                 to /api/advisor — Gemini flags low-scoring suppliers in disrupted regions
                 as CRITICAL compounding risk. Cache key includes health summary slice.

v2.3 — Inventory Risk Calculator (Apr 28, 2026):
        Feature: Inventory Risk Calculator with live reorder alerts.
                 Pure calculation engine in /lib/inventoryRisk.ts compares
                 inventory days on hand against supplier lead times and active
                 disruptions. InventoryRiskPanel shows product risk cards with
                 progress bars, color-coded risk levels, and a critical alert
                 banner. KPI bar card 4 updates to show inventory status when
                 profile exists. Profile page Step 3 shows amber reminder banner
                 when editing existing inventory levels. localStorage log stored
                 under scm_inventory_log key.

## Backlog
- [x] Switched to Gemini 2.5 Flash (free)
- [x] Premium UI redesign with visual hierarchy (Apr 14, 2026)
- [x] Category bar chart (Apr 14, 2026)
- [x] Map choropleth coloring fixed (Apr 14, 2026)
- [x] Category filter tabs fixed (Apr 14, 2026)
- [x] Cross-filtering map ↔ feed (Apr 14, 2026)
- [x] Connected GitHub to Vercel auto-deploy (Apr 14, 2026)
- [x] Staggered card entrance animations (Apr 15, 2026)
- [x] Clickable KPI filters (Critical + Most Affected Region) (Apr 15, 2026)
- [x] Live search bar with clear button and result count (Apr 15, 2026)
- [x] Refresh button with spinner (Apr 15, 2026)
- [x] Improved card hover states with border expansion (Apr 15, 2026)
- [x] Live real-time clock in Navbar (Apr 15, 2026)
- [x] Micro-animations on pills, map fill, KPI cards (Apr 15, 2026)
- [x] Company profile system — 5-step form, localStorage, profile-aware components (Apr 24, 2026)
- [x] Profile-aware map + relevance scoring engine (Apr 24, 2026)
- [x] AI Advisor panel — proactive Gemini recommendations (Apr 24, 2026)
- [x] AI Chat Panel — floating streaming chat with full feed context (Apr 24, 2026)
- [x] Personalized AI summary in AIInsightPanel (Apr 24, 2026)
- [x] Scenario Planner — streaming what-if analysis with inventory risk (Apr 24, 2026)
- [x] Tabbed layout consolidation — 4-tab intelligence hub (Apr 25, 2026)
- [x] External data feeds — World Bank commodity prices + freight rates (Apr 25, 2026)
- [x] Per-event "Why This Matters" AI brief on card click (Apr 26, 2026)
- [x] Export / PDF daily brief generator (Apr 26, 2026)
- [x] Inventory Risk Calculator with reorder alerts (Apr 28, 2026)
- [x] Supplier Health Scorecard with performance logging and AI integration (Apr 28, 2026)
- [x] Cost Impact Estimator with financial framing for recommendations (Apr 28, 2026)
- [x] Supplier Concentration Risk Score (HHI) with visual breakdown (Apr 28, 2026)
- [x] Disruption History Log with 90-day timeline and CSV export (Apr 28, 2026)
- [ ] Supabase auth + database migration (Phase B)
      Cross-device profile persistence, login/signup,
      migrate all localStorage keys to database tables
- [ ] Watchlist with new-event badges (localStorage)
- [ ] 7-day disruption trend sparklines per category
- [ ] Custom domain setup
