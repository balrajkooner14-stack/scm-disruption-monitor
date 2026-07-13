# SCM Disruption Monitor — Project Memory

## What this project is
Full-stack Next.js 14 (App Router, TypeScript) supply chain risk monitoring dashboard.
Portfolio project for a Supply Chain Management master's student with a systematic 
trading and financial markets background.

## Live project
- GitHub: https://github.com/balrajkooner14-stack/scm-disruption-monitor
- Live URL: https://scm-disruption-monitor.vercel.app
- Status: v4.0 live

## Tech stack
- Framework: Next.js 14, App Router, TypeScript
- Styling: Tailwind CSS
- Map: react-simple-maps (world heatmap)
- News API: GDELT DOC 2.0 — https://api.gdeltproject.org/api/v2/doc/doc (FREE, no key)
- AI summary: Google Gemini API — model: gemini-2.5-flash — env var: GEMINI_API_KEY
- AI SDK: @google/genai (NOT the deprecated @google/generative-ai)
- Commodity data: Yahoo Finance futures API (FREE, no key) — CL=F, NG=F, HG=F, ZW=F
- PDF export: jsPDF v4 (client-side, browser-only)
- Auth & Database: Supabase (@supabase/ssr) — profiles, supplier health, history, alerts
- Hosting: Vercel Hobby (free tier)

## Environment variables
- GEMINI_API_KEY — Google Gemini AI (billing enabled, no daily limit)
- NEXT_PUBLIC_SUPABASE_URL — https://zekhnneilcploogfudsp.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY — anon public key (safe for client-side)

## Supabase project
- Project URL: https://zekhnneilcploogfudsp.supabase.co
- Tables (all with Row Level Security — users only see their own data):
  - profiles — company profile (JSONB columns for arrays; headquarters_country text column added v3.8)
  - supplier_health — supplier performance entries per user
  - lead_time_history — lead time snapshots per supplier per user
  - disruption_history — 90-day event log per user
  - performance_alerts — OTD/quality/lead time alerts per user

## Folder structure
/app
  page.tsx                        → Home: fetches events, renders Navbar + DashboardClient
  /about/page.tsx                 → Static about page
  /login/page.tsx                 → Supabase email+password sign in (force-dynamic)
  /signup/page.tsx                → Supabase sign up with confirm password (force-dynamic)
  /profile/page.tsx               → 5-step company profile form (force-dynamic)
  /scenarios/page.tsx             → Standalone scenario planner page
  /api/analyze/route.ts           → Gemini AI summary (profile-aware, 10min cache)
  /api/advisor/route.ts           → Proactive AI recommendations (profile + events, 10min cache)
  /api/chat/route.ts              → Streaming multi-turn chat (profile + events context)
  /api/scenario/route.ts          → Streaming what-if analysis (5-section structured output)
  /api/market-data/route.ts       → Yahoo Finance futures commodity prices + static freight rates (24hr cache)
  /api/event-brief/route.ts       → Per-event Gemini brief (profile-aware, structured JSON: brief/impact/recommendation)
  /api/cost-estimate/route.ts     → Financial impact estimate per supplier+event (30min cache)
  /api/import-profile/route.ts    → Gemini interprets uploaded file data, maps columns to profile schema (5min cache)
  /api/sanctions-check/route.ts   → OFAC SDN CSV screening against supplier names, 24hr cache (v4.0)
  /api/tariff-lookup/route.ts     → USITC HTS REST API duty rate lookup by HS code, 24hr per-code cache (v4.0)

/components
  Navbar.tsx                      → Sticky nav: logo, LIVE indicator, clock, profile button, dark mode,
                                    auth state (Sign in/Sign up for guests; email + Sign out when logged in)
  AIInsightPanel.tsx              → Gemini AI summary panel (profile-aware, 10min cache)
  DashboardClient.tsx             → 5-tab hub: Overview / Advisor / Scenarios / Analytics / History.
                                    switchTab custom event listener. DisruptionUpdatePrompt + PerformanceAlertBanner on Overview.
  KPIBar.tsx                      → KPI cards (profile-aware: events affecting you, risk region)
  WorldMap.tsx                    → Choropleth heatmap (supplier countries highlighted cyan #22d3ee, tier-2
                                    sub-supplier countries violet #a78bfa, "INDIRECT EXPOSURE via X" hover text — v4.0)
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
  InventoryRiskPanel.tsx          → Product risk cards: progress bars, reorder alerts, disruption indicators.
                                    Amber warning on cards still defaulting to highest-share supplier.
  SupplierHealthScorecard.tsx     → Supplier score cards with grade badges, 4-column metrics row (OTD/quality/delay/lead time trend),
                                    inline edit forms, OTD+quality alert triggering, lead time recording on save
  CostImpactPanel.tsx             → Financial impact panel: 3-metric display, urgency bar, lazy-fetch on first open
  ConcentrationRiskCard.tsx       → HHI score card with scale bar, country/region breakdown, recommendation panel
  DisruptionHistoryTab.tsx        → History tab: timeline by month, severity dots, filter pills, Export CSV, Clear
  PerformanceAlertBanner.tsx      → Dismissible amber alert banner on Overview tab for OTD/quality/lead time crossings.
                                    Listens for "performanceAlertCreated" window event to refresh.
  DisruptionUpdatePrompt.tsx      → Blue banner on Overview: detects new critical events in supplier regions since
                                    last visit. Once-per-day dismissal. "Review AI recommendations" fires switchTab event.
  ImportProfileFlow.tsx           → 4-step import flow: drag-and-drop upload → AI processing → editable review
                                    with confidence indicators → confirm and save to Supabase or localStorage
  CurrencyExposureCard.tsx        → Yahoo Finance FX sparklines (v4.0), filtered to currencies of profile's
                                    actual supplier countries via lib/currencyMapping.ts
  SanctionsScreeningCard.tsx      → Self-fetching OFAC screening card (v4.0), per-supplier badge: green "No match
                                    found" or amber "⚠ Possible match — verify manually". Rendered on Advisor tab.
  LaborCalendarCard.tsx           → Static labor/union contract expiration reference (v4.0), surfaces contracts
                                    within 180-day lookahead whose tradeLanesAffected overlaps profile.tradeLanes.
                                    Rendered on Overview tab.
  TariffRateBadge.tsx             → Self-fetching HTS duty rate badge (v4.0) shown on product cards with hsCode set

/lib
  types.ts                        → DisruptionEvent, DisruptionCategory
  fetchDisruptions.ts             → GDELT fetcher (3 queries) + GDACS (fetchGlobalDisasters) + NOAA
                                    (fetchWeatherAlerts) merged via Promise.all, deduplication, fallback (v4.0)
  fetchGlobalDisasters.ts         → GDACS API (earthquakes/cyclones/floods/volcanoes/droughts/wildfires),
                                    global coverage, country-NAME-keyed region map — deliberately NOT the
                                    same lookup as GDELT's FIPS-style codes (collision risk, e.g. "CH") (v4.0)
  fetchWeatherAlerts.ts           → api.weather.gov/alerts/active, US-only supplement, category: "Weather" (v4.0)
  scoreEvents.ts                  → ScoredEvent type, scoreEventsForProfile()
  profile.ts                      → CompanyProfile type + all sub-types, PROFILE_STORAGE_KEY.
                                    ProductLine has optional primarySupplierId, backupSupplierId (v4.0), hsCode
                                    (v4.0). Supplier has optional tier2Suppliers (v4.0, manual entry, visibility only).
  currencyMapping.ts              → COUNTRY_TO_CURRENCY record + currencyCodesForCountries() (v4.0)
  sanctionsScreening.ts           → Pure token-overlap name matching: screenSupplierNames(). "high"/"medium"
                                    match strength only — never a definitive sanctions claim (v4.0)
  laborCalendar.ts                → Static LABOR_CONTRACTS[] (ILWU/PMA, ILA/USMX), each entry sourced +
                                    dated with lastVerified; contractsWithinWindow() (v4.0)
  generateBrief.ts                → jsPDF layout engine: BriefData interface, generateDailyBrief()
  inventoryRisk.ts                → Risk calculation engine: calculateInventoryRisk(), getDaysSinceDate(), getInventoryBarColor().
                                    Uses product.primarySupplierId for lead time; falls back to highest-share supplier.
                                    ProductRisk now includes supplierAssigned boolean, backupSupplier (v4.0,
                                    resolved via backupSupplierId, no fallback), hsCode (v4.0, echoed from product).
  supplierHealth.ts               → Pure types + calc: calculateCompositeScore(), getGrade().
                                    Storage I/O lives in /hooks/useSupplierHealth.ts
  concentrationRisk.ts            → HHI engine: calculateConcentrationRisk(), buildBreakdown().
                                    4 levels: diversified (<1500), moderate (1500-2500), concentrated (2500-5000), critical (>5000)
  disruptionHistory.ts            → Pure types + exportHistoryAsCSV(), groupEntriesByMonth().
                                    Storage I/O lives in /hooks/useDisruptionHistory.ts. 90-day retention, 500 cap, dedup by URL+date
  performanceAlerts.ts            → Pure PerformanceAlert type only.
                                    Storage I/O + threshold logic lives in /hooks/usePerformanceAlerts.ts. Defaults: 85% OTD, 75% quality
  leadTimeHistory.ts              → Pure types + calculateLeadTimeDrift().
                                    Storage I/O lives in /hooks/useLeadTimeHistory.ts. Max 12 entries/supplier. 20% drift = significant
  supabase.ts                     → createClient() — browser Supabase client (createBrowserClient, safe fallback during build)
  supabase-server.ts              → createServerSupabaseClient() — server component client (createServerClient + CookieOptions)
  parseImportFile.ts              → Client-side file parser: parseFile() for CSV (papaparse) and Excel (xlsx),
                                    prepareForAI() trims to 20 rows for token efficiency. 50-row cap.
  importCalculations.ts           → Deterministic post-processing for imports: computeDaysOnHand(onHandValue,
                                    usageValue, usageWindowDays), distributeShareEvenly(count). Gemini extracts
                                    raw numbers/structure only — this file does the arithmetic, never the AI.

/hooks
  useCompanyProfile.ts            → Supabase-first with localStorage fallback for guests.
                                    Loads from Supabase when logged in, auto-migrates localStorage on first login.
                                    saveProfile() and clearProfile() are now async.
  useAuth.ts                      → useAuth() hook: user, session, isLoading, signOut. Uses onAuthStateChange listener.
  useSupplierHealth.ts            → Supabase-first + localStorage fallback for guests. useSupplierHealth(suppliers) →
                                    { scores, entries, saveEntry(), isLoaded }. One-time migration of existing guest
                                    localStorage data into Supabase on first login (per-hook, guarded, idempotent).
  useLeadTimeHistory.ts           → Same Supabase-first pattern. recordEntry() returns the updated per-supplier
                                    array directly (avoids stale-closure reads after await). Caps at 12 entries/supplier.
  useDisruptionHistory.ts         → Same Supabase-first pattern. saveEvents() diffs against already-loaded entries
                                    to insert only genuinely new rows. 90-day window, 500-row cap.
  usePerformanceAlerts.ts         → Same Supabase-first pattern. Internally listens for the "performanceAlertCreated"
                                    window event to stay in sync across component instances (e.g. SupplierHealthScorecard
                                    creating an alert → PerformanceAlertBanner picking it up). checkAndCreate() mirrors
                                    the original threshold-crossing logic; persistAlerts() for one-off alerts.

/middleware.ts                    → Session refresh on every request (getSession). Does NOT block unauthenticated routes.

/data
  fallback.json                   → Fallback events if GDELT is down

## API routes
- /api/analyze    — Gemini AI summary (profile-aware, 10min cache, key: profile.updatedAt or "generic")
- /api/advisor    — Proactive recommendations JSON array (profile + top 15 events, 10min Map cache)
- /api/chat       — Streaming chat via ai.chats.create() + sendMessageStream (ReadableStream)
- /api/scenario   — Streaming what-if analysis via generateContentStream (ReadableStream)
- /api/market-data — Yahoo Finance futures (CL=F/NG=F/HG=F/ZW=F) + FX currency pairs ({CODE}=X, 8 currencies,
                     v4.0), 13 months, unit-scaled, static freight rates for 4 lanes with lastVerified date
                     (relabeled "reference · not live" in v4.0 — no free live freight index exists),
                     24hr module-level cache (CACHE_VERSION="v4")
- /api/sanctions-check — POST {suppliers}. Fetches OFAC SDN CSV (treasury.gov, free, 24hr cache), token-overlap
                        name matching, returns {matches, listSize, checkedAt}. Never asserts a match as fact —
                        always "possible match, verify manually" (v4.0)
- /api/tariff-lookup — GET ?hsCode=X. Queries USITC HTS REST API (free, no auth), 24hr per-code cache,
                      returns general/special/other duty rates, filters non-dutiable entries (v4.0)
- /api/event-brief — Per-event Gemini brief, profile-aware context, returns {brief, impact, recommendation},
                     graceful 200 fallback on error, client-side cached in DisruptionFeed state
- /api/cost-estimate — Financial impact estimate per supplier+event: revenue at risk range, mitigation cost,
                       net risk reduction, urgency days. 30min server cache keyed by supplier.id+event.url
- /api/import-profile — Accepts POST {extractedData, fileName}. Gemini maps columns to ImportResult schema
                        (suppliers, productLines, unmappedData, missingFields, ambiguities, rawColumnNames).
                        5min cache. Gemini does structure/column recognition only — all arithmetic (day-supply
                        computation, share % distribution) happens in lib/importCalculations.ts, not the prompt.
                        DIMENSION CLASSIFICATION rule (v3.9): the row-identifying column's header — not the
                        presence of $-value metrics — decides supplier vs. product vs. unmappedData, so a
                        "Factory"/"Customer"-labeled sheet with dollar inventory metrics doesn't get force-fit
                        into product lines just because it has On Hand $/Usage $ columns.

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
- /api/market-data: 24hr module-level variable, CACHE_VERSION="v4", serves stale on Yahoo Finance failure
- /api/sanctions-check: 24hr module-level cache of the parsed OFAC SDN CSV
- /api/tariff-lookup: 24hr per-HS-code cache (Map<hsCode, {data, timestamp}>)

## localStorage keys
- scm_company_profile — company profile data (CompanyProfile type). Supabase is primary when logged in; localStorage is backup/guest.
- scm_supplier_health — supplier performance scores (Record<supplierId, SupplierHealthEntry>). Supabase is primary when logged in;
  localStorage is guest-only fallback (Phase B, v3.7). One-time migration to Supabase on first login if present.
- scm_inventory_log — inventory risk alert log
- scm_disruption_history — 90-day event history (HistoryEntry[], max 500 entries). Supabase is primary when logged in;
  localStorage is guest-only fallback (Phase B, v3.7). One-time migration to Supabase on first login if present.
- scm_active_tab — last active tab ("overview"|"advisor"|"scenarios"|"analytics"|"history")
- scm_performance_alerts — OTD and quality threshold alerts (PerformanceAlert[]). Supabase is primary when logged in;
  localStorage is guest-only fallback (Phase B, v3.7). One-time migration to Supabase on first login if present.
- scm_lead_time_history — lead time history per supplier (LeadTimeHistory record). Supabase is primary when logged in;
  localStorage is guest-only fallback (Phase B, v3.7). One-time migration to Supabase on first login if present.
- scm_last_visit — ISO timestamp of last dashboard visit (for disruption-triggered prompts)
- scm_prompt_dismissed — once-per-day dismissal key (scm_prompt_dismissed-YYYY-MM-DD)

## Key type notes
- ScoredEvent extends DisruptionEvent — structural subtyping, passes wherever DisruptionEvent[] expected
- import type {...} used in client components importing from API route files (prevents server code in client bundle)
- Array.from(new Set(...)) required instead of [...new Set()] (TypeScript target compatibility)
- useCompanyProfile() is now Supabase-first: saveProfile/clearProfile return Promise<boolean>/Promise<void>
- ProductLine.primarySupplierId is optional — if absent, inventoryRisk.ts falls back to highest-share supplier
- ProductRisk.supplierAssigned boolean indicates whether lead time came from explicit assignment or fallback
- useAuth() provides user (User | null), session, isLoading, signOut — consumed by useCompanyProfile and Navbar
- CompanyProfile.headquartersCountry is a required free-text field (v3.8) — same pattern as Supplier.country
  (plain string, not an enum). Collected in Step 1 of the profile form. Fed into /api/advisor and /api/analyze
  prompts. Existing profiles saved before v3.8 read back as "" via ?? "" fallbacks in useCompanyProfile.ts.
- ProductLine.backupSupplierId, ProductLine.hsCode, Supplier.tier2Suppliers are all optional (v4.0) — no
  migration needed, existing profiles read back as undefined and every consumer treats absence as "not set."
- GDACS/NOAA events use a country-NAME-keyed region map in fetchGlobalDisasters.ts, separate from GDELT's
  FIPS-style country codes used elsewhere — do not reuse GDELT's mapCountryToRegion() for these sources,
  the same 2-letter code can mean different countries between the two schemes (v4.0).
- Sanctions/tariff/labor-calendar cards self-fetch via useCompanyProfile() and are NOT routed through the
  DisruptionEvent/ScoredEvent pipeline — they're profile-attribute checks, not news events (v4.0).

## Coding rules
- TypeScript strict — no implicit any
- Tailwind only for styling
- All external links: target="_blank" rel="noopener noreferrer"
- Every component must handle: loading state, error state, empty state
- App must work with fallback data if all APIs fail
- Never commit .env.local
- Always run: npm run build before declaring any change done
- Commit format: git commit -m "feat: [description]"
- Do NOT modify /lib/profile.ts, /lib/scoreEvents.ts, /lib/gemini.ts, or any API routes without explicit instruction

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
v2.8 — Gemini Rate Limit Fix (Apr 30, 2026):
        Fix: Comprehensive Gemini API rate limit handling built
             into /lib/gemini.ts — shared utility used by all 5 routes.
        Layer 1: Exponential backoff retry (2s/4s/8s) on 429 errors.
        Layer 2: Persistent in-memory cache with stale fallback —
                 serves last successful response during rate limit windows.
                 Caches: analyze 15min/60min, advisor 30min/90min,
                 event-brief 20min/60min, cost-estimate 60min/4hr.
        Layer 3: Request deduplication — concurrent identical calls
                 join the in-flight promise instead of each hitting the API.
        Layer 4: Graceful degradation — stale cache served with amber
                 "AI Cached" notice instead of error state.
        All 6 routes updated: analyze, advisor, event-brief, cost-estimate,
        chat (retry loop), scenario (retry loop).
        Navbar: AI Live / AI Cached / AI Recovering status dot.
        AIInsightPanel + AIAdvisor: stale data notice when serving cache.
v2.9 — Session 1 fixes (May 8, 2026):
        Fix: Supplier-to-product mapping — added primarySupplierId field to
             ProductLine type in /lib/profile.ts. Step 3 of profile form now
             has a supplier assignment dropdown per product. inventoryRisk.ts
             uses the assigned supplier's lead time instead of defaulting to
             highest-share supplier. Amber warning shown on cards still using
             the default. ProductRisk.supplierAssigned boolean added.
        Fix: History badge count — now reads actual localStorage count after
             each auto-save instead of incrementing with +1. No more
             discrepancy between badge and content count.
v3.0 — Session 2 professor feedback features (May 8, 2026):
        Feature: On-Time Delivery Threshold Alerts —
          /lib/performanceAlerts.ts stores and checks OTD and quality
          thresholds (default 85% OTD, 75% quality). When a supplier score
          drops below threshold for the first time, a dismissible amber alert
          banner appears on the Overview tab via PerformanceAlertBanner.tsx.
          Stored in scm_performance_alerts localStorage key.
        Feature: Lead Time Drift Tracking — /lib/leadTimeHistory.ts logs lead
          time history per supplier on every health score save.
          SupplierHealthScorecard shows a 4th column with lead time trend
          (↑↓→ with % drift). If lead time exceeds inventory days on hand for
          any assigned product, triggers a CRITICAL alert.
          Stored in scm_lead_time_history key.
        Feature: Disruption-Triggered Supplier Update Prompts —
          DisruptionUpdatePrompt.tsx detects new critical events in supplier
          regions since last visit (tracked via scm_last_visit). Shows a blue
          notification banner on Overview tab with links to update supplier
          data or review AI recommendations. Dismissed once per day.
v3.1 — Session 3 Supabase auth + database (May 8, 2026):
        Feature: Supabase authentication — email + password login via
          @supabase/ssr. New pages: /app/login/page.tsx and
          /app/signup/page.tsx with email confirmation flow.
        Feature: Database migration — useCompanyProfile hook is now
          Supabase-first with localStorage fallback for guests.
          Profile saves to Supabase when logged in, auto-migrates
          localStorage data on first login.
        Feature: Cross-device persistence — profile persists across all
          devices and browsers when signed in.
        New files: /lib/supabase.ts, /lib/supabase-server.ts,
          /hooks/useAuth.ts, /middleware.ts
        New pages: /app/login/page.tsx, /app/signup/page.tsx
        5 Supabase tables with Row Level Security:
          profiles, supplier_health, lead_time_history,
          disruption_history, performance_alerts
        Fix: Supabase client safe fallback during Vercel build time
          (placeholder values when env vars absent) + force-dynamic
          on auth pages to prevent prerender failures.
        Navbar updated: Sign in/Sign up for guests, email + Sign out
          for authenticated users.
        Guest mode preserved: app works fully without login using
          localStorage exactly as before.
v3.2 — Session 4: File Import with AI Interpretation (May 9, 2026):
        Feature: File upload dropzone on /profile page above the manual form —
          accepts Excel (.xlsx, .xls) and CSV files
        Feature: Client-side file parsing using xlsx and papaparse libraries —
          files never leave the browser
        Feature: /api/import-profile route — Gemini interprets extracted table
          data, maps columns to profile schema regardless of column naming
          conventions (abbreviations, non-English, company-specific)
        Feature: 4-step import flow (upload → processing → review → success)
          with editable supplier and product line fields, confidence indicators
          per field, ambiguity warnings
        Feature: Auto-saves to Supabase if logged in, localStorage if guest —
          consistent with rest of profile system
        New packages: xlsx, papaparse, @types/papaparse
        New files: /app/api/import-profile/route.ts,
          /lib/parseImportFile.ts, /components/ImportProfileFlow.tsx
v3.3 — Profile isolation + multi-sheet import fixes (May 9, 2026):
        Fix: Profile isolation — sign out now clears all SCM localStorage
          keys (scm_company_profile, scm_supplier_health, scm_inventory_log,
          scm_disruption_history, scm_active_tab, scm_performance_alerts,
          scm_lead_time_history, scm_last_visit, scm_prompt_dismissed) so
          next visitor starts with a clean slate.
        Fix: New sign-ins no longer inherit localStorage profile from a
          previous guest or different account. Each Supabase account starts
          with an empty profile, loaded from the database only.
        Fix: User-scoped localStorage cache key (scm_profile_{user.id})
          added for performance caching of logged-in user profiles.
        Fix: File import now reads ALL sheets from Excel files, not just
          the first sheet. Rows tagged with __sheet__ metadata field so AI
          knows which sheet each row came from.
        Fix: Gemini prompt updated to handle multi-sheet files — explicitly
          processes supplier sheets, inventory sheets, and PO history sheets.
          Calculates on-time delivery rates per supplier from PO history.
        Fix: ImportedProductLine now includes primarySupplierName field.
          Gemini extracts the primary supplier column per product.
          ImportProfileFlow fuzzy-matches supplier names to generated IDs
          after import. Review screen shows cyan ✓ or amber ⚠ per product.
        Changed files: /hooks/useAuth.ts, /hooks/useCompanyProfile.ts,
          /lib/parseImportFile.ts, /app/api/import-profile/route.ts,
          /components/ImportProfileFlow.tsx
v3.4 — Order Quantity Recommendation Engine (May 9, 2026):
        Feature: calculateOrderRecommendation() added to /lib/inventoryRisk.ts.
          Formula: lead time days + safety stock target − current inventory
          days remaining. Safety stock targets: Critical=30d, Warning=21d.
          Three urgency levels: Order Today (at/below reorder point),
          Order This Week (within 7 days of reorder), Plan Ahead.
        Feature: InventoryRiskPanel.tsx — recommendation panel added to each
          CRITICAL/WARNING product card showing urgency label, recommended
          days of supply, and one-sentence rationale naming supplier and lead
          time. Critical alert banner shows quick-reference pills per product.
        Feature: /lib/generateBrief.ts — Inventory Action Required section
          added to PDF with dark red section header, urgency badges, and
          order quantities per product. Inserted between Situation Snapshot
          and AI Advisor Recommendations.
        Feature: DashboardClient.tsx — inventoryRecs state computed from
          inventorySnapshot via useEffect, passed to DailyBriefButton as
          inventoryRecommendations prop. BriefData interface extended.
        Note: Expressed in days of supply (not units) since profile stores
          inventory in days, not unit quantities.
v3.5 — 7-Day Category Trend Sparklines (May 9, 2026):
        Feature: /lib/categoryTrends.ts — snapshot storage engine. Saves
          daily event counts per category to scm_category_trends localStorage
          key on each dashboard visit. Keeps 7-day rolling history. Calculates
          trend (rising/falling/stable) based on % change from oldest to newest
          entry. Generates SVG polyline points for sparkline rendering.
          Color coded: red=rising, green=falling, slate=stable.
        Feature: /components/CategorySparkline.tsx — 36×14px inline SVG
          sparkline component. Renders as polyline with no fill, 1.5px stroke,
          rounded caps. Only renders with 2+ data points.
        Feature: DisruptionFeed.tsx — sparkline and trend arrow (↑↓→) added
          inside each category filter pill. Hover tooltip shows 7-day percentage
          change. Existing filter functionality unchanged.
        Feature: AnalyticsTab.tsx — 7-Day Category Trends panel added below
          CategoryChart. 6 category cards each showing current event count,
          percentage change vs 7 days ago, sparkline, and trend direction label.
          Shows "building trend data" message on first visit until 2+ days of
          data are available.
        Data accumulates passively — no API calls, no user action required.
          Gets richer with every daily dashboard visit.
v3.6 — UI fixes: badge animation + article links (May 10, 2026):
        Fix: Removed animate-pulse from all text-bearing severity badges
          throughout the app. CRITICAL/WARNING/MONITOR badges in
          DisruptionFeed, KPIBar, InventoryRiskPanel, PerformanceAlertBanner,
          Navbar, and DisruptionUpdatePrompt are now static and fully readable.
          LIVE dot in navbar and small colored dot indicators retain their
          pulse animation. Root cause was criticalPulse keyframe + .critical-card
          CSS rule in globals.css — removed entirely. critical-card class
          reference removed from DisruptionFeed card div.
        Fix: Article links in the Live Disruption Feed no longer go to
          broken/placeholder pages. Events are NEVER removed from the feed
          regardless of URL quality. Good URLs show "Read →" linking directly
          to the article. Bad or empty URLs show "Search →" linking to a Google
          News search for that exact headline and source domain — user always
          reaches the content. Source domain displayed prominently in
          text-slate-400 on each card so users know the source before clicking.
        Added isUsableUrl() helper in /lib/fetchDisruptions.ts to detect
          placeholder domains (example.com etc.) without filtering events.
        Added buildFallbackSearchUrl() helper in /components/DisruptionFeed.tsx
          that constructs a Google News search URL from title + source domain.
        Updated DisruptionFeed.tsx to conditionally render "Read →" or
          "Search →" based on URL validity.
v3.7 — Supabase Phase B: supplier health, lead time, disruption history,
        performance alerts migrated to database (Jul 12, 2026):
        Feature: All 4 remaining localStorage-only datasets are now
          Supabase-backed for logged-in users, matching the pattern
          established by useCompanyProfile.ts — Supabase-first, localStorage
          fallback for guests, async save/load with an isLoaded flag.
        New files: /hooks/useSupplierHealth.ts, /hooks/useLeadTimeHistory.ts,
          /hooks/useDisruptionHistory.ts, /hooks/usePerformanceAlerts.ts —
          each owns all storage I/O for its dataset. The corresponding
          /lib/*.ts files were trimmed to pure types + calculation functions
          only (calculateCompositeScore, getGrade, calculateLeadTimeDrift,
          groupEntriesByMonth, exportHistoryAsCSV) — mirrors the existing
          lib/profile.ts (types) vs hooks/useCompanyProfile.ts (storage) split.
        Feature: One-time auto-migration — if a user has existing guest-mode
          localStorage data for any of these 4 features and Supabase has no
          rows yet on first login, it's bulk-copied once, then Supabase
          becomes the source of truth. Guest data is never silently discarded.
        DB migration: added UNIQUE(user_id, supplier_id) on supplier_health
          and UNIQUE(user_id, event_id) on disruption_history to support
          upsert-based dedup (all 4 tables already existed from the v3.1
          Supabase setup but were never wired into the app).
        Rewired components: PerformanceAlertBanner, DisruptionHistoryTab,
          SupplierHealthScorecard (handleSave is now async, added a
          "Saving…" disabled state), AIAdvisor, DashboardClient (removed
          duplicate localStorage reads for the History tab badge count).
        Fix (found during smoke testing): usePerformanceAlerts.ts's guest
          path eagerly evaluated loadLocalAlerts() at the moment its own
          "performanceAlertCreated" event listener fired, racing ahead of
          an in-flight localStorage write queued just before it in the same
          synchronous burst (e.g. two alerts created back-to-back in one
          handleSave call) — the second alert would silently overwrite the
          first in both React state and localStorage. Fixed by making that
          setState call functional (`setAlerts(() => loadLocalAlerts())`)
          so the read is deferred to match write ordering.
        Guest mode confirmed unaffected — verified end-to-end via browser
          automation (profile setup, health score save with threshold-
          crossing alerts, dismiss, history auto-save) since account
          creation/login could not be performed by the agent per policy;
          the logged-in Supabase path should be spot-checked manually.
v3.8 — Headquarters country field (Jul 12, 2026):
        Feature: CompanyProfile gained a required headquartersCountry field
          (free-text, same pattern as Supplier.country) — suggested by an
          Inventory Manager as context to sharpen AI insights. Added to
          Step 1 of the profile setup form (/app/profile/page.tsx), right
          after Company Name, with its own required-field validation.
        Feature: Wired into /api/advisor and /api/analyze prompts — the AI
          advisor and daily summary now know the company's headquarters
          location. /api/chat, /api/scenario, /api/event-brief, and
          /api/cost-estimate were intentionally left untouched (out of
          scope for this change).
        DB migration: added headquarters_country text column to the
          profiles table. useCompanyProfile.ts reads/writes it alongside
          the existing JSONB profile columns; existing rows read back as ""
          via a nullish-coalescing fallback.
v3.9 — Import AI: messy real-world file handling (Jul 12, 2026):
        Context: an Inventory Manager gave 3 real ERP exports (Sales
          Region / Customer / Factory Inventory Metrics) to stress-test
          the import flow. None contain supplier or product names —
          they're dollar-value rollups by internal dimensions the
          profile schema doesn't model. This release makes the import
          AI handle that kind of file honestly instead of mis-mapping
          it, without adding any new profile entities.
        Feature: recognize dollar-value inventory ("On Hand $" + a
          usage/consumption $ column) as an alternate way of expressing
          product inventory position, alongside the existing "days on
          hand" column recognition. Gemini extracts the raw $ figures
          only (onHandValue, usageValue, usageWindowDays inferred from
          the usage column's name, e.g. "3mo Usage $" → 90 days);
          lib/importCalculations.ts computes the actual days-on-hand
          number afterward.
        Feature: DIMENSION CLASSIFICATION gate — the row-identifying
          column's header (not the presence of $-value metrics) decides
          whether rows are suppliers, products, or unmappable. Fixes a
          bug caught during verification: the AI initially force-fit
          factory codes ("ATD", "ATH"...) into product lines purely
          because the $-value pattern matched, ignoring that the column
          was literally labeled "Factory".
        Feature: honest unmappedData reporting — ImportResult gained an
          unmappedData[] field (sheetOrSection, detectedDimension,
          detectedMetrics, reason). ImportProfileFlow.tsx's review step
          now shows what was actually found in a sheet that doesn't map
          to a supplier or product ("dollar-value inventory data
          organized by Customer...") instead of the old generic "could
          not extract supply chain data" dead end.
        Fix: Grand Total/Total/Subtotal rows are now excluded
          everywhere as aggregation artifacts, not real entities —
          verified against a real file where "Grand Total" was
          confirmed to be a plain sum of the rows above it.
        Fix: share % distribution across suppliers moved out of the AI
          prompt into distributeShareEvenly() — same for day-supply
          math — since LLM arithmetic across many rows is unreliable.
        New file: /lib/importCalculations.ts (computeDaysOnHand,
          distributeShareEvenly).
        Verified end-to-end against all 3 real test files (each
          correctly lands in unmappedData with accurate descriptions,
          zero garbage suppliers/products) plus a synthetic SKU-based
          $-value CSV (correct computed days-on-hand) and a regression
          check on a normal supplier-list CSV (unaffected).
        Note: primaryMarkets (region-level "where you sell") and HQ
          location were evaluated together — HQ location was judged low
          value for scoring (doesn't predict physical disruption exposure)
          and was added as AI context only, not wired into scoreEvents.ts.
v4.0 — 8 next-level features: compliance, market data, supply chain depth
        (Jul 13, 2026). Researched what real supply chain risk platforms
        (Resilinc, Everstream, Interos) treat as core capabilities, cross-
        checked against free/no-auth data sources before committing to any
        of them — one candidate (live freight rates via Freightos Baltic
        Index) turned out to require a paid account, so that item became an
        honesty fix instead of a new data feed. All 8 built and verified
        live via browser automation before this release:
        Feature 1: Backup/alternate supplier — ProductLine.backupSupplierId,
          Step 3 dropdown (filtered to exclude primary), inventoryRisk.ts
          resolves it with no fallback (unlike primary), InventoryRiskPanel
          shows "✓ Backup available: X (Nd lead time)" when an active
          disruption hits the primary supplier's region.
        Feature 2: Sanctions/OFAC screening — /api/sanctions-check fetches
          the Treasury SDN CSV (free, 24hr cache), lib/sanctionsScreening.ts
          does lightweight token-overlap name matching (no fuzzy-match
          library needed), SanctionsScreeningCard shows amber "⚠ Possible
          match — verify manually" (never a definitive claim) with a link to
          the official OFAC search tool. Individual-type SDN entries
          filtered out (companies only).
        Feature 3: Currency/FX exposure — /api/market-data extended with an
          8-currency FX block (CNY/VND/KRW/TWD/INR/MXN/EUR/GBP, Yahoo
          {CODE}=X tickers), CurrencyExposureCard filters to only the
          currencies of the logged-in profile's actual supplier countries
          via lib/currencyMapping.ts.
        Feature 4: Global disaster layer — lib/fetchGlobalDisasters.ts
          (GDACS: earthquakes/cyclones/floods/volcanoes/droughts/wildfires,
          genuinely global) + lib/fetchWeatherAlerts.ts (NOAA/NWS, US-only
          supplement for faster domestic alerts) merged into the existing
          GDELT pipeline via Promise.all in fetchDisruptions.ts — zero
          changes needed downstream since everything already consumes the
          generic DisruptionEvent/ScoredEvent shape. Live-verified: 90 total
          events (GDACS: 6, NOAA: 59). Cyclones/floods/wildfires map to
          category "Weather"; earthquakes/volcanoes/droughts map to
          "General" (no new categories added — DisruptionCategory stayed
          closed to avoid touching categoryPainPointMap/CategoryChart/
          categoryTrends fan-out). Used a country-NAME-keyed region map for
          GDACS, deliberately separate from GDELT's FIPS-style codes used
          elsewhere in the app (same 2-letter code can mean different
          countries between the two schemes, e.g. "CH").
        Feature 5: Freight rate honesty fix — added lastVerified date to
          each FreightRate entry, FreightRateCard now reads "Reference · not
          live" instead of implying real-time data. No live free freight
          index exists (Freightos Baltic Index requires a paid account) —
          documented rather than faked.
        Feature 6: Labor/union contract calendar — lib/laborCalendar.ts,
          two verified entries: ILWU/PMA West Coast (expires Jul 1, 2028)
          and ILA/USMX East/Gulf Coast (expires Sep 30, 2030), each sourced
          to a specific article (Supply Chain Dive, gCaptain) with a
          lastVerified date. LaborCalendarCard surfaces contracts within a
          180-day lookahead whose trade lanes overlap the profile; both
          verified entries are currently outside that window (freshly
          renewed long-term deals) so the card shows a compact reference
          line instead of an alert — stated plainly, not oversold.
        Feature 7: HS code / tariff lookup — ProductLine.hsCode (optional),
          /api/tariff-lookup queries the USITC HTS REST API (free, no auth,
          24hr per-code cache), TariffRateBadge shown on product cards
          ("Est. duty rate: X% (general rate, HTS Y)" + special program rate
          if present).
        Feature 8: Multi-tier sub-supplier visibility — Supplier.
          tier2Suppliers (optional, manual entry only — no public database
          of company supply relationships exists), Step 2 gets an
          expandable "Who does {supplier} buy from?" section per supplier
          card, WorldMap.tsx adds a third color tier (violet #a78bfa) for
          tier-2 countries with "📍 {country} — INDIRECT EXPOSURE via
          {tier-1 supplier names} — N active events" hover text.
        Architectural note: sanctions/tariff/labor-calendar are NOT news
          events — they're static profile-attribute checks — so they follow
          the self-contained "risk card" pattern (mirrors
          ConcentrationRiskCard.tsx/SupplierHealthScorecard.tsx): each
          self-fetches via useCompanyProfile(), not routed through the
          DisruptionEvent/ScoredEvent scoring pipeline.
        Bug caught during verification: a plain date-only ISO string
          (e.g. "2028-07-01") parses as UTC midnight, so
          .toLocaleDateString() without { timeZone: "UTC" } silently rolls
          the displayed month/day back by one in US timezones. Caught live
          in the browser on LaborCalendarCard ("Jun 2028" instead of "Jul
          2028"), fixed there and retroactively in FreightRateCard's
          verifiedDate which had the identical latent bug from Feature 5.
        Verification: all 4 external data sources (OFAC, GDACS, NOAA, USITC
          HTS) curl-tested live before wiring into the UI. Feature 8
          end-to-end verified via browser automation: added a tier-2
          supplier through the profile form, confirmed persistence in
          localStorage, confirmed the violet map highlight and hover text
          render correctly. npm run build passes clean.

## Known issues / next session notes
- Supabase env vars must be added to Vercel settings for production auth to work
- Logged-in Supabase path for supplier health / lead time / disruption
  history / performance alerts (v3.7) and headquarters_country (v3.8) has
  not been manually verified in production — guest/localStorage path was
  verified via browser automation, but sign-in flows are outside what the
  agent can drive. Spot-check after deploy.
- v4.0's 8 features (Feature 1–8) were verified via browser automation using a
  guest/localStorage test profile — the logged-in Supabase path for the new
  optional Supplier/ProductLine fields (tier2Suppliers, backupSupplierId,
  hsCode) has not been separately spot-checked in production. These fields
  live inside the existing JSONB profile column so no new migration is
  needed, but worth a production sanity check after deploy.
- Next priorities:
  [ ] Watchlist with notification badges
  [ ] Custom domain setup
  [ ] Mobile responsiveness (deferred — desktop only for now)

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
- [x] External data feeds — Yahoo Finance commodity prices + freight rates (Apr 25, 2026)
- [x] Per-event "Why This Matters" AI brief on card click (Apr 26, 2026)
- [x] Export / PDF daily brief generator (Apr 26, 2026)
- [x] Inventory Risk Calculator with reorder alerts (Apr 28, 2026)
- [x] Supplier Health Scorecard with performance logging and AI integration (Apr 28, 2026)
- [x] Cost Impact Estimator with financial framing for recommendations (Apr 28, 2026)
- [x] Supplier Concentration Risk Score (HHI) with visual breakdown (Apr 28, 2026)
- [x] Disruption History Log with 90-day timeline and CSV export (Apr 28, 2026)
- [x] Gemini rate limit fix — retry, dedup, stale cache, status indicator (Apr 30, 2026)
- [x] Supplier-to-product mapping fix (May 8, 2026)
- [x] History badge count fix (May 8, 2026)
- [x] On-time delivery threshold alerts (May 8, 2026)
- [x] Lead time drift tracking (May 8, 2026)
- [x] Disruption-triggered supplier update prompts (May 8, 2026)
- [x] Supabase auth + database migration (May 8, 2026)
- [x] Session 4: File import with AI interpretation (May 9, 2026)
- [x] Profile isolation fix — sign out clears localStorage (May 9, 2026)
- [x] Multi-sheet Excel import (May 9, 2026)
- [x] Primary supplier auto-assignment from imported file (May 9, 2026)
- [x] Order quantity recommendation engine (May 9, 2026)
- [x] 7-day trend sparklines per disruption category (May 9, 2026)
- [x] Remove pulse animation from text-bearing severity badges (May 10, 2026)
- [x] Google News fallback links for broken article URLs (May 10, 2026)
- [x] Supabase Phase B: migrate supplier health, lead time history,
      disruption history, performance alerts to database tables (Jul 12, 2026)
- [x] Headquarters country field on profile, wired into AI advisor/analyze prompts (Jul 12, 2026)
- [x] Import AI: dollar-value inventory recognition, dimension classification, honest
      unmappedData reporting for messy real-world files (Jul 12, 2026)
- [x] Backup/alternate supplier designation (Jul 13, 2026)
- [x] Sanctions/OFAC screening with legally careful match copy (Jul 13, 2026)
- [x] Currency/FX exposure tracking (Jul 13, 2026)
- [x] Global disaster layer — GDACS (global) + NOAA (US supplement) (Jul 13, 2026)
- [x] Freight rate honesty fix — labeled reference, not live (Jul 13, 2026)
- [x] Labor/union contract expiration calendar (Jul 13, 2026)
- [x] HS code / tariff duty rate lookup via USITC HTS API (Jul 13, 2026)
- [x] Multi-tier sub-supplier visibility on WorldMap (Jul 13, 2026)
- [ ] Watchlist with notification badges
- [ ] Custom domain setup
- [ ] Mobile responsiveness (deferred — desktop only for now)
