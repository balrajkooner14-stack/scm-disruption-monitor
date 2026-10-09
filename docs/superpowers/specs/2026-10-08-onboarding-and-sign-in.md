# Onboarding + sign-in — implementation spec

Date: 2026-10-08 · Target version: **v5.1** · Baseline: v5.0 (commit `b983e34`)
Owner: Balraj Kooner · Implementer: Claude Code

This spec is self-contained. The design canvas it came from is private and you cannot open it. The mockups are in `onboarding-reference/` next to this file. When this spec and a mockup disagree, **this spec wins**.

---

## 0. How to run this

**Kickoff prompt (Balraj pastes this into Claude Code):**

> Read `docs/superpowers/specs/2026-10-08-onboarding-and-sign-in.md` in full, then open every HTML file in `docs/superpowers/specs/onboarding-reference/`. Create the branch `feat/onboarding-and-sign-in` from `main`. Commit the spec and reference folder first as a separate `docs:` commit. Then give me your plan for Phase 1 and any questions before editing. After I answer, run Phases 1–4, then stop so I can try sign-up and the first onboarding screens in the browser. After I confirm, run the remaining phases, reporting after each. One commit per phase. Run the section 12 checks after every phase. Do not push.
>
> [OPTIONAL — keep this line only if you approve Phase 9] I authorize editing `lib/scoreEvents.ts` for Phase 9 (port-name matching), exactly as specified there.

**Working rules for the implementer**

- Branch `feat/onboarding-and-sign-in`, one commit per phase (section 11). Do not push.
- **Protected files stay untouched** unless the kickoff prompt contains the Phase 9 authorization line: `app/api/**`, `lib/profile.ts`, `lib/scoreEvents.ts`, `lib/gemini.ts`. This spec is designed so nothing else requires them. You may **import and call** functions from them.
- Also do not modify: `lib/fetchDisruptions.ts`, `lib/tradeFeeds.ts`, `lib/fetchTradeNews.ts`, `lib/fetchGlobalDisasters.ts`, `lib/fetchWeatherAlerts.ts`, `lib/supplyChainGraph.ts`, `middleware.ts`.
- You **may** modify the hooks listed in section 4.6. That is a deliberate change from the v5.0 spec.
- Do not rename any existing `scm_*` localStorage key or any existing Supabase column.
- All First Light rules from CLAUDE.md ("Design system (First Light)") apply: tokens and `lib/ui.ts` recipes only, `COLOR` from `lib/brand.ts` for raw hex, no emoji, no pulse/ping outside skeletons, no accent side borders, sentence-case headings, light-only.
- Every new screen handles loading, error and empty states. External links use `target="_blank" rel="noopener noreferrer"`.
- **Honesty rules** (non-negotiable, the product depends on trust): never fabricate data to fill a screen. Every count, event and insight shown during onboarding is computed from the user's real input and today's real events. When nothing matches, say so plainly (copy given per screen).
- If a step needs something outside this spec (a new dependency, a protected file, a schema change beyond section 3.6), stop and ask.

---

## 1. What we're building and why

Today, a new user meets a 5-step form with many required fields before seeing anything useful, and can only sign in with email and password. Prospects from outreach will drop off there.

v5.1 replaces that with:

1. **Sign-in that business users expect:** Google, Microsoft, and a 6-digit email code. Existing email/password accounts keep working.
2. **A new first-run onboarding at `/onboarding`** that gets a user from sign-up to "here is what touches my supply chain today" in about 4 minutes.
3. **A dashboard setup checklist** that collects the rest of the profile over time.
4. **A sample-company mode** for prospects who want to look before sharing data, and for Balraj's demos.

`/profile` stays as the full profile editor for later changes.

### 1.1 Design principles (these are why users stay engaged; keep them in every decision)

- **Value before effort.** The sign-up screen shows today's live disruptions before asking for anything.
- **Every answer pays off right away.** Each step has a right-hand panel that reacts to what the user just entered, using real events: their countries on a map, live news at their ports, a single point of failure found in their products.
- **Ask only what's needed to start.** Company basics, suppliers, products. Everything else is skippable or moves to the checklist.
- **Progress you can feel.** The progress bar is the Foreglow sun rising along the horizon, with minutes remaining instead of "step 2 of 4".
- **A real finish line.** The last screen ("First light, {company}.") shows their top exposures today, then hands off to the dashboard.
- **Never lose work.** Drafts autosave; "Save and finish later" is always available.

### 1.2 Non-goals

- Team accounts, invites, roles and permissions (the checklist item is behind a flag that stays off).
- The morning email itself (the toggle is behind a flag that stays off until email sending exists).
- Billing, trials, plan limits.
- Mobile-specific layouts. Keep layouts usable down to 1024px wide; below that, stack the right-hand panel under the form.

---

## 2. Screen flow

```
/signup ─┬─ Google / Microsoft ─┐
         └─ email → 6-digit code ┴─▶ /auth/callback (OAuth) or client verify (code)
                                         │
                       profile exists? ──┼─ yes ─▶ /
                                         └─ no ──▶ /onboarding

/onboarding
  Choose how to start ─┬─ Upload spreadsheet ─▶ Company ─▶ Import review ─▶ Ports ─▶ First light ─▶ /
                       ├─ Type in suppliers  ─▶ Company ─▶ Suppliers ─▶ Ports ─▶ Products ─▶ First light ─▶ /
                       └─ Sample company     ─▶ demo mode ─▶ /
```

Progress bar labels: **Company · Suppliers · Ports · Products**. On the import path the bar shows **Company · Import · Ports** (three stops).

Guests (not signed in) can still use the app as today. `/signup` and `/login` include a quiet link "Try it without an account", which goes to `/onboarding`; guest onboarding saves to localStorage exactly like the current guest profile.

---

## 3. Part A — Balraj's manual setup (outside the code)

Claude Code: do not block on these. Build so that everything works when they are missing (section 5.1 flags), and include this section's checklist in your final report as "Balraj to do".

### 3.1 Domain first

Buy the product domain before configuring providers. OAuth origins, email sending and the Google consent screen all reference it. Until then, use `https://scm-disruption-monitor.vercel.app`.

### 3.2 Supabase URL configuration

Supabase → Authentication → URL Configuration:
- **Site URL:** the production URL.
- **Redirect URLs:** `https://<production-domain>/**`, `https://scm-disruption-monitor.vercel.app/**`, `http://localhost:3000/**`, and the Vercel preview pattern for this project (Vercel → Project → Domains shows it; typically `https://*-<team-slug>.vercel.app/**`).

### 3.3 Custom email sending (required before real users)

Supabase's built-in email sender allows **2 emails per hour** and is meant for testing ([Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)).
- Create a Resend account, verify the domain (DNS records), create an SMTP key.
- Supabase → Authentication → SMTP Settings → enable custom SMTP with Resend's host/port/user/key. Sender: `Foreglow <hello@<domain>>`.
- Disable link and click tracking in Resend for auth emails.

### 3.4 Email templates (6-digit code)

Supabase → Authentication → Email Templates. In **Magic Link** and **Confirm signup**, make the main content the code:

```
<h2>Your Foreglow sign-in code</h2>
<p>Enter this code to continue:</p>
<p style="font-size:28px;font-weight:600;letter-spacing:6px">{{ .Token }}</p>
<p>It expires in 1 hour. If you didn't request it, you can ignore this email.</p>
```

Set Auth → Providers → Email → OTP expiry to 3600 seconds.

### 3.5 Google and Microsoft

**Google** ([Supabase guide](https://supabase.com/docs/guides/auth/social-login/auth-google)):
1. Google Cloud Console → Google Auth Platform: audience External.
2. Data Access: add `openid` (email and profile are default).
3. Branding: app name "Foreglow", logo, support email, authorized domain.
4. Clients → create OAuth client, type Web application. Authorized JavaScript origins: production URL and `http://localhost:3000`. Authorized redirect URI: the callback URL shown on Supabase → Authentication → Providers → Google.
5. Paste client ID and secret into Supabase → Providers → Google; enable.
6. Note: the consent screen shows `zekhnneilcploogfudsp.supabase.co` until a Supabase custom auth domain is set up (paid add-on). Acceptable for pilots.

**Microsoft:**
1. Microsoft Entra admin center → App registrations → New registration. Supported account types: "Accounts in any organizational directory and personal Microsoft accounts". Redirect URI (Web): the Supabase callback URL.
2. Certificates & secrets → new client secret; put its expiry date in your calendar.
3. API permissions: Microsoft Graph delegated `email`, `openid`, `profile`.
4. Supabase → Providers → **Azure**: client ID, secret, tenant URL `https://login.microsoftonline.com/common`; enable.

### 3.6 Database change (run once in Supabase SQL editor)

```sql
alter table public.profiles
  add column if not exists onboarding jsonb not null default '{}'::jsonb;
```

Existing row-level security on `profiles` already restricts each row to its owner; no policy change needed. Claude Code: also save this SQL as `supabase/migrations/20261008_profiles_onboarding.sql` for the record (the repo has no migrations folder yet; create it).

### 3.7 Vercel environment variables

| Variable | Value | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_AUTH_GOOGLE` | `1` once Google is configured | Shows "Continue with Google" |
| `NEXT_PUBLIC_AUTH_MICROSOFT` | `1` once Microsoft is configured | Shows "Continue with Microsoft" |
| `NEXT_PUBLIC_SETUP_CALL_URL` | Calendly/Cal.com link, optional | Shows "Book a setup call" links |

Set them for Production and Preview. Unset means hidden.

---

## 4. Architecture

### 4.1 New and changed routes

| Route | Type | Purpose |
| --- | --- | --- |
| `/signup` | Server page + client panel | New design (screen 1). `export const revalidate = 1800`; fetches events with `fetchDisruptions()` for the live panel |
| `/login` | Server page + client panel | Same layout as signup, sign-in copy, plus password fallback |
| `/auth/callback` | Route handler | Exchanges the OAuth/recovery code for a session, then routes (5.4) |
| `/auth/error` | Page | Friendly failure screen with "Try again" |
| `/reset-password` | Client page | Set a new password after a recovery email |
| `/onboarding` | Server page + client flow | The guided setup. `revalidate = 1800`; fetches events server-side |
| `/` | Existing | Adds the demo banner and setup checklist |
| `/profile` | Existing | Supports `?step=N`, and gains a section for role and entry ports |

Remove `export const dynamic = "force-dynamic"` from the auth pages only if the new server-wrapper structure makes it unnecessary; keep the client parts client-only.

### 4.2 New files

```
lib/onboarding.ts          // OnboardingExtras type, defaults, onboardingToProfile(), deriveTradeLanes()
lib/countries.ts           // country list for autocomplete + countryToSupplyRegion()
lib/ports.ts               // PORTS list, port keywords, matchEventsToPorts()
lib/onboardingInsights.ts  // pure functions for every right-hand panel and the finish screen
lib/setupChecklist.ts      // pure: computeChecklist(profile, extras, flags)
lib/sampleProfile.ts       // SAMPLE_PROFILE + SAMPLE_EXTRAS (Meridian Electronics)
lib/demoMode.ts            // isDemoMode(), enterDemoMode(), exitDemoMode()
lib/authProviders.ts       // which sign-in providers are enabled (env flags)
hooks/useOnboardingExtras.ts
components/auth/AuthPanel.tsx          // provider buttons + email code flow (signup and login)
components/auth/LiveEventsPanel.tsx    // dark right-hand panel on /signup and /login
components/onboarding/OnboardingFlow.tsx
components/onboarding/OnboardingHeader.tsx    // logo, horizon progress, time left, save-and-finish-later
components/onboarding/HorizonProgress.tsx
components/onboarding/StepChoosePath.tsx
components/onboarding/StepCompany.tsx
components/onboarding/StepSuppliers.tsx
components/onboarding/StepPorts.tsx
components/onboarding/StepProducts.tsx
components/onboarding/StepImport.tsx
components/onboarding/StepFirstLight.tsx
components/onboarding/OnboardingMap.tsx       // react-simple-maps, read-only
components/onboarding/MiniNetwork.tsx         // SVG supplier → product diagram
components/SetupChecklist.tsx
components/DemoBanner.tsx
app/auth/callback/route.ts
app/auth/error/page.tsx
app/reset-password/page.tsx
app/onboarding/page.tsx
supabase/migrations/20261008_profiles_onboarding.sql
```

### 4.3 Data model: `OnboardingExtras`

`CompanyProfile` (protected) is not changed. Everything new lives in a sibling object stored in the new `profiles.onboarding` column (signed in) or localStorage (guest).

```ts
// lib/onboarding.ts
export type OnboardingRole = "procurement" | "operations" | "planning" | "executive"
export type OnboardingPath = "import" | "manual" | "sample"

export interface OnboardingExtras {
  version: 1
  role?: OnboardingRole
  entryPorts?: string[]                    // PORTS ids, or "custom:<name>"
  inventoryAsOf?: Record<string, string>   // productLine.id → ISO date of the stock count
  inventoryUnknown?: string[]              // productLine ids where stock was skipped
  reorderPointDefaulted?: string[]         // productLine ids whose reorder point was set = lead time
  leadTimeUnknown?: string[]               // supplier ids with no lead time entered
  primaryMarketsDerived?: boolean          // true when primaryMarkets came from HQ, not the user
  path?: OnboardingPath
  startedAt?: string
  completedAt?: string
  checklistInitial?: string[]              // checklist item ids open at completion (for "N of M done")
  checklistDismissedAt?: string
  morningEmail?: boolean                   // stored only; no sending yet
}

export const EMPTY_EXTRAS: OnboardingExtras = { version: 1 }
```

Storage keys (add both to the sign-out clear list in `hooks/useAuth.ts`):
- `scm_onboarding`: saved extras for guests.
- `scm_onboarding_draft`: the in-progress onboarding state (section 4.5), for everyone.

### 4.4 Mapping onboarding answers to `CompanyProfile`

`onboardingToProfile(draft): CompanyProfile` in `lib/onboarding.ts`. It is the only place this mapping lives. It must produce a profile that passes every existing consumer (scoring, inventory, graph, AI routes) without changing them.

| `CompanyProfile` field | Source |
| --- | --- |
| `companyName` | Company step |
| `headquartersCountry` | Company step |
| `sector` | Company step chip → `IndustrySector` (table below) |
| `revenueRange` | Company step chip (exact enum values) |
| `primaryMarkets` | `[countryToSupplyRegion(headquartersCountry)]`; set `extras.primaryMarketsDerived = true` |
| `suppliers` | Suppliers step (or import). `id` = `crypto.randomUUID()`. `region` = `countryToSupplyRegion(country)`. `sharePercent` = `distributeShareEvenly(n)` from `lib/importCalculations.ts`. `leadTimeDays` = entered value, else `0` and add id to `extras.leadTimeUnknown`. `tier2Suppliers` omitted |
| `productLines` | Products step (or import). `inventoryDaysOnHand` = entered value, else `0` and add id to `extras.inventoryUnknown`. `reorderPointDays` = primary supplier's lead time when known (add id to `extras.reorderPointDefaulted`), else `0`. `primarySupplierId` = chosen supplier. Other optional fields omitted |
| `painPoints` | `[]` (collected later via checklist) |
| `transportModes` | Ports step chips: Ocean → `"Ocean Freight"`, Air → `"Air Freight"`, Truck → `"Truck"`, Rail → `"Rail"` |
| `tradeLanes` | `deriveTradeLanes(entryPorts, suppliers)` (4.4.1) |
| `createdAt` / `updatedAt` | now |
| extras | `inventoryAsOf[productId]` = entered as-of date (default today) for every product with stock entered |

Sector chips (label → enum): Electronics & components → `Electronics`; Automotive → `Automotive`; Industrial parts → `Industrial`; Apparel & footwear → `Apparel`; Consumer & retail goods → `Retail`; Food & beverage → `Food & Beverage`; Pharma & medical → `Pharmaceuticals`; Aerospace → `Aerospace`; Something else → `Other`.

Revenue chips: the four `revenueRange` values, labelled "Under $10M", "$10M–$100M", "$100M–$1B", "$1B+".

#### 4.4.1 `deriveTradeLanes`

The existing scorer already matches trade-lane keywords such as "los angeles", "long beach", "savannah" (see `laneKeywords` in `lib/scoreEvents.ts`). Deriving lanes from ports makes port answers improve relevance today without touching the scorer.

Let `regions` = set of supplier regions. Start from an empty set and add:

| Entry port selected | Condition | Lane added |
| --- | --- | --- |
| LA/Long Beach, Oakland, Seattle/Tacoma | `Asia Pacific` in regions | `Asia-Pacific to US West Coast` |
| NY/NJ, Savannah, Charleston | `Asia Pacific` in regions | `Asia-Pacific to US East Coast` |
| NY/NJ, Savannah, Charleston, Houston | `Europe` in regions | `Europe to US` |
| Houston, Laredo | `Latin America` in regions | `Latin America to US` |
| any | `Middle East` in regions and `Europe` in regions | `Middle East to Europe` |

If no ports were selected, fall back to: `Asia Pacific` suppliers → `Asia-Pacific to US West Coast`; `Europe` → `Europe to US`; `Latin America` → `Latin America to US`. Return a de-duplicated array of `TradeLane` values.

### 4.5 Draft autosave and resume

- The whole flow state (`path`, current step, all answers, `startedAt`) is saved to `scm_onboarding_draft` on every change, debounced 400ms.
- `/onboarding` restores the draft if one exists and lands on the step the user left.
- "Save and finish later" (header link):
  - If at least one supplier exists: save the profile and extras now (`completedAt` unset), keep the draft, go to `/`. The dashboard checklist shows a first item "Finish setting up" linking back to `/onboarding`.
  - If not: keep the draft and go to `/`.
- On completion (finish screen reached), delete the draft.
- If a signed-in user who already has a profile opens `/onboarding`, show a short notice ("You've already set up {company}. Edit your profile instead?") with links to `/profile` and `/`. Do not overwrite their data.

### 4.6 Hooks

- `hooks/useOnboardingExtras.ts` (new). Same pattern as `useCompanyProfile`: Supabase-first, localStorage for guests, `isLoaded`, `saveExtras(partial)` merges and persists. Signed in: `supabase.from("profiles").update({ onboarding }).eq("id", user.id)`; a profile row must exist first, so callers save the profile before the extras.
- `hooks/useCompanyProfile.ts`: add demo-mode support (4.7). No other behavior change.
- `hooks/useAuth.ts`: add `scm_onboarding`, `scm_onboarding_draft` to the cleared keys; on sign-out also call `exitDemoMode()`.
- `hooks/useSupplierHealth.ts`, `hooks/useLeadTimeHistory.ts`, `hooks/useDisruptionHistory.ts`, `hooks/usePerformanceAlerts.ts`: in demo mode keep state in memory only and skip every write (Supabase and localStorage). Reads in demo mode return empty initial state.

### 4.7 Sample-company (demo) mode

- `lib/sampleProfile.ts` exports `SAMPLE_PROFILE: CompanyProfile` and `SAMPLE_EXTRAS: OnboardingExtras` for "Meridian Electronics Co.", built from the test profile Balraj has been using:
  - HQ United States; sector Electronics; revenue `$100M–$1B`.
  - Suppliers: TSMC Semiconductor (Taiwan, Semiconductors, 35%, 45 d), Foxconn Assembly (China, Contract assembly, 25%, 21 d), Samsung SDI (South Korea, Batteries, 20%, 30 d), Bosch Components (Germany, Sensors, 12%, 25 d), Flex Ltd (Mexico, PCB assembly, 8%, 20 d).
  - Products: Smart Home Hub ← Foxconn (25 d, reorder 20); EV Charging Module ← TSMC (18 d, reorder 25); Industrial IoT Sensor ← Bosch (40 d, reorder 20); Portable Power Bank ← Samsung SDI (30 d, reorder 15).
  - Entry ports: LA/Long Beach, Laredo. Transport: Ocean, Truck.
  - **Important:** `createdAt`/`updatedAt` and every `inventoryAsOf` date are generated at runtime as "today", so the sample never shows decayed "0 days" stock.
- `lib/demoMode.ts`: flag in `sessionStorage["foreglow_demo"] = "1"`. `enterDemoMode()` sets it; `exitDemoMode()` removes it. All accessors wrapped in try/catch.
- `useCompanyProfile` in demo mode returns `SAMPLE_PROFILE`, `saveProfile` returns `false` without writing, and `clearProfile` is a no-op.
- `components/DemoBanner.tsx` renders at the top of the dashboard in demo mode: `rounded-xl border border-line bg-surface px-5 py-3` with "You're exploring a sample company, Meridian Electronics. Nothing here is saved." plus "Set up my company" (`ui.btnPrimary`: exit demo, go to `/onboarding`) and "Exit sample" (`ui.btnGhost`: exit demo, reload `/`).
- AI panels run normally on the sample profile (their caches handle repeat calls).

---

## 5. Sign-in

### 5.1 Providers and flags

`lib/authProviders.ts`:

```ts
export const AUTH = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1",
  microsoft: process.env.NEXT_PUBLIC_AUTH_MICROSOFT === "1",
  emailCode: true,
} as const
export const SETUP_CALL_URL = process.env.NEXT_PUBLIC_SETUP_CALL_URL ?? ""
```

Hide any button whose flag is off, and hide every "Book a setup call" link when `SETUP_CALL_URL` is empty.

### 5.2 `AuthPanel` (shared by `/signup` and `/login`)

Props: `mode: "signup" | "login"`, `next?: string`.

1. Provider buttons (each 48px tall, full width, `bg-surface border border-line-strong rounded-lg font-semibold`, official multicolour Google "G" and Microsoft four-square marks as inline SVG; these brand marks are the one allowed exception to token colours):
   - "Continue with Google" → `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next ?? "")}` } })`.
   - "Continue with Microsoft" → same with `provider: "azure"` and `scopes: "email"`.
   - While redirecting, show the clicked button's label as "Opening Google…" and disable both.
2. Divider "or with your work email".
3. Email code flow:
   - Step A: "Work email" input (`type="email"`, `autoComplete="email"`) + `ui.btnPrimary` "Email me a 6-digit code" → `signInWithOtp({ email, options: { shouldCreateUser: mode === "signup" } })`. In login mode, if Supabase reports the user doesn't exist, show "We don't have an account for that email. Create one?" with a link to `/signup?email=…`.
   - Step B: "Enter the code we sent to {email}" + one input (`inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`, `tracking-[0.5em] text-2xl text-center`). Auto-submit at 6 digits → `verifyOtp({ email, token, type: "email" })`. "Resend code" enabled after 30 s with a visible countdown; "Use a different email" returns to Step A.
   - On success → post-auth routing (5.4) on the client.
4. Login mode only: "Sign in with a password instead" (`ui.btnGhost`) reveals the existing email/password form plus "Forgot password?" → `resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/reset-password` })`, then "Check your email for a reset link."
5. Errors use `ui.errorBox` with plain copy: rate limit → "Too many attempts. Wait a minute and try again."; wrong or expired code → "That code didn't work. Check it or send a new one."; anything else → the Supabase message.
6. Footer links (`text-[13px] text-ink-3`): signup mode "Already have an account? Sign in"; login mode "New to Foreglow? Create an account". Then, if `SETUP_CALL_URL`: "Prefer a walkthrough? Book a 15-minute setup call and we'll set it up with you." Then "Try it without an account" → `/onboarding`.
7. Prefill the email from `?email=` if present.

### 5.3 `/signup` and `/login` layout (screen 1)

Reference: `1-signup.html`. Two columns, full height.

- **Left (600px, `bg-paper`, `px-[72px] py-12`, flex column, space-between):** `<Logo />` top. Middle: headline (`font-serif text-[46px] leading-[1.08]`):
  - signup: "See what today's news means for *your* suppliers." with "your" in italic `text-ember`;
  - login: "Welcome back."
  - Sub-line (`text-[17px] text-ink-2`): signup "Free to try. Set-up takes about 4 minutes, and you'll see your first exposure before you finish."; login "Sign in to see what's touching your supply chain today."
  - Then `<AuthPanel>`. Bottom: `text-xs text-ink-3` "Your supplier data stays private to your account."
- **Right (`LiveEventsPanel`, remaining width, `bg-ink text-paper`, `px-16 py-12`):**
  - Eyebrow `text-on-ink-muted` "Right now · {weekday d Mon, h:mm a}" + static "Live" dot `bg-[#7FA88A]`.
  - Headline `font-serif text-[40px]`: "{events.length} disruptions are moving through global supply chains today."
  - Map card: `bg-paper rounded-xl p-[18px]` containing `<OnboardingMap events={events} mode="heat" />`.
  - Three headline tiles in a `grid-cols-3 gap-4`: pick the three highest-severity events with distinct categories (fallback: highest severity overall). Tile: `border border-[#3A4552] rounded-[10px] px-4 py-3.5`; category in `text-[11px] font-semibold tracking-[0.08em] text-dawn`; title `text-sm` clamped to 3 lines.
  - Footer `text-[15px] text-on-ink-muted`: "Which of these touch your suppliers? Add them and find out."
  - Empty events (fallback data failed): hide the tiles; headline "Foreglow watches news, weather and trade policy around the clock."
- Below 1024px, the right panel is hidden.

### 5.4 Post-auth routing

`app/auth/callback/route.ts` (per Supabase's Next.js PKCE pattern):
1. Read `code` and `next`. Accept `next` only if it starts with `/` and not `//`.
2. `createServerSupabaseClient()` → `exchangeCodeForSession(code)`. On error or missing code → redirect `/auth/error`.
3. If `next` is set → redirect there.
4. Else query `profiles` for the user's row (`select id`). Exists → `/`; otherwise → `/onboarding`.
5. Behind Vercel, build the redirect URL from `x-forwarded-host` when present, as in the Supabase example.

Client-side code verification follows the same rule (steps 3–4) using the browser client.

The existing guest-to-account migration in the hooks continues to run after sign-in, unchanged. If a guest finished onboarding before signing up, their localStorage profile migrates as today, and `useOnboardingExtras` migrates `scm_onboarding` into `profiles.onboarding` once on first sign-in (same guarded pattern as the other hooks).

### 5.5 `/auth/error` and `/reset-password`

- `/auth/error`: centered card (First Light auth card), `ui.h2` "That sign-in link didn't work", body "It may have expired or already been used. Corporate email scanners sometimes open links before you do.", `ui.btnPrimary` "Try again" → `/login`.
- `/reset-password`: centered card, new password + confirm (min 8 characters), `supabase.auth.updateUser({ password })`, success → `/`.

### 5.6 Navbar and modal entry points

- Navbar, signed out with no profile: "Set up your profile" → `/onboarding`. Signed in with no profile: same.
- `ProfilePromptModal`: primary action becomes "Set up in 4 minutes" → `/onboarding`; add secondary `ui.btnGhost` "Look around a sample company" → `enterDemoMode()` then reload `/`.

---

## 6. Onboarding screens

All steps share `OnboardingHeader` and a two-column body: **left form column** (`w-[720px]` on the Company step, `w-[760px]` on the others, `px-16 py-12`, flex column, primary action pinned at the bottom with `mt-auto`) and **right panel** (`flex-1 bg-paper-raised border-l border-line px-12 py-10`). Below 1024px the right panel stacks under the form.

### 6.0 `OnboardingHeader` and `HorizonProgress`

Reference: header of `3-company.html` to `6-products.html`.

- `h-[72px] bg-paper-raised border-b border-line`, three-column grid: `<Logo size={26} />` · progress centered · right group `text-[13px] text-ink-3` with time left and "Save and finish later" (`text-ember`).
- `HorizonProgress` (SVG 560×44): a horizon line from x=20 to x=540 at y=26. Stops at x = 20, 200, 380, 540 (import path: 20, 280, 540). Completed segment `#1B2330` 2px; remaining segment `#DDD5C6` 2px. Completed stops are 4px ink dots; upcoming stops are 3px `#C9C0AF` dots. **The current stop is the sun:** a half disc (r=8) in `#B04A22` sitting on the line, with a `#E0A077` 1.5px arc (r=14). Labels 11px under each stop; current label weight 600 in ink, done labels `#3E4955`, upcoming `#5A6470`. `role="img"` with `aria-label="Step N of M: {label}"`.
- Animate the sun moving between stops (`transition` on `transform`, 400ms ease-out), disabled under reduced motion (already global).
- Time left: Company "About 4 min left", Suppliers "About 3 min left", Ports "About 2 min left", Products "Last step"; import path: Company 3, Import 2, Ports "Last step".

### 6.1 Choose how to start (screen 2)

Reference: `2-choose-path.html`. No progress bar on this screen; the header shows only the logo and "Signed in as {email}" (or nothing for guests).

- Eyebrow "Welcome, {first name}" (from the OAuth `user_metadata.full_name` or `name`; else just "Welcome").
- `font-serif text-[44px]`: "Foreglow needs one thing to start watching: who you buy from."
- Sub: "Pick the fastest way in. You can add detail later."
- Three option cards in `grid-cols-3 gap-5`, each a `<button>` `text-left rounded-[14px] p-7 flex flex-col gap-3.5`:
  1. **Upload the spreadsheet you already have**: highlighted (`bg-surface border-2 border-ink`), chip `bg-ink text-paper` "FASTEST · ABOUT 2 MIN". Body: "A supplier list, a purchase-order export or an inventory report. Messy column names are fine. You check what we found before anything is saved." Meta: "Excel or CSV · stays in your browser until you confirm". → path `import`, go to Company.
  2. **Type in your key suppliers**: `bg-paper-raised border border-line`, chip neutral "ABOUT 4 MIN". Body: "Start with your top 3 to 5. Name, country and what they supply is enough to begin." Meta: "Best if you don't have a file handy". → path `manual`, go to Company.
  3. **Look around a sample company first**: same style, logo mark as the icon, chip "NO DATA NEEDED". Body: "See Foreglow running for a mid-sized electronics importer with suppliers in Taiwan, Korea, China, Germany and Mexico." Meta: "Switch to your own data any time". → `enterDemoMode()`, go to `/`.
- Icons: inline 1.5px stroke SVGs (document, pencil), 36px.
- If `SETUP_CALL_URL`: a bottom bar `rounded-xl border border-line bg-paper-raised px-6 py-5` "Rather have us do it?" / "Send your file and book 15 minutes. We set up your account with you on the call." + `ui.btnSecondary` "Book a setup call".

### 6.2 Company (screen 3)

Reference: `3-company.html`.

- `font-serif text-[38px]`: "First, the basics about your company." Sub: "This shapes which news counts as relevant to you."
- Fields:
  - Company name (prefill from the email domain, title-cased, if it isn't a public domain like gmail.com or outlook.com) and Headquarters country (country autocomplete, 6.3) in a 2-column grid, `h-[46px]` inputs.
  - "What do you sell?": single-select chip row (4.4 sector labels).
  - "Revenue range": single-select chip row (four chips).
  - "Your role · so your morning brief speaks your language": single-select chip row: Procurement / sourcing, Supply chain / operations, Planning / inventory, Owner / executive. Optional.
- Chips: `<button aria-pressed>` `rounded-full px-3.5 py-2 text-sm`; selected `bg-ink text-paper border-ink`, unselected `border-line-strong text-ink`.
- Footer: left `ui.meta` "Pain points and where you sell come later, from your dashboard." Right `ui.btnPrimary px-6 py-3.5` "Continue to suppliers →" (import path: "Continue to upload →").
- Validation: company name, HQ country, sector and revenue required; inline messages under each missing field on submit.
- **Right panel, "Your morning brief, taking shape"** (`MorningBriefPreview`):
  - `bg-surface border border-line rounded-[14px] p-6`: meta "{tomorrow's date} · for {first name}, {role label}" (omit what's unknown); headline `font-serif text-[30px]` "Good morning. Here's what touches **{company name}** today." with the company name in `text-ember`, updating as they type (placeholder "your company" when empty).
  - Three skeleton bars (`bg-paper-sunk`, static, no pulse) and a note `bg-paper rounded-lg p-3 text-sm text-ink-2` "This fills in as soon as you add your first supplier."
  - "Why we ask" (`text-[13px] font-semibold`) + a paragraph that changes with the sector:
    - Electronics: "Electronics importers care about chip capacity, memory supply and Asian port congestion."
    - Apparel / Retail: "Consumer goods importers care about Asian factory output, ocean freight and peak-season port congestion."
    - Automotive / Industrial: "Industrial and automotive importers care about component lead times, Mexico border crossings and steel and metals supply."
    - Pharmaceuticals: "Medical and pharma importers care about single-source ingredients, air freight and regulatory holds."
    - Food & Beverage: "Food and beverage importers care about weather, crop conditions and cold-chain transport."
    - Aerospace / Other / none: "Your answer decides which long-term risks we watch for you."

### 6.3 Country autocomplete (`lib/countries.ts`)

- `COUNTRIES: { name: string; region: SupplyRegion; aliases?: string[] }[]` covering at least every country in the region map inside `lib/fetchGlobalDisasters.ts` (read it for reference; do not modify or import from it), plus Taiwan, Hong Kong and Vietnam. Aliases: "USA", "US", "UK", "Korea" → "South Korea", "Holland" → "Netherlands", "PRC" → "China".
- `countryToSupplyRegion(name)` returns the region for a known country or alias. It never guesses: unknown names return `null` and the UI asks the user to pick from the list.
- Combobox: ARIA `role="combobox"`, listbox with up to 6 matches (prefix first, then substring, aliases included), arrow keys + Enter, `bg-surface border border-line rounded-lg` dropdown, highlighted option `bg-paper-sunk`. Under the field after selection, show the derived region in `text-xs text-ink-3`.

### 6.4 Suppliers (screen 4)

Reference: `4-suppliers.html`.

- `font-serif text-[38px]` "Who do you buy from?" Sub: "Start with the suppliers you'd worry about most. Three to five is plenty for now."
- Editable table in `bg-surface border border-line rounded-xl overflow-hidden`:
  - Header row `bg-paper-raised`, `text-xs font-semibold uppercase tracking-[0.06em] text-ink-3`: Supplier · Country · What they supply · Lead time (days) · (remove).
  - Committed rows show values as text (name `font-semibold`; country with derived region beneath in `text-xs text-ink-3`); clicking a row edits it in place.
  - The last row is always an empty editable row. Tab moves across cells; Enter on the last cell commits the row and focuses the next empty row.
  - "What they supply": free text with suggestions (Semiconductors, Batteries, Contract assembly, Sensors, PCB assembly, Plastics & resins, Steel & metals, Textiles, Packaging, Chemicals).
  - Lead time: optional number, placeholder "optional".
  - Remove: icon button with SVG ×, `aria-label="Remove {name}"`.
- Under the table: `+ Add another supplier` (`border border-dashed border-line-control`) and `ui.meta` "or paste rows from a spreadsheet". **Paste support:** pasting tab-separated rows into any cell of the empty row splits them into rows (columns in table order).
- Limits: 1 to 10 suppliers (existing profile limit). At 10, disable add with "Up to 10 suppliers for now."
- Footer: "← Back"; right `ui.meta` "Share %, sub-suppliers and more can wait." + `ui.btnPrimary` "Continue to ports →" (disabled until 1 valid supplier; helper "Add at least one supplier with a country.").
- **Right panel, "Now watching"** (updates on every committed row):
  - Header row: eyebrow "Now watching"; right: "{n} countries · {m} active events" (numbers in `font-serif text-[22px]`, the events number `text-ember` when > 0).
  - `<OnboardingMap mode="suppliers" supplierCountries={…} events={events} />`.
  - Teaser card (`bg-surface border border-line rounded-xl p-[18px]`) from `supplierTeaser()` (section 7): severity chip, meta "{category} · {source} · {date}", `font-serif text-[21px]` event title, body "{supplier} is in the affected region. Once you add products, we'll show which ones depend on it."
  - No match: card with `ui.chipPositive` "ALL QUIET" and "Nothing in today's news touches these suppliers. That's good news. We'll keep watching."
  - Footer `ui.meta` "Each supplier you add lights up here."

### 6.5 Ports (screen 5)

Reference: `5-ports.html`.

- `font-serif text-[38px]` "Where do your goods come in?" Sub: "Strikes, closures and congestion happen at specific ports. Tell us yours and we'll catch them."
- "US ports and crossings you use": multi-select tiles in `grid-cols-2 gap-2.5`, each a `<button aria-pressed>` `flex justify-between rounded-[10px] px-4 py-3.5`, name left, coast right in `text-xs`. Selected `bg-ink text-paper border-ink` (coast text `text-on-ink-muted`); unselected `bg-surface border-line-strong`.
- Tiles from `lib/ports.ts` in this order: Los Angeles / Long Beach (West Coast), Oakland (West Coast), Seattle / Tacoma (West Coast), New York / New Jersey (East Coast), Savannah (East Coast), Charleston (East Coast), Houston (Gulf), Laredo (Mexico border). Then a full-width dashed tile "+ Another port" that opens a text input; entered names are stored as `custom:<name>`.
- Pre-select nothing.
- "How it mostly travels": multi-select chips Ocean, Truck, Air, Rail.
- Footer: "← Back"; right "Not sure, skip" (text link; leaves ports empty) + `ui.btnPrimary` "Continue to products →" (import path: "See what's touching {company} →").
- **Right panel, "Port watch"**:
  - Eyebrow "Port watch". Headline `font-serif text-[28px]`, computed:
    - every selected port has ≥1 matching event: "{Both/All} of your entry points have something going on this week." (one port: "Your entry point has something going on this week.")
    - some: "{k} of your {n} entry points have something going on this week."
    - none: "Nothing reported at your ports today."
    - no ports selected: "Pick your ports to see what's happening there."
  - One card per selected port (max 4 shown): port name `font-semibold` + chip (the event's severity) or `ui.chipPositive` "CLEAR"; body = the most severe matching event's title; meta `{source} · {date}`.
  - Footer `ui.meta`: "Without ports, Foreglow matches events by region only. Adding them is the biggest single improvement to your alerts."
- `lib/ports.ts`:

```ts
export interface Port { id: string; name: string; coast: string; keywords: string[] }
export const PORTS: Port[] = [
  { id: "la-lb", name: "Los Angeles / Long Beach", coast: "West Coast", keywords: ["los angeles", "long beach", "san pedro"] },
  { id: "oakland", name: "Oakland", coast: "West Coast", keywords: ["oakland"] },
  { id: "seattle-tacoma", name: "Seattle / Tacoma", coast: "West Coast", keywords: ["seattle", "tacoma", "northwest seaport"] },
  { id: "ny-nj", name: "New York / New Jersey", coast: "East Coast", keywords: ["new york", "new jersey", "newark", "port elizabeth"] },
  { id: "savannah", name: "Savannah", coast: "East Coast", keywords: ["savannah"] },
  { id: "charleston", name: "Charleston", coast: "East Coast", keywords: ["charleston"] },
  { id: "houston", name: "Houston", coast: "Gulf", keywords: ["houston"] },
  { id: "laredo", name: "Laredo", coast: "Mexico border", keywords: ["laredo", "mexico border", "u.s.-mexico border", "us-mexico border"] },
]
// matchEventsToPorts(events, portIds): Record<portId, DisruptionEvent[]> — case-insensitive keyword
// match on event.title; custom ports match on their own lowercased name. Sort matches by severity
// desc, then date desc.
```

### 6.6 Products (screen 6)

Reference: `6-products.html`.

- `font-serif text-[38px]` "What do you sell, and who makes it?" Sub: "This is how Foreglow turns "a flood in China" into "your Smart Home Hub is exposed.""
- Editable table, same mechanics as suppliers: Product line · Made by (select from entered suppliers) · Days of stock (optional number) · As of (date input, default today; shown as "Today" when today).
  - A row with no stock shows a small `rounded-full border border-line-strong px-2.5 text-xs` "Add later" toggle in the "As of" cell; when on, Days of stock is cleared and disabled.
- `+ Add a product line`. Limits 0–5 (existing limit).
- Note box (`bg-paper-raised border border-line rounded-[10px] px-4 py-3.5 text-sm text-ink-2`): **"How days of stock works:"** "we count down from the date you enter, so the number stays honest. Don't know it right now? Skip it. Everything else still works." (Do not promise a monthly reminder email; that feature does not exist yet.)
- Footer: "← Back"; right "I'll add products later" text link (goes to finish with 0 products) + `ui.btnAccent` "See what's touching {company} →".
- **Right panel, "Your supply chain, drawn"**:
  - `<MiniNetwork>`: SVG, suppliers left (190×44 nodes, rx 8), products right (200×44), cubic edges. Supplier node stroke `#B04A22` 2px if `supplierHasActiveEvent` (section 7), else `#DDD5C6` 1.5px. Suppliers with no product yet: dashed stroke and label "{name} (no product yet)" in `#5A6470`. The product picked by the insight below is filled `#1B2330` with paper text, and its edge is `#1B2330` 2.5px; other edges `#C9C0AF` 1.5px. Max 6 suppliers and 5 products shown.
  - Insight card (`bg-surface border border-line rounded-xl p-[18px]`): eyebrow `text-xs font-semibold tracking-[0.08em] text-ember` "FOUND WHILE YOU TYPED"; headline `font-serif text-[21px]`; body `text-sm text-ink-2`. Content from `productInsight()` (section 7). No insight yet: eyebrow "WAITING FOR PRODUCTS", headline "Link a product to a supplier to see its exposure."

### 6.7 Import review (alternate path)

Reference: `alt-import-review.html`.

- Reuse `components/ImportProfileFlow.tsx` for upload and parsing. Add an **optional** prop `onResult?: (result: ImportResult) => void`. When provided, the component must not save the profile itself; it calls `onResult` after the user confirms the review. Without the prop, behaviour is exactly as today (the `/profile` page keeps using it unchanged).
- `StepImport` wraps it in the onboarding layout:
  - Header line with a moss check icon: "{file name} · {n} sheets read in {s} seconds".
  - `font-serif text-[38px]`: "We found {s} suppliers and {p} products. Check them before we save."
  - Review table: Supplier · Country · Supplies · Lead time · Confidence (`HIGH` positive chip, `MEDIUM` warning chip "NEEDS A LOOK", `LOW` critical chip). Rows that need input get `bg-[#FDF8EC]` and an inline field (for example a missing country uses the country combobox).
  - "Products found: {names}. Review products" (expands an editable products list).
  - Right column: "What we read" card listing each sheet with what it contributed, or "not used" in `text-ink-3`, plus the existing honest unmapped-data explanation; and "Your file" card: "Read in your browser. Only the rows above are saved, and only after you continue."
  - Footer: "← Use a different file"; right: warning count in `text-ochre` ("1 row needs a country") + `ui.btnPrimary` "Looks right, continue →" (disabled while required cells are empty).
- The confirmed result feeds `onboardingToProfile` like the manual path. Products from import have no as-of date: set `inventoryAsOf` to today for products with stock values, and mark the rest `inventoryUnknown`.

### 6.8 First light (finish, screen 7)

Reference: `7-first-light.html`.

When the user continues from the last step: save the profile (`saveProfile`), then the extras (`completedAt`, `checklistInitial` = open checklist item ids), then delete the draft. Show a full-screen state "Saving your setup…" with the skeleton style while saving; on failure show `ui.errorBox` "We couldn't save your setup. Your answers are kept on this device." + "Try again".

Layout:
- **Top band** (`h-[360px] bg-ink text-paper px-[120px] py-14 relative overflow-hidden`):
  - Eyebrow `text-dawn` "Setup complete · {m} min {s} s" (from `startedAt`; omit if over 30 minutes).
  - `font-serif text-[64px] leading-[1.02]`: "First light, *{short company name}.*" with the name in italic `text-dawn`. Short name = company name without suffixes like "Co.", "Inc.", "LLC", "Ltd", "Electronics" is kept.
  - Sub `text-[19px] text-on-ink-muted`: "Foreglow is now watching {s} suppliers in {c} countries, {p} entry points and {n} product lines. Here's what it sees today." Omit clauses that are zero.
  - Horizon SVG pinned to the bottom (as in the reference). **On mount, animate the sun rising**: translate the half disc from 40px below the line to its final position over 1.2s ease-out (reduced motion: no animation).
- **Body** (`px-[120px] py-10`):
  - Three cards in `grid-cols-3 gap-5` from `firstLightCards()` (section 7). Card: `bg-surface border border-line rounded-xl p-[22px]`, chip, `font-serif text-[23px]` title, `text-sm text-ink-2` body.
  - Bottom row:
    - Morning email card (**only if `ENABLE_EMAIL_BRIEF`**, default false; see 8.4): "Get this in your inbox every morning" / "A short brief at 7:00 AM {local time zone}. Only what touches your network." + switch (`role="switch"`, default on, saved to `extras.morningEmail`).
    - `ui.btnAccent h-[52px]` "Open my dashboard" → `/`. Under it `ui.meta` "Setup is {pct}% complete. Your dashboard shows what to add next."

### 6.9 Visual and motion rules for all onboarding screens

- Typography, colours and recipes exactly as First Light. The reference HTML shows exact sizes and spacing; translate them to Tailwind token classes.
- Right panels update **only on committed values** (row commit, chip toggle), never on every keystroke, except the brief-preview company name, which updates live.
- When a right-panel number changes, crossfade the number (150ms opacity). No counting animations, confetti or bouncing.
- Focus: the first input of each step is focused on entry. Step changes scroll to top.
- Keyboard: Enter on a step submits its primary action when the form is valid.
- Every step's primary action is reachable without scrolling at 1440×900 and 1280×800.

---

## 7. Live-data rules (`lib/onboardingInsights.ts`)

All functions are pure, take `events: DisruptionEvent[]` (from the server page) plus draft data, and never invent text. Event text fields are used verbatim.

- `countrySeen(event, country)`: case-insensitive title includes the country name or any alias from `lib/countries.ts`.
- `supplierHasActiveEvent(supplier, events)`: an event with severity ≥ 2 where `countrySeen(event, supplier.country)` is true, **or** `event.region === supplier.region` and the category is Weather, Port or Labor.
- `supplierTeaser(suppliers, events)`: best event by (1) country-name match beats region-only, (2) higher severity, (3) newer date. Returns `{ event, supplier }` or `null`.
- `productInsight(draft, events)`: first rule that applies:
  1. A product whose stock days ≤ its supplier's lead time **and** whose supplier has an active event → headline "{product} is your tightest spot.", body "{days} days of stock against a {lead}-day lead time from {supplier}, while {supplier region} has active disruptions."
  2. A product with a single supplier (every onboarding product has one; use `findSinglePointsOfFailure(onboardingToProfile(draft))` from `lib/supplyChainGraph.ts`) whose supplier has an active event → "{product} has one source: {supplier}, in {country}." body: "With {days} days of stock against a {lead}-day lead time, a disruption there would leave a gap. You can name a backup later." (omit the stock clause if unknown).
  3. Any single-source product → same headline; body "A backup supplier lets Foreglow tell you when you can switch. You can add one later."
  4. Otherwise `null`.
- `firstLightCards(profile, extras, events)`: run `scoreEventsForProfile(events, profile)` (import only) and `calculateInventoryRisk` (with the as-of rules in 8.2).
  - Card 1, "DECIDE THIS WEEK" (critical chip): the `productInsight` rule-1 or rule-2 result if any; else the highest-scoring event with severity 3 and `isProfileMatch`; else skip.
  - Cards 2–3, "WATCH" (warning chip; critical chip if severity 3): the next highest-scoring `isProfileMatch` events not already used. Title = event title (clamp 2 lines); body = `relevanceReason`. Prefer events matched to an entry port (port name as the title prefix "Los Angeles / Long Beach:" and the event title as body).
  - If fewer than three cards: fill with one `ui.chipPositive` "ALL QUIET" card, "Nothing urgent for your network today", body "Foreglow will flag the moment something changes." Never show more than one quiet card; if there are zero real cards show only the quiet card, centered at `max-w-xl`.

---

## 8. Dashboard and profile changes

### 8.1 Setup checklist (`components/SetupChecklist.tsx`, screen 8)

Reference: `8-setup-checklist.html`. Rendered at the top of the Overview tab, above the existing banners, when the user has a profile, is not in demo mode, `extras.checklistDismissedAt` is unset, and at least one item is open.

`lib/setupChecklist.ts` → `computeChecklist(profile, extras, flags): ChecklistItem[]`, ordered by value (first match per rule):

| id | Condition (open when…) | Title | Why | Time | Action |
| --- | --- | --- | --- | --- | --- |
| `finish-onboarding` | `extras.completedAt` unset | Finish setting up | You left setup part-way. Pick up where you stopped. | 2 min | `/onboarding` |
| `backup:{productId}` | product is a single point of failure (first one only) | Name a backup for {product} | It has one source. A backup lets us tell you when you can switch. | 1 min | `/profile?step=3` |
| `stock:{productId}` | product in `inventoryUnknown` (first one) | Add stock levels for {product} | Unlocks reorder warnings for this product. | 30 sec | `/profile?step=3` |
| `leadtimes` | `leadTimeUnknown` non-empty | Add lead times for {n} suppliers | Lets us compare stock against how long a reorder takes. | 1 min | `/profile?step=2` |
| `tier2` | top-share supplier has no `tier2Suppliers` | Who supplies {supplier}? | Most shocks start one tier down. Add a sub-supplier to see them. | 2 min | `/profile?step=2` |
| `reorder` | `reorderPointDefaulted` non-empty | Check your reorder points | We set them to each supplier's lead time. Adjust if you hold safety stock. | 1 min | `/profile?step=3` |
| `markets` | `primaryMarketsDerived` | Confirm where you sell | We assumed {region} from your headquarters. | 30 sec | `/profile?step=1` |
| `painpoints` | `painPoints` empty | Tell us what worries you most | Sharpens which news we rank first. | 30 sec | `/profile?step=4` |
| `email` | `ENABLE_EMAIL_BRIEF` and `morningEmail` unset | Turn on your morning brief | One short email before your day starts. | 10 sec | toggle inline |
| `invite` | `ENABLE_TEAMS` | Invite a teammate | Share alerts with whoever places the orders. | 30 sec | (future) |

(Check `/profile`'s actual step numbers when wiring these links; adjust to match.)

Layout: `bg-paper-raised border border-line rounded-[14px] p-7 grid grid-cols-[320px_1fr] gap-10`.
- Left: eyebrow "Sharpen your alerts"; `font-serif text-[32px]` "{done} of {total} done. Each step makes Foreglow more specific to you."; a 300px `HorizonProgress` variant with no labels and the sun at the done fraction; `ui.btnGhost` "Hide for now" (sets `checklistDismissedAt`).
- Right: one row per open item (max 4 shown, "Show {k} more" link after), then one collapsed done row listing done titles struck through with a moss check. Row: `grid grid-cols-[28px_1fr_120px_150px] items-center gap-3.5 py-4 border-b border-line-soft`: empty 22px circle (`border-[1.5px] border-line-control`), title `font-semibold` + why `text-[13px] text-ink-2`, time `ui.meta`, action button (first row `ui.btnPrimary`, others `ui.btnSecondary`).
- `total` = `checklistInitial.length` (or the current open count when `checklistInitial` is missing); `done` = items in `checklistInitial` no longer open.
- When everything is done, show once: "Setup complete. Foreglow is tuned to your network." with a moss check, then hide permanently (set `checklistDismissedAt`).

### 8.2 Inventory as-of dates (`lib/inventoryRisk.ts`)

Not protected. Add an optional last parameter to the inventory risk calculation (and every caller): `opts?: { inventoryAsOf?: Record<string, string>; inventoryUnknown?: string[] }`.
- Days elapsed for a product = days since `inventoryAsOf[product.id]` when present, else since `profile.updatedAt` (today's behaviour).
- Products in `inventoryUnknown` are excluded from risk levels, reorder recommendations and the reorder banner; `InventoryRiskPanel` shows them as a muted card: name, "Stock level not set", `ui.btnSecondary` "Add stock" → `/profile?step=3`.
- A product whose supplier's `leadTimeDays` is 0 shows "Lead time not set" instead of a lead-time comparison.
- `DashboardClient` passes `extras` from `useOnboardingExtras()`. Without extras (existing users), behaviour is identical to today.
- When `/profile` saves inventory changes, update `inventoryAsOf` for changed products to today and remove them from `inventoryUnknown`.

### 8.3 `/profile` additions

- Read `?step=N` (1–5) to choose the initial step.
- Add a "Ports and role" block to the step that holds transport modes and trade lanes: the same port tiles and role chips as onboarding, saved to extras. When entry ports change, re-run `deriveTradeLanes` and **merge** the result into the selected trade lanes (never remove lanes the user picked manually).
- Keep everything else as is.

### 8.4 Feature flags (`lib/featureFlags.ts`)

Add, both `false`:

```ts
export const ENABLE_EMAIL_BRIEF = false // morning-email opt-in UI; flip when email sending exists
export const ENABLE_TEAMS = false       // invite-a-teammate UI; flip when team accounts exist
```

---

## 9. Phase 9 (optional, only with the authorization line): port-name scoring

If and only if the kickoff prompt contains the Phase 9 authorization line, edit `lib/scoreEvents.ts`:
- Accept an optional third parameter `entryPorts?: string[]` in `scoreEventsForProfile` (keep the existing signature working).
- For each event, if `matchEventsToPorts` (imported from `lib/ports.ts`) matches one of the user's ports: `score += 15` and push the reason "Affects your {port name} entry point" **ahead of** other reasons. Apply this before the cap at 100.
- Change nothing else in the scorer: no severity rule changes, no other weights.
- Callers pass `extras.entryPorts` where available (`DashboardClient`, onboarding insights). AI API routes are not changed (they score server-side without extras; that stays a known limitation).
- Record the change in CLAUDE.md with the exact weight.

Without authorization, skip this phase; the trade-lane derivation in 4.4.1 already gives partial port awareness.

---

## 10. Copy reference

Use these strings exactly (sentence case, no exclamation marks, no emoji):

| Where | Copy |
| --- | --- |
| Signup headline | See what today's news means for *your* suppliers. |
| Signup sub | Free to try. Set-up takes about 4 minutes, and you'll see your first exposure before you finish. |
| Login headline | Welcome back. |
| Code step | Enter the code we sent to {email} |
| Path headline | Foreglow needs one thing to start watching: who you buy from. |
| Company headline | First, the basics about your company. |
| Suppliers headline | Who do you buy from? |
| Ports headline | Where do your goods come in? |
| Products headline | What do you sell, and who makes it? |
| Finish headline | First light, {company}. |
| Demo banner | You're exploring a sample company, Meridian Electronics. Nothing here is saved. |
| Already set up | You've already set up {company}. Edit your profile instead? |

---

## 11. Phases (one commit each)

| # | Scope | Commit |
| --- | --- | --- |
| 1 | Auth foundation: `lib/authProviders.ts`, `app/auth/callback/route.ts`, `/auth/error`, `/reset-password`, sign-out key list, migration SQL file | `feat: auth callback, error and password reset routes` |
| 2 | `AuthPanel` + `LiveEventsPanel` + new `/signup` and `/login` (server wrappers fetching events), `OnboardingMap` (heat mode) | `feat: Google, Microsoft and email-code sign-in screens` |
| 3 | Data layer: `lib/onboarding.ts`, `lib/countries.ts`, `lib/ports.ts`, `lib/onboardingInsights.ts`, `hooks/useOnboardingExtras.ts`, `lib/featureFlags.ts` flags | `feat: onboarding data model, countries, ports and insights` |
| 4 | Onboarding shell: `/onboarding` server page, `OnboardingFlow`, header + `HorizonProgress`, draft autosave/resume, Choose path, Company step with brief preview, post-auth routing to `/onboarding` | `feat: onboarding shell, choose-path and company steps` |
| — | **Stop for Balraj's review** (sign-up, path and company screens in the browser) | |
| 5 | Suppliers step (table, combobox, paste) + Now watching panel; Ports step + Port watch | `feat: onboarding suppliers and ports steps with live panels` |
| 6 | Products step + `MiniNetwork` + insights; First light screen + save | `feat: onboarding products step and first-light finish` |
| 7 | Import path: `ImportProfileFlow` `onResult` prop + `StepImport` | `feat: spreadsheet import path inside onboarding` |
| 8 | Demo mode: `lib/sampleProfile.ts`, `lib/demoMode.ts`, hook changes, `DemoBanner`, modal/Navbar entry points | `feat: sample-company mode` |
| 9 | Optional port scoring (only if authorized) | `feat: port-name matching in relevance scoring` |
| 10 | Dashboard checklist, inventory as-of handling, `/profile` additions; CLAUDE.md v5.1 + README | `feat: setup checklist and inventory as-of dates` then `docs: update CLAUDE.md to v5.1` |

CLAUDE.md updates in Phase 10:
- Status → v5.1.
- Folder structure: every new file in 4.2 with a one-line description.
- New section "Onboarding and auth": routes, `OnboardingExtras` and where it is stored, the `profiles.onboarding` column, demo mode rules, env flags, and the manual setup list (3.2–3.7) with done/not-done status.
- localStorage keys: add `scm_onboarding`, `scm_onboarding_draft`, and the `foreglow_demo` sessionStorage key.
- Version history v5.1 entry, including what was verified and what wasn't.
- Known issues: the Advisor/AI routes still read raw `inventoryDaysOnHand` (no as-of decay), so their numbers can differ from the Inventory panel.

---

## 12. Verification

After **every** phase: `npm run lint`, `npm run build`, `npm run verify`. All pass; no new lint warnings.

Phase 10 sweep: re-run the First Light greps from the v5.0 spec (old palette classes, emoji, accent borders, pulses) over all new files; expect no output.

Browser checks (use the browser tooling you have; if it fails, say so and list these for Balraj):

1. **Guest, manual path**: `/signup` → "Try it without an account" → choose Type in → complete every step with 3 suppliers (Taiwan, China, Germany), 2 ports, 2 products (one with stock, one "Add later") → First light shows real counts and real event cards → dashboard shows the checklist with the backup, stock and lead-time items. Back up and restore any existing `scm_*` keys around this test.
2. **Draft resume**: start onboarding, add 2 suppliers, close the tab, reopen `/onboarding` → lands on Suppliers with both rows.
3. **Save and finish later** with 1 supplier → dashboard → checklist shows "Finish setting up" → resumes.
4. **Empty states**: suppliers with no matching events show "ALL QUIET"; ports with no matches show "CLEAR"; finish with nothing relevant shows the quiet card.
5. **Import path** with a CSV of 3 suppliers and 2 products, one supplier missing a country → the row is flagged, continue disabled until fixed → ports → finish.
6. **Sample mode** from the path screen and from the modal → dashboard shows Meridian with fresh (non-zero) stock → interact (log supplier performance, dismiss an alert) → exit → no `scm_*` data or Supabase rows were written (check localStorage and, if signed in, the tables).
7. **Email code** sign-up end to end on a preview deploy (needs 3.3–3.4 done; otherwise list it for Balraj).
8. **Google / Microsoft**: if the flags are on in the preview environment, complete one sign-in each; new account → `/onboarding`; existing account with profile → `/`.
9. **Existing user regression**: a profile saved before v5.1 (no extras) loads, Inventory panel numbers are unchanged from v5.0, `/profile` works, no checklist items reference missing data incorrectly.
10. **Inventory as-of**: set a product's stock to 30 as of 10 days ago in `/profile` → card shows 20 days left.
11. Keyboard-only pass through every onboarding step (combobox, tables, chips, switch); visible focus everywhere.
12. 1280×800: every primary action visible without scrolling.
13. Console: no errors or hydration warnings on `/signup`, `/login`, `/onboarding`, `/`.

Report after each phase: what changed, check results, deviations and why.

---

## 13. Follow-ups (record in the CLAUDE.md backlog; do not build)

1. Morning email sending (then flip `ENABLE_EMAIL_BRIEF`).
2. Team accounts and invites (then flip `ENABLE_TEAMS`).
3. Supabase custom auth domain so Google's consent screen shows the Foreglow domain.
4. AI routes reading `inventoryAsOf` (protected; separate decision).
5. Port-name scoring if Phase 9 was skipped.
6. Onboarding analytics (step completion and drop-off) once a privacy-friendly analytics tool is chosen.
7. Monthly "update your stock levels" reminder email.

---

## 14. Reference files (`onboarding-reference/`)

| File | Screen |
| --- | --- |
| `1-signup.html` | Sign up with the live events panel |
| `2-choose-path.html` | Choose how to start |
| `3-company.html` | Company step + morning brief preview |
| `4-suppliers.html` | Suppliers table + Now watching panel (shows the open country combobox) |
| `5-ports.html` | Ports + Port watch panel |
| `6-products.html` | Products table + network + "found while you typed" |
| `7-first-light.html` | Finish screen |
| `8-setup-checklist.html` | Dashboard setup checklist |
| `alt-import-review.html` | Spreadsheet import review |
| `map-live-events.svg`, `map-suppliers.svg` | Static map pictures used by the mockups |

The mockups use sample data from the Meridian Electronics test profile. Known differences where this spec wins:
- The mockups' map event dots are illustrative; events have no coordinates, so the real `OnboardingMap` shades by region and highlights supplier countries without dots.
- Screen 3 in the mockup omits the revenue chips; this spec adds them (the profile requires a revenue range).
- Screen 4 omits the optional lead-time column; this spec adds it.
- Screen 5 lists 7 ports; this spec adds Charleston (8 tiles plus "Another port").
- Screen 6's note mentions a monthly reminder email; this spec removes that promise.
- Screen 7's morning-email card is hidden until `ENABLE_EMAIL_BRIEF` is on.
- Screen 8's "Invite a teammate" row is hidden until `ENABLE_TEAMS` is on.
