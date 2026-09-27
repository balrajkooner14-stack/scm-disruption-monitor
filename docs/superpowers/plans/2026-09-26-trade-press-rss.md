# Trade-Press RSS Source (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Port/Tariff/Labor/Geopolitical coverage independent of GDELT by adding curated supply-chain trade-press RSS as a fourth source, and fix the substring-matching bugs that mislabel categories and severities.

**Architecture:** Two new library files following the v4.0 adapter pattern — `lib/tradeFeeds.ts` holds data and pure matchers with no I/O, `lib/fetchTradeNews.ts` fetches six feeds in parallel and returns `DisruptionEvent[]`. It drops into the existing `Promise.all` in `lib/fetchDisruptions.ts` alongside GDACS and NOAA. The same file gains word-boundary matching for `assignCategory` and `scoreSeverity`, and cross-source URL dedup.

**Tech Stack:** TypeScript (strict), Next.js 14 App Router, `fast-xml-parser` (new). No test framework exists in this repo — verification uses committed Node harness scripts compiled via `tsc`, matching the approach proven in v4.8.

**Spec:** `docs/superpowers/specs/2026-09-26-trade-press-rss-design.md`

## Global Constraints

- TypeScript strict — no implicit `any`.
- `Array.from(new Set(...))` instead of `[...new Set()]` (TypeScript target compatibility).
- Do NOT modify `lib/profile.ts`, `lib/scoreEvents.ts`, `lib/gemini.ts`, or any file under `app/api/`.
- `lib/fetchDisruptions.ts` IS editable. The `scoreSeverity` word-boundary change inside it was explicitly authorised on 2026-09-26; the keyword lists and 3/2/1 tiers must remain byte-identical.
- The app must still work from `data/fallback.json` if every source fails.
- RSS total cap: **30** admitted items, allocated round-robin across feeds.
- NOAA stays capped at 15. GDACS stays uncapped. Weather is never suppressed.
- Per-feed fetch timeout: **10 s**. Feeds fetched in **parallel** (`Promise.allSettled`).
- Cache write rule: overwrite a feed's cache **only** on a genuine non-empty success.
- `Region` is a single value from `lib/types.ts`; no multi-region concept. No match → `"Unknown"`.
- `assignCategory` is called with the **title only** for RSS items — never the URL.
- Run `npm run build` before declaring any task done.
- Commit format: `git commit -m "feat: [description]"`.
- Never commit `.env.local`.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/tradeFeeds.ts` | **New.** Feed registry, disruption/context term lists, headline→region hints, pure matchers. No I/O. |
| `lib/fetchTradeNews.ts` | **New.** Fetch + parse + filter + map + cap + per-feed cache. One export. |
| `lib/fetchDisruptions.ts` | **Modify.** `containsWord` helper; word-boundary `scoreSeverity` + `assignCategory`; add `fetchTradeNews()` to `Promise.all`; cross-source dedup. |
| `scripts/verify.sh` | **New.** Compiles `lib/` to `.verify/` then runs every `scripts/verify-*.js`. |
| `scripts/verify-categorization.js` | **New.** Regression cases for word-boundary matching. |
| `scripts/verify-trade-feeds.js` | **New.** Unit cases for the pure matchers. |
| `scripts/verify-trade-news.js` | **New.** Adapter behaviour with stubbed fetch. |
| `package.json` | **Modify.** Add `fast-xml-parser`; add `verify` script. |
| `.gitignore` | **Modify.** Ignore `.verify/`. |
| `CLAUDE.md` | **Modify.** v4.9 entry, folder structure, severity-rules note. |

**Note on committed harnesses:** the spec says "same harness style as v4.8", where harnesses were throwaway files in `/tmp`. This plan commits them under `scripts/` instead so they are re-runnable by future sessions. That is a deliberate improvement on the spec, not a deviation from its intent.

---

### Task 1: Verification harness + word-boundary matching

Fixes the demonstrated substring bugs and builds the harness infrastructure every later task depends on.

**Files:**
- Create: `scripts/verify.sh`
- Create: `scripts/verify-categorization.js`
- Modify: `lib/fetchDisruptions.ts` (add `containsWord`; rewrite `scoreSeverity` and `assignCategory` bodies)
- Modify: `package.json` (add `verify` script)
- Modify: `.gitignore` (add `.verify/`)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `containsWord(haystack: string, needle: string): boolean` — module-private in `lib/fetchDisruptions.ts`, not exported. `scripts/verify.sh` — runnable via `npm run verify`, compiles `lib/fetchDisruptions.ts` and its transitive imports into `.verify/`, then executes every `scripts/verify-*.js` in sorted order, exiting non-zero if any fail.

- [ ] **Step 1: Create the harness runner**

Create `scripts/verify.sh`:

```bash
#!/usr/bin/env bash
# Compiles lib/ to .verify/ then runs every scripts/verify-*.js.
# This repo has no test framework; these harnesses are the test suite.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf .verify
npx tsc lib/fetchDisruptions.ts \
  --outDir .verify \
  --module commonjs \
  --target es2020 \
  --moduleResolution node \
  --esModuleInterop \
  --skipLibCheck \
  --resolveJsonModule

failed=0
for f in scripts/verify-*.js; do
  echo ""
  echo "=== $f ==="
  if ! node "$f"; then failed=1; fi
done

echo ""
if [ "$failed" -ne 0 ]; then echo "VERIFY FAILED"; exit 1; fi
echo "VERIFY PASSED"
```

Then `chmod +x scripts/verify.sh`.

- [ ] **Step 2: Wire up npm script and gitignore**

In `package.json`, add to `"scripts"`:

```json
"verify": "bash scripts/verify.sh"
```

Append to `.gitignore`:

```
# compiled output for scripts/verify.sh
.verify/
```

- [ ] **Step 3: Write the failing test**

Create `scripts/verify-categorization.js`:

```js
// Regression cases for word-boundary matching in assignCategory and
// scoreSeverity. Every FAIL row here was verified as actually broken on
// 2026-09-26 before the fix.
const { assignCategory, scoreSeverity } = require("../.verify/fetchDisruptions.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log("-- assignCategory: 'port' must not match inside other words --");
check('"new tariff announced on imported goods"',
  assignCategory("new tariff announced on imported goods", ""), "Tariff");
check('"export controls tighten on semiconductors"',
  assignCategory("export controls tighten on semiconductors", ""), "Geopolitical");
check('"reporter details new sanctions package"',
  assignCategory("reporter details new sanctions package", ""), "Geopolitical");
check('"transport costs rise after tariff hike"',
  assignCategory("transport costs rise after tariff hike", ""), "Tariff");

console.log("-- assignCategory: genuine matches still work --");
check('"port strike halts container terminal operations"',
  assignCategory("port strike halts container terminal operations", ""), "Port");
check('"dockworkers union announces walkout"',
  assignCategory("dockworkers union announces walkout", ""), "Port");

console.log("-- scoreSeverity: 'ban'/'halt' must not match inside other words --");
check('"Albania signs new trade agreement"',
  scoreSeverity("Albania signs new trade agreement"), 1);
check('"City approves asphalt resurfacing near freight corridor"',
  scoreSeverity("City approves asphalt resurfacing near freight corridor"), 1);
check('"Urban logistics hubs expand across Europe"',
  scoreSeverity("Urban logistics hubs expand across Europe"), 1);
check('"Lebanon reopens border crossing for humanitarian aid"',
  scoreSeverity("Lebanon reopens border crossing for humanitarian aid"), 1);
check('"Port of Rotterdam reports abandoned container backlog"',
  scoreSeverity("Port of Rotterdam reports abandoned container backlog"), 1);

console.log("-- scoreSeverity: genuine matches still work --");
check('"Port strike halts container terminal operations"',
  scoreSeverity("Port strike halts container terminal operations"), 3);
check('"Iceland whaling company shrugs off permanent ban"',
  scoreSeverity("Iceland whaling company shrugs off permanent ban"), 3);
check('"Shipping delays expected through October"',
  scoreSeverity("Shipping delays expected through October"), 2);

process.exit(failed ? 1 : 0);
```

Note on the two rows that still expect a hit: "…permanent ban" legitimately contains the word *ban*, so severity 3 is correct behaviour — that headline is excluded later by the two-gate admission filter (Task 2), not by the scorer.

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm run verify`

Expected: FAIL rows for the `imported` / `export` / `reporter` / `transport` cases (all currently return `"Port"`) and for `Albania` / `asphalt` / `Urban` / `Lebanon` / `abandoned` (all currently return `3`). Exit code 1.

- [ ] **Step 5: Implement word-boundary matching**

In `lib/fetchDisruptions.ts`, add this helper directly above `scoreSeverity`:

```ts
// Matches whole words only. The previous substring checks meant "port" matched
// inside "imported"/"export"/"transport"/"reporter", and "ban"/"halt" matched
// inside "Albania"/"urban"/"abandoned"/"Lebanon"/"asphalt" — so tariff and
// geopolitical stories were labelled Port, and unrelated headlines scored
// CRITICAL. Verified broken against all of those strings on 2026-09-26.
// Keywords may be multi-word ("trade war"), so metacharacters are escaped.
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack)
}
```

Replace the body of `scoreSeverity` — the keyword arrays and the 3/2/1 tiers stay byte-identical, only the matching changes:

```ts
export function scoreSeverity(title: string): SeverityLevel {
  const critical = ["strike", "closure", "sanctions", "blocked", "halt", "shutdown", "ban"]
  const warning = ["delay", "shortage", "disruption", "tariff", "congestion", "reduced"]
  if (critical.some((kw) => containsWord(title, kw))) return 3
  if (warning.some((kw) => containsWord(title, kw))) return 2
  return 1
}
```

In `assignCategory`, replace every `text.includes("keyword")` with `containsWord(text, "keyword")`. The keyword sets, their order, and the returned categories all stay exactly as they are. The first line becomes:

```ts
const text = title + " " + url
```

(`.toLowerCase()` is dropped because `containsWord` is already case-insensitive.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run verify`
Expected: all PASS, exit code 0.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: succeeds. Only the three pre-existing `react-hooks/exhaustive-deps` warnings in `AnalyticsTab.tsx`, `DisruptionFeed.tsx`, `InventoryRiskPanel.tsx`. No new warnings.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify.sh scripts/verify-categorization.js lib/fetchDisruptions.ts package.json .gitignore
git commit -m "fix: word-boundary matching in assignCategory and scoreSeverity

Substring matching meant 'port' matched inside imported/export/transport/
reporter, and 'ban'/'halt' matched inside Albania/urban/abandoned/Lebanon/
asphalt. Tariff and geopolitical stories were labelled Port, and unrelated
headlines scored CRITICAL.

Keyword lists and the 3/2/1 severity tiers are unchanged; only the matching
becomes word-accurate. The scoreSeverity change was explicitly authorised
despite CLAUDE.md freezing those rules.

Adds scripts/verify.sh as the repo's first test harness, since no test
framework is installed."
```

---

### Task 2: `lib/tradeFeeds.ts` — feed registry and pure matchers

**Files:**
- Create: `lib/tradeFeeds.ts`
- Create: `scripts/verify-trade-feeds.js`

**Interfaces:**
- Consumes: `Region` from `lib/types.ts`.
- Produces:
  - `interface TradeFeed { url: string; publisher: string; format: "rss" | "atom"; lastVerified: string }`
  - `const TRADE_FEEDS: TradeFeed[]`
  - `function matchesDisruptionKeywords(title: string): boolean`
  - `function inferRegionFromHeadline(title: string): Region`

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-trade-feeds.js`:

```js
// Pure-function cases for the two-gate admission filter and region inference.
// Headlines marked [real] were pulled from the live feeds on 2026-09-26.
const {
  TRADE_FEEDS,
  matchesDisruptionKeywords,
  inferRegionFromHeadline,
} = require("../.verify/tradeFeeds.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log("-- feed registry --");
check("six feeds registered", TRADE_FEEDS.length, 6);
check("every feed has a lastVerified date",
  TRADE_FEEDS.every(f => /^\d{4}-\d{2}-\d{2}$/.test(f.lastVerified)), true);
check("exactly one atom feed (Maritime Executive)",
  TRADE_FEEDS.filter(f => f.format === "atom").length, 1);

console.log("-- gate 1 AND gate 2 both required --");
check('[real] "Closure of Los Angeles harbor bridge looms amid elevated container dwells"',
  matchesDisruptionKeywords("Closure of Los Angeles harbor bridge looms amid elevated container dwells"), true);
check('[real] "US, China to extend trade war truce by 2 months"',
  matchesDisruptionKeywords("US, China to extend trade war truce by 2 months"), true);
check('[real] whaling ban has no supply-chain term',
  matchesDisruptionKeywords("Iceland's Last Whaling Company Shrugs Off Threat Of Permanent Ban"), false);
check('[real] "6 food manufacturers talk supply chain tactics" has no disruption term',
  matchesDisruptionKeywords("6 food manufacturers talk supply chain tactics"), false);
check('[real] "Lego to spend $400M to add warehouse space at Mexico plant"',
  matchesDisruptionKeywords("Lego to spend $400M to add warehouse space at Mexico plant"), false);

console.log("-- gate matching is word-boundary, not substring --");
check('"Albania expands port terminal" (ban must not fire gate 1)',
  matchesDisruptionKeywords("Albania expands port terminal"), false);

console.log("-- region inference --");
check('"Port of Rotterdam congestion worsens"',
  inferRegionFromHeadline("Port of Rotterdam congestion worsens"), "Europe");
check('"Shanghai port closure disrupts exports"',
  inferRegionFromHeadline("Shanghai port closure disrupts exports"), "Asia Pacific");
check('"Long Beach terminal backlog grows"',
  inferRegionFromHeadline("Long Beach terminal backlog grows"), "North America");
check('"Suez Canal transit delays continue"',
  inferRegionFromHeadline("Suez Canal transit delays continue"), "Middle East");
check('"Brazil port strike halts grain shipments"',
  inferRegionFromHeadline("Brazil port strike halts grain shipments"), "Latin America");
check("no recognisable place -> Unknown",
  inferRegionFromHeadline("Carrier rates soften amid weak demand"), "Unknown");
check('[real] first match in reading order wins ("US, China...")',
  inferRegionFromHeadline("US, China to extend trade war truce by 2 months"), "North America");

process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run verify`
Expected: FAIL — `Cannot find module '../.verify/tradeFeeds.js'`, because `lib/tradeFeeds.ts` does not exist yet and nothing imports it, so `tsc` never emits it.

- [ ] **Step 3: Create `lib/tradeFeeds.ts`**

```ts
import { Region } from "./types"

export interface TradeFeed {
  url: string
  publisher: string        // display name; becomes DisruptionEvent.sourceDomain
  format: "rss" | "atom"
  lastVerified: string     // ISO date a human last confirmed this URL returns a feed
}

// All six verified live on 2026-09-26: HTTP 200, parseable, non-empty.
// Re-verify periodically, same discipline as lib/laborCalendar.ts.
export const TRADE_FEEDS: TradeFeed[] = [
  { url: "https://www.supplychaindive.com/feeds/news/", publisher: "supplychaindive.com", format: "rss",  lastVerified: "2026-09-26" },
  { url: "https://www.freightwaves.com/news/feed",      publisher: "freightwaves.com",    format: "rss",  lastVerified: "2026-09-26" },
  { url: "https://maritime-executive.com/articles.rss", publisher: "maritime-executive.com", format: "atom", lastVerified: "2026-09-26" },
  { url: "https://gcaptain.com/feed/",                  publisher: "gcaptain.com",        format: "rss",  lastVerified: "2026-09-26" },
  { url: "https://splash247.com/feed/",                 publisher: "splash247.com",       format: "rss",  lastVerified: "2026-09-26" },
  { url: "https://www.joc.com/rss.xml",                 publisher: "joc.com",             format: "rss",  lastVerified: "2026-09-26" },
]

// Gate 1. Deliberately separate from scoreSeverity's frozen keyword list —
// this decides ADMISSION, that decides SEVERITY, and they should be able to
// change independently.
export const DISRUPTION_TERMS: string[] = [
  "strike", "closure", "closed", "delay", "delays", "shortage", "congestion",
  "tariff", "tariffs", "sanctions", "halt", "halts", "backlog", "suspend",
  "suspended", "disruption", "disrupted", "blocked", "blockade", "shutdown",
  "ban", "embargo", "curtail", "cancelled", "canceled", "diverted", "grounded",
  "trade war", "walkout", "lockout", "bottleneck",
]

// Gate 2. Without this, "Iceland's Last Whaling Company ... Permanent Ban"
// passes gate 1 on "ban" and lands in a supply chain risk feed at CRITICAL.
export const SUPPLY_CHAIN_TERMS: string[] = [
  "port", "ports", "freight", "cargo", "shipping", "shipment", "shipments",
  "container", "containers", "vessel", "vessels", "terminal", "terminals",
  "rail", "truck", "trucking", "warehouse", "supplier", "suppliers", "factory",
  "trade", "logistics", "harbor", "harbour", "dock", "dockworkers", "carrier",
  "supply chain", "tanker", "barge", "airfreight", "customs",
]

// Headline place names -> Region. Only entries we can attribute confidently.
// Order matters within the object only insofar as callers scan the title;
// see inferRegionFromHeadline for the reading-order rule.
export const HEADLINE_REGION_HINTS: Record<string, Region> = {
  // North America
  "united states": "North America", "u.s.": "North America", "us": "North America",
  "usa": "North America", "america": "North America", "canada": "North America",
  "mexico": "North America", "los angeles": "North America", "long beach": "North America",
  "savannah": "North America", "seattle": "North America", "houston": "North America",
  "new york": "North America", "vancouver": "North America", "oakland": "North America",
  "charleston": "North America", "norfolk": "North America", "montreal": "North America",
  "panama canal": "North America", "panama": "North America",

  // Europe
  "rotterdam": "Europe", "antwerp": "Europe", "hamburg": "Europe",
  "felixstowe": "Europe", "netherlands": "Europe", "germany": "Europe",
  "france": "Europe", "united kingdom": "Europe", "uk": "Europe",
  "britain": "Europe", "spain": "Europe", "italy": "Europe", "poland": "Europe",
  "belgium": "Europe", "europe": "Europe", "european": "Europe",
  "russia": "Europe", "ukraine": "Europe", "black sea": "Europe",
  "baltic": "Europe", "piraeus": "Europe", "valencia": "Europe",

  // Asia Pacific
  "china": "Asia Pacific", "chinese": "Asia Pacific", "shanghai": "Asia Pacific",
  "shenzhen": "Asia Pacific", "ningbo": "Asia Pacific", "qingdao": "Asia Pacific",
  "hong kong": "Asia Pacific", "japan": "Asia Pacific", "tokyo": "Asia Pacific",
  "south korea": "Asia Pacific", "busan": "Asia Pacific", "taiwan": "Asia Pacific",
  "singapore": "Asia Pacific", "vietnam": "Asia Pacific", "thailand": "Asia Pacific",
  "indonesia": "Asia Pacific", "malaysia": "Asia Pacific", "india": "Asia Pacific",
  "mumbai": "Asia Pacific", "bangladesh": "Asia Pacific", "philippines": "Asia Pacific",
  "australia": "Asia Pacific", "new zealand": "Asia Pacific",
  "malacca": "Asia Pacific", "asia": "Asia Pacific", "asian": "Asia Pacific",

  // Middle East
  "suez": "Middle East", "suez canal": "Middle East", "red sea": "Middle East",
  "hormuz": "Middle East", "persian gulf": "Middle East", "israel": "Middle East",
  "iran": "Middle East", "iraq": "Middle East", "saudi": "Middle East",
  "saudi arabia": "Middle East", "uae": "Middle East", "dubai": "Middle East",
  "jebel ali": "Middle East", "qatar": "Middle East", "yemen": "Middle East",
  "houthi": "Middle East", "houthis": "Middle East", "turkey": "Middle East",
  "egypt": "Middle East", "riyadh": "Middle East",

  // Latin America
  "brazil": "Latin America", "santos": "Latin America", "argentina": "Latin America",
  "chile": "Latin America", "peru": "Latin America", "colombia": "Latin America",
  "ecuador": "Latin America", "venezuela": "Latin America",

  // Africa
  "south africa": "Africa", "durban": "Africa", "nigeria": "Africa",
  "kenya": "Africa", "morocco": "Africa", "tangier": "Africa",
  "ethiopia": "Africa", "ghana": "Africa",
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack)
}

/**
 * Two-gate admission filter. An item must name BOTH a disruption AND something
 * in the supply chain. Gate 1 alone admits e.g. a whaling "ban"; gate 2 alone
 * admits ordinary trade-press business coverage.
 */
export function matchesDisruptionKeywords(title: string): boolean {
  if (!title) return false
  const hasDisruption = DISRUPTION_TERMS.some((t) => containsWord(title, t))
  if (!hasDisruption) return false
  return SUPPLY_CHAIN_TERMS.some((t) => containsWord(title, t))
}

/**
 * RSS feeds carry no country field, so region is inferred from the headline.
 * When a headline names several places the FIRST by position in the title
 * wins: DisruptionEvent.region is a single value and every consumer assumes
 * that. Returns "Unknown" rather than guessing when nothing matches.
 *
 * Deliberately does NOT reuse mapCountryToRegion() — that expects GDELT's
 * FIPS-style codes, where the same 2-letter code can mean a different country
 * (the collision v4.0 documented for GDACS).
 */
export function inferRegionFromHeadline(title: string): Region {
  if (!title) return "Unknown"
  let bestIndex = Infinity
  let bestRegion: Region = "Unknown"

  for (const [place, region] of Object.entries(HEADLINE_REGION_HINTS)) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const match = new RegExp(`\\b${escaped}\\b`, "i").exec(title)
    if (match && match.index < bestIndex) {
      bestIndex = match.index
      bestRegion = region
    }
  }

  return bestRegion
}
```

- [ ] **Step 4: Make `tsc` emit the new module**

`scripts/verify.sh` compiles from `lib/fetchDisruptions.ts`, which does not import `tradeFeeds.ts` yet, so nothing is emitted. Add `lib/tradeFeeds.ts` as a second entry point in `scripts/verify.sh`:

```bash
npx tsc lib/fetchDisruptions.ts lib/tradeFeeds.ts \
  --outDir .verify \
```

(the remaining flags are unchanged)

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run verify`
Expected: all PASS in both harnesses, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add lib/tradeFeeds.ts scripts/verify-trade-feeds.js scripts/verify.sh
git commit -m "feat: add trade-press feed registry and admission filter

Six supply-chain publications verified live 2026-09-26. Two-gate admission
filter requires both a disruption term and a supply-chain context term, so a
whaling 'ban' headline cannot enter a supply chain risk feed. Region is
inferred from the headline because RSS carries no country field, first match
in reading order winning, Unknown when nothing matches."
```

---

### Task 3: `lib/fetchTradeNews.ts` — the adapter

**Files:**
- Create: `lib/fetchTradeNews.ts`
- Create: `scripts/verify-trade-news.js`
- Modify: `package.json` (add `fast-xml-parser`)

**Interfaces:**
- Consumes: `TRADE_FEEDS`, `matchesDisruptionKeywords`, `inferRegionFromHeadline` from `lib/tradeFeeds.ts`; `assignCategory`, `scoreSeverity` from `lib/fetchDisruptions.ts`; `DisruptionEvent` from `lib/types.ts`.
- Produces: `function fetchTradeNews(): Promise<DisruptionEvent[]>`.

**Import-cycle note:** `fetchTradeNews.ts` imports `assignCategory`/`scoreSeverity` from `fetchDisruptions.ts`, and Task 4 makes `fetchDisruptions.ts` import `fetchTradeNews`. ES modules handle this cycle because both bindings are function declarations, hoisted before either module body runs. Do not convert either to a `const` arrow function.

- [ ] **Step 1: Install the parser**

Run: `npm install fast-xml-parser`
Expected: adds one dependency, no peer warnings.

- [ ] **Step 2: Write the failing test**

Create `scripts/verify-trade-news.js`:

```js
// Adapter behaviour with a stubbed network: RSS and Atom shapes, the
// admission filter, the round-robin cap, and the per-feed last-good cache.
const path = require("path");
const realDateNow = Date.now;
let clockOffset = 0;
Date.now = () => realDateNow.call(Date) + clockOffset;

function rssFeed(titles) {
  const items = titles.map((t, i) =>
    `<item><title>${t}</title><link>https://example.test/a${i}</link>` +
    `<pubDate>Fri, 26 Sep 2026 12:00:00 GMT</pubDate></item>`).join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Chan</title>${items}</channel></rss>`;
}
function atomFeed(titles) {
  const entries = titles.map((t, i) =>
    `<entry><title>${t}</title><link href="https://atom.test/a${i}"/>` +
    `<updated>2026-09-26T12:00:00Z</updated></entry>`).join("");
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Chan</title>${entries}</feed>`;
}

const ADMIT = "Port strike halts container terminal operations";
const REJECT_NO_CONTEXT = "Iceland whaling company shrugs off permanent ban";
const REJECT_NO_DISRUPTION = "6 food manufacturers talk supply chain tactics";

let mode = "ok";
global.fetch = async (url) => {
  const u = String(url);
  if (mode === "all-down") throw new Error("network down");
  if (mode === "malformed") return { ok: true, status: 200, text: async () => "<rss><chan" };
  const isAtom = u.includes("maritime-executive");
  const titles = [ADMIT, REJECT_NO_CONTEXT, REJECT_NO_DISRUPTION];
  return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
};

const { fetchTradeNews } = require("../.verify/fetchTradeNews.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

(async () => {
  console.log("-- healthy fetch, filter applied to both RSS and Atom --");
  let events = await fetchTradeNews();
  check("only the admitted headline survives, one per feed",
    events.length, 6);
  check("every event kept is the admitted one",
    events.every(e => e.title === ADMIT), true);
  check("Atom feed contributed",
    events.some(e => e.sourceDomain === "maritime-executive.com"), true);
  check("category assigned from title", events[0].category, "Port");
  check("severity assigned from title", events[0].severity, 3);
  check("ids are stable across fetches (no Date.now in id)",
    events[0].id, (await fetchTradeNews())[0].id);

  console.log("-- all feeds down: per-feed cache covers --");
  clockOffset += 60 * 1000;
  mode = "all-down";
  events = await fetchTradeNews();
  check("cached events still returned", events.length, 6);

  console.log("-- malformed XML must not wipe the cache --");
  clockOffset += 60 * 1000;
  mode = "malformed";
  events = await fetchTradeNews();
  check("cache survived malformed XML", events.length, 6);

  console.log("-- cap is enforced --");
  clockOffset += 60 * 1000;
  mode = "ok";
  global.fetch = async () => ({
    ok: true, status: 200,
    text: async () => rssFeed(Array.from({ length: 40 }, () => ADMIT)),
  });
  events = await fetchTradeNews();
  check("total capped at 30", events.length, 30);

  process.exit(failed ? 1 : 0);
})();
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run verify`
Expected: FAIL — `Cannot find module '../.verify/fetchTradeNews.js'`.

- [ ] **Step 4: Create `lib/fetchTradeNews.ts`**

```ts
import { XMLParser } from "fast-xml-parser"
import { DisruptionEvent } from "./types"
import { TRADE_FEEDS, TradeFeed, matchesDisruptionKeywords, inferRegionFromHeadline } from "./tradeFeeds"
import { assignCategory, scoreSeverity } from "./fetchDisruptions"

const FEED_TIMEOUT_MS = 10000
const TOTAL_CAP = 30

// Same write rule as the v4.8 GDELT cache: only a genuine non-empty success
// may overwrite, so a publisher outage can never wipe what is protecting us.
interface CachedFeed {
  events: DisruptionEvent[]
  fetchedAt: number
}
const lastGoodByFeed = new Map<string, CachedFeed>()

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  processEntities: true,
})

interface NormalisedItem {
  title: string
  link: string
  date: string
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function textOf(node: unknown): string {
  if (typeof node === "string") return node
  if (typeof node === "number") return String(node)
  if (node && typeof node === "object" && "#text" in (node as Record<string, unknown>)) {
    return String((node as Record<string, unknown>)["#text"] ?? "")
  }
  return ""
}

/** Normalises RSS <item> and Atom <entry> into one shape. */
function normalise(parsed: Record<string, unknown>, fetchedAtIso: string): NormalisedItem[] {
  const out: NormalisedItem[] = []

  // RSS 2.0: rss > channel > item
  const rss = parsed.rss as Record<string, unknown> | undefined
  const channel = rss?.channel as Record<string, unknown> | undefined
  for (const raw of asArray(channel?.item as Record<string, unknown> | Record<string, unknown>[])) {
    const title = textOf(raw.title)
    const link = textOf(raw.link)
    const date = textOf(raw.pubDate)
    if (title && link) out.push({ title, link, date: toIso(date, fetchedAtIso) })
  }

  // Atom: feed > entry, where link is an attribute
  const feed = parsed.feed as Record<string, unknown> | undefined
  for (const raw of asArray(feed?.entry as Record<string, unknown> | Record<string, unknown>[])) {
    const title = textOf(raw.title)
    const linkNode = raw.link as Record<string, unknown> | Record<string, unknown>[] | undefined
    const first = Array.isArray(linkNode) ? linkNode[0] : linkNode
    const link = first ? String(first["@_href"] ?? "") : ""
    const date = textOf(raw.updated) || textOf(raw.published)
    if (title && link) out.push({ title, link, date: toIso(date, fetchedAtIso) })
  }

  return out
}

/**
 * RSS pubDate is RFC-822, Atom updated is ISO-8601; Date handles both. An
 * unparseable date falls back to fetch time, which is defensible because every
 * item in a live feed is recent by construction.
 */
function toIso(raw: string, fallbackIso: string): string {
  if (!raw) return fallbackIso
  const parsed = new Date(raw)
  return isNaN(parsed.getTime()) ? fallbackIso : parsed.toISOString()
}

/** Stable, content-derived id — a positional index would churn React keys. */
function hashUrl(url: string): string {
  let h = 0
  for (let i = 0; i < url.length; i++) {
    h = (h << 5) - h + url.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h).toString(36)
}

function toEvent(item: NormalisedItem, feed: TradeFeed): DisruptionEvent {
  return {
    id: `rss-${feed.publisher.replace(/[^a-z0-9]+/gi, "-")}-${hashUrl(item.link)}`,
    title: item.title,
    url: item.link,
    date: item.date,
    sourceDomain: feed.publisher,
    sourceCountry: "",
    // Title only — never the URL. assignCategory matches against title + url,
    // so a publisher's own domain leaks in: a neutral headline classifies as
    // General alone but as Port once a maritime-executive.com URL is appended.
    category: assignCategory(item.title, ""),
    severity: scoreSeverity(item.title),
    region: inferRegionFromHeadline(item.title),
  }
}

async function fetchOneFeed(feed: TradeFeed): Promise<DisruptionEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS)
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      headers: { "User-Agent": "SCM-Disruption-Monitor/1.0 (+https://scm-disruption-monitor.vercel.app)" },
    })
    if (!res.ok) throw new Error(`${feed.publisher} responded with ${res.status}`)
    const xml = await res.text()
    const parsed = parser.parse(xml) as Record<string, unknown>
    const fetchedAtIso = new Date().toISOString()
    return normalise(parsed, fetchedAtIso)
      .filter((item) => matchesDisruptionKeywords(item.title))
      .map((item) => toEvent(item, feed))
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Round-robin: first admitted item from each feed, then the second from each,
 * until the cap or exhaustion. Guarantees every publisher is represented before
 * any publisher gets a second slot — FreightWaves alone returns 56 items
 * against Supply Chain Dive's 10, so naive concatenation plus a flat cap would
 * let one publisher fill the entire allowance.
 */
function interleave(perFeed: DisruptionEvent[][], cap: number): DisruptionEvent[] {
  const out: DisruptionEvent[] = []
  const maxLen = Math.max(0, ...perFeed.map((l) => l.length))
  for (let round = 0; round < maxLen && out.length < cap; round++) {
    for (const list of perFeed) {
      if (out.length >= cap) break
      if (round < list.length) out.push(list[round])
    }
  }
  return out
}

export async function fetchTradeNews(): Promise<DisruptionEvent[]> {
  const results = await Promise.allSettled(TRADE_FEEDS.map((f) => fetchOneFeed(f)))

  const perFeed: DisruptionEvent[][] = []
  let live = 0
  let cached = 0
  let failedCount = 0

  results.forEach((result, i) => {
    const feed = TRADE_FEEDS[i]
    const fresh = result.status === "fulfilled" ? result.value : []

    if (result.status === "rejected") {
      console.error(`[TradeNews] ${feed.publisher} failed:`, result.reason)
    }

    if (fresh.length > 0) {
      lastGoodByFeed.set(feed.url, { events: fresh, fetchedAt: Date.now() })
      perFeed.push(fresh)
      live++
    } else {
      const prev = lastGoodByFeed.get(feed.url)
      if (prev) {
        perFeed.push(prev.events)
        cached++
      } else {
        perFeed.push([])
        failedCount++
      }
    }
  })

  const events = interleave(perFeed, TOTAL_CAP)
  console.log(
    `[TradeNews] ${events.length} events (${live} live / ${cached} cached / ${failedCount} failed of ${TRADE_FEEDS.length} feeds)`
  )
  return events
}
```

- [ ] **Step 5: Add the new module to the compile step**

In `scripts/verify.sh`, extend the entry points:

```bash
npx tsc lib/fetchDisruptions.ts lib/tradeFeeds.ts lib/fetchTradeNews.ts \
  --outDir .verify \
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run verify`
Expected: all PASS across all three harnesses, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add lib/fetchTradeNews.ts scripts/verify-trade-news.js scripts/verify.sh package.json package-lock.json
git commit -m "feat: add trade-press RSS adapter

Fetches six feeds in parallel with a 10s timeout each, normalises RSS 2.0 and
Atom into one shape, applies the two-gate admission filter, and interleaves
results round-robin under a 30-item cap so one prolific publisher cannot crowd
out the rest.

Per-feed last-good cache reuses the v4.8 write rule: overwrite only on a
genuine non-empty success. assignCategory is called with the title only,
because passing the URL lets a publisher's own domain decide the category."
```

---

### Task 4: Wire into the merge

**Files:**
- Modify: `lib/fetchDisruptions.ts`

**Interfaces:**
- Consumes: `fetchTradeNews()` from Task 3.
- Produces: no new exports; `fetchDisruptions()` now includes trade-news events and dedupes across all sources.

- [ ] **Step 1: Write the failing test**

Append to `scripts/verify-trade-news.js`, immediately before the `process.exit` line:

```js
  console.log("-- merged feed includes trade news and dedupes across sources --");
  const { fetchDisruptions } = require("../.verify/fetchDisruptions.js");
  // GDELT and GDACS/NOAA all fail; only trade news contributes. One trade-news
  // URL is also returned by GDELT, and must appear exactly once.
  const SHARED = "https://example.test/a0";
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("gdeltproject.org")) {
      return { ok: true, status: 200, json: async () => ({ articles: [{
        url: SHARED, title: ADMIT, seendate: "20260926T120000Z",
        domain: "example.test", sourcecountry: "US" }] }) };
    }
    if (u.includes("gdacs.org") || u.includes("weather.gov")) {
      return { ok: true, status: 200, json: async () => ({ features: [] }) };
    }
    return { ok: true, status: 200, text: async () => rssFeed([ADMIT]) };
  };
  clockOffset += 10 * 60 * 1000; // past the 5-minute fetchDisruptions memo TTL
  const merged = await fetchDisruptions();
  check("shared URL appears exactly once across sources",
    merged.filter(e => e.url === SHARED).length, 1);
  check("trade-news events present in merged feed",
    merged.some(e => e.sourceDomain === "supplychaindive.com"), true);
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run verify`
Expected: FAIL — `trade-news events present in merged feed` returns `false`, because `fetchDisruptions` does not call `fetchTradeNews` yet. The dedup check may also fail with a count of 2.

- [ ] **Step 3: Add the source to the merge**

In `lib/fetchDisruptions.ts`, add the import at the top:

```ts
import { fetchTradeNews } from "./fetchTradeNews"
```

Change the `Promise.all` from three entries to four:

```ts
  const [gdeltResults, disasterEvents, weatherEvents, tradeEvents] = await Promise.all([
    fetchGdeltQueriesSequentially(queries, fetchQuery),
    fetchGlobalDisasters(),
    fetchWeatherAlerts(),
    fetchTradeNews(),
  ])
```

- [ ] **Step 4: Dedupe across all sources, not just GDELT**

`seenUrls` is currently populated only inside the GDELT loop. Replace the three `events.push(...)` blocks for the non-GDELT sources with a shared helper. After the GDELT `forEach` and before the `anySuccess` check, replace:

```ts
  if (disasterEvents.length > 0) anySuccess = true
  events.push(...disasterEvents)

  if (weatherEvents.length > 0) anySuccess = true
  events.push(...weatherEvents)
```

with:

```ts
  // Dedupe across sources, not just within GDELT — the same story can legitimately
  // appear in both GDELT and the trade-press feeds. URL only; title-based fuzzy
  // matching is deliberately out of scope, since a wrong match silently deletes
  // a real event.
  const pushDeduped = (incoming: DisruptionEvent[]) => {
    for (const event of incoming) {
      const key = event.url || `title:${event.title}`
      if (seenUrls.has(key)) continue
      seenUrls.add(key)
      events.push(event)
    }
  }

  if (disasterEvents.length > 0) anySuccess = true
  pushDeduped(disasterEvents)

  if (weatherEvents.length > 0) anySuccess = true
  pushDeduped(weatherEvents)

  if (tradeEvents.length > 0) anySuccess = true
  pushDeduped(tradeEvents)
```

- [ ] **Step 5: Update the summary log line**

Replace the existing `console.log` for `[Disruptions]` so trade news is visible. The GDELT event count must now subtract trade events too:

```ts
  const tally = (state: string) => queryOutcomes.filter((o) => o === state).length
  const gdeltEventCount =
    events.length - disasterEvents.length - weatherEvents.length - tradeEvents.length
  const oldestCacheAgeMin = Math.max(
    0,
    ...Array.from(lastGoodByQuery.values()).map((c) =>
      Math.round((Date.now() - c.fetchedAt) / 60000)
    )
  )
  console.log(
    `[Disruptions] ${events.length} total events ` +
    `(GDELT ${gdeltEventCount} events from ${tally("live")} live / ${tally("cached")} cached / ` +
    `${tally("failed")} failed of ${queries.length} queries` +
    `${tally("cached") > 0 ? `, cache age up to ${oldestCacheAgeMin}m` : ""}` +
    `, TradeNews: ${tradeEvents.length}, GDACS: ${disasterEvents.length}, NOAA: ${weatherEvents.length})`
  )
```

Note `gdeltEventCount` is approximate once dedup drops cross-source duplicates; that is acceptable for a log line.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run verify`
Expected: all PASS, exit code 0.

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: succeeds. The build log should show a `[Disruptions]` line including `TradeNews: N` with N > 0. Only the three pre-existing lint warnings.

- [ ] **Step 8: Commit**

```bash
git add lib/fetchDisruptions.ts
git commit -m "feat: merge trade-press RSS into the disruption feed

Adds fetchTradeNews() to the Promise.all and extends URL dedup to span all
sources, since the same story can appear in both GDELT and the trade press.
The summary log line now reports TradeNews alongside GDELT, GDACS and NOAA."
```

---

### Task 5: Live and browser verification

No code changes. Confirms the feature works against real feeds and renders correctly.

**Files:** none modified.

- [ ] **Step 1: Confirm real feeds still return admitted items**

Run: `npm run build`

Expected: the `[Disruptions]` line shows `TradeNews: N` with N between 10 and 30, and `[TradeNews] N events (6 live / 0 cached / 0 failed of 6 feeds)`.

If N is 0, the admission filter is too strict against today's headlines. Do NOT loosen to a single gate — widen `DISRUPTION_TERMS` or `SUPPLY_CHAIN_TERMS` in `lib/tradeFeeds.ts` and re-run.

- [ ] **Step 2: Inspect the category mix**

Run:

```bash
npm run build 2>&1 | grep -E "\[TradeNews\]|\[Disruptions\]"
```

Expected: Port, Tariff, Labor and Geopolitical are no longer all zero. Confirm by starting the dev server and checking the rendered feed in the next step.

- [ ] **Step 3: Browser verification**

Start the dev server (`npm run dev`), open `http://localhost:3000`.

**Back up `localStorage` first and restore it byte-identical afterwards** — this origin may hold real profile data:

```js
const backup = {};
for (let i = 0; i < localStorage.length; i++) {
  const k = localStorage.key(i);
  if (k && (k.startsWith("scm_") || k === "theme")) backup[k] = localStorage.getItem(k);
}
localStorage.setItem("__scm_backup__", JSON.stringify(backup));
```

Confirm:
1. The feed shows events from trade-press domains (supplychaindive.com, joc.com, gcaptain.com, freightwaves.com, splash247.com, maritime-executive.com).
2. Port / Tariff / Labor / Geopolitical category filter pills return results.
3. Clicking a trade-press event's "Read →" opens the real article.
4. No new console errors beyond the known Navbar live-clock hydration warning.

Restore:

```js
const backup = JSON.parse(localStorage.getItem("__scm_backup__"));
Object.keys(localStorage).filter(k => k.startsWith("scm_") || k === "theme")
  .forEach(k => localStorage.removeItem(k));
Object.entries(backup).forEach(([k, v]) => localStorage.setItem(k, v));
localStorage.removeItem("__scm_backup__");
```

- [ ] **Step 4: Stop the dev server**

Run: `pkill -f "next dev"` and confirm port 3000 is free.

---

### Task 6: Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update status and folder structure**

Set `- Status: v4.9 live`.

In the `/lib` section, add:

```
  tradeFeeds.ts                   → Trade-press RSS registry (6 publications, each sourced +
                                    dated with lastVerified), two-gate admission filter
                                    (DISRUPTION_TERMS AND SUPPLY_CHAIN_TERMS), and
                                    HEADLINE_REGION_HINTS + inferRegionFromHeadline() since RSS
                                    carries no country field (v4.9). Pure, no I/O.
  fetchTradeNews.ts               → Fetches the 6 feeds in parallel (10s timeout each),
                                    normalises RSS 2.0 and Atom into one shape via
                                    fast-xml-parser, filters, caps at 30 round-robin across
                                    feeds, per-feed last-good cache using the v4.8 write rule
                                    (v4.9). Calls assignCategory with the TITLE ONLY — passing
                                    the URL lets a publisher's domain decide the category.
```

- [ ] **Step 2: Update the severity scoring rules section**

Under `## Severity scoring rules (DO NOT CHANGE without asking)`, append:

```
Matching is WORD-BOUNDARY as of v4.9, not substring. The keyword lists and the
3/2/1 tiers are unchanged. Before v4.9, "ban" matched inside Albania / urban /
abandoned / Lebanon and "halt" matched inside asphalt, so unrelated headlines
scored CRITICAL. assignCategory got the same fix: "port" was matching inside
imported / export / transport / reporter.
```

- [ ] **Step 3: Add the v4.9 version history entry**

Insert before `## Known issues / next session notes`, matching the style of surrounding entries. It must cover: the problem (feed had zero trade news because GDELT is unreachable from Vercel), the six feeds and their verification date, the two-gate filter and why gate 2 exists (the whaling-ban case), headline region inference and why `mapCountryToRegion` was not reused, the word-boundary fixes with the exact broken strings, the `assignCategory(title, "")` decision and the maritime-executive.com evidence, the round-robin cap, and the `scripts/verify.sh` harness as the repo's first test suite.

- [ ] **Step 4: Add the backlog line**

Above `- [ ] Watchlist with notification badges`:

```
- [x] Trade-press RSS as primary source for Port/Tariff/Labor/Geopolitical,
      word-boundary category and severity matching (Sep 2026)
```

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to v4.9"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| Decision 1 (RSS primary, GDELT retained) | 3, 4 |
| Decision 2 (keyword filter) | 2 |
| Decision 3 (fast-xml-parser) | 3 |
| Decision 4 (region inference) | 2 |
| Decision 5 (assignCategory word boundary) | 1 |
| Decision 6 (fixed caps, round-robin) | 3 |
| Decision 7 (scoreSeverity word boundary) | 1 |
| Two-gate filter + traced headlines | 2 |
| `mapCountryToRegion` not reused | 2 |
| Stable URL-derived ids | 3 |
| `assignCategory(title, "")` | 3 |
| Per-feed last-good cache | 3 |
| Degradation ladder / `anySuccess` | 4 |
| Cross-source dedup | 4 |
| Malformed XML, missing fields, date fallback | 3 |
| Testing layers 1-3 | 1, 2, 3 |
| Testing layer 4 (live + browser) | 5 |
| Consequences documented | 6 |

No gaps.

**Placeholder scan:** no TBD/TODO. Every code step contains complete, runnable content. Task 6 Step 3 describes required content rather than final prose — acceptable because it is a prose changelog entry whose required facts are enumerated explicitly.

**Type consistency:** `matchesDisruptionKeywords(title: string): boolean` and `inferRegionFromHeadline(title: string): Region` are defined in Task 2 and consumed under those exact names in Task 3. `fetchTradeNews(): Promise<DisruptionEvent[]>` is defined in Task 3 and consumed in Task 4. `TradeFeed` is exported in Task 2 and imported in Task 3. `containsWord` is intentionally duplicated in `fetchDisruptions.ts` and `tradeFeeds.ts` rather than shared, to avoid adding an import cycle for a four-line helper — noted here so it is not mistaken for an oversight.
