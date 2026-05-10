# SCM Disruption Monitor — Project Memory

## What this project is
Full-stack Next.js 14 (App Router, TypeScript) supply chain risk monitoring dashboard.
Portfolio project for a Supply Chain Management master's student with a systematic 
trading and financial markets background.

## Live project
- GitHub: https://github.com/balrajkooner14-stack/scm-disruption-monitor
- Live URL: https://scm-disruption-monitor.vercel.app
- Status: v3.5 live

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
  - profiles — company profile (JSONB columns for arrays)
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

/components
  Navbar.tsx                      → Sticky nav: logo, LIVE indicator, clock, profile button, dark mode,
                                    auth state (Sign in/Sign up for guests; email + Sign out when logged in)
  AIInsightPanel.tsx              → Gemini AI summary panel (profile-aware, 10min cache)
  DashboardClient.tsx             → 5-tab hub: Overview / Advisor / Scenarios / Analytics / History.
                                    switchTab custom event listener. DisruptionUpdatePrompt + PerformanceAlertBanner on Overview.
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

/lib
  types.ts                        → DisruptionEvent, DisruptionCategory
  fetchDisruptions.ts             → GDELT fetcher (3 queries, deduplication, fallback)
  scoreEvents.ts                  → ScoredEvent type, scoreEventsForProfile()
  profile.ts                      → CompanyProfile type + all sub-types, PROFILE_STORAGE_KEY.
                                    ProductLine now has optional primarySupplierId field.
  generateBrief.ts                → jsPDF layout engine: BriefData interface, generateDailyBrief()
  inventoryRisk.ts                → Risk calculation engine: calculateInventoryRisk(), getDaysSinceDate(), getInventoryBarColor().
                                    Uses product.primarySupplierId for lead time; falls back to highest-share supplier.
                                    ProductRisk now includes supplierAssigned boolean.
  supplierHealth.ts               → Score engine: calculateCompositeScore(), getGrade(), buildHealthScores(),
                                    loadHealthEntries(), saveHealthEntry(). Storage key: scm_supplier_health
  concentrationRisk.ts            → HHI engine: calculateConcentrationRisk(), buildBreakdown().
                                    4 levels: diversified (<1500), moderate (1500-2500), concentrated (2500-5000), critical (>5000)
  disruptionHistory.ts            → localStorage log: saveEventsToHistory(), loadHistory(), exportHistoryAsCSV(),
                                    groupEntriesByMonth(). Storage key: scm_disruption_history. 90-day retention, 500 cap, dedup by URL+date
  performanceAlerts.ts            → Alert storage+logic: loadAlerts(), saveAlerts(), dismissAlert(), getActiveAlerts(),
                                    checkAndCreateAlerts(). Defaults: 85% OTD, 75% quality. Storage key: scm_performance_alerts
  leadTimeHistory.ts              → Lead time history: recordLeadTime(), getLeadTimeHistory(), calculateLeadTimeDrift().
                                    Max 12 entries/supplier. 20% drift = significant. Storage key: scm_lead_time_history
  supabase.ts                     → createClient() — browser Supabase client (createBrowserClient, safe fallback during build)
  supabase-server.ts              → createServerSupabaseClient() — server component client (createServerClient + CookieOptions)
  parseImportFile.ts              → Client-side file parser: parseFile() for CSV (papaparse) and Excel (xlsx),
                                    prepareForAI() trims to 20 rows for token efficiency. 50-row cap.

/hooks
  useCompanyProfile.ts            → Supabase-first with localStorage fallback for guests.
                                    Loads from Supabase when logged in, auto-migrates localStorage on first login.
                                    saveProfile() and clearProfile() are now async.
  useAuth.ts                      → useAuth() hook: user, session, isLoading, signOut. Uses onAuthStateChange listener.

/middleware.ts                    → Session refresh on every request (getSession). Does NOT block unauthenticated routes.

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
- /api/import-profile — Accepts POST {extractedData, fileName}. Gemini maps columns to ImportResult schema
                        (suppliers, productLines, missingFields, ambiguities, rawColumnNames). 5min cache.

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
- scm_company_profile — company profile data (CompanyProfile type). Supabase is primary when logged in; localStorage is backup/guest.
- scm_supplier_health — supplier performance scores (Record<supplierId, SupplierHealthEntry>)
- scm_inventory_log — inventory risk alert log
- scm_disruption_history — 90-day event history (HistoryEntry[], max 500 entries)
- scm_active_tab — last active tab ("overview"|"advisor"|"scenarios"|"analytics"|"history")
- scm_performance_alerts — OTD and quality threshold alerts (PerformanceAlert[])
- scm_lead_time_history — lead time history per supplier (LeadTimeHistory record)
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

## Known issues / next session notes
- Supabase tables must be created manually via SQL Editor (DDL in session 3 notes)
- Supabase env vars must be added to Vercel settings for production auth to work
- Only profile is Supabase-synced so far — supplier health, lead time history,
  disruption history, performance alerts still use localStorage only (Phase B)
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
- [ ] Watchlist with notification badges
- [ ] Custom domain setup
- [ ] Mobile responsiveness (deferred — desktop only for now)
- [ ] Supabase Phase B: migrate supplier health, lead time history,
      disruption history, performance alerts to database tables
