# Trade-Press RSS Source (Phase 3) — Design

**Date:** 2026-09-26
**Status:** Approved, pending implementation plan
**Target release:** v4.9

## Problem

The Live Disruption Feed serves no trade news. Measured on production on
2026-09-26: 23 events, Weather 18 / General 5, sourced entirely from
weather.gov (15) and gdacs.org (8). Port, Tariff, Labor and Geopolitical are
all zero.

Those four categories are produced exclusively by GDELT, and GDELT is not
reachable from Vercel with any reliability. Evidence gathered during the v4.8
investigation:

- A single isolated request from a quiet residential IP, after 20s, 60s and
  90s of total silence, returns HTTP 429 every time. Request pacing is not the
  binding constraint, so retries and backoff cannot fix it.
- GDELT has a second failure mode: HTTP 200 with a bare `{}` and no `articles`
  key. Not an empty result — the bare word `tariff` over 24H returns `{}` the
  same way.
- User-Agent and query shape were both ruled out as causes.
- Across four consecutive observations — a local build, a production deploy
  build, and an ISR regeneration — GDELT returned zero usable articles.

v4.8 made GDELT failures *survivable* (per-query last-good cache) and
*temporary* (30-minute ISR instead of once-per-deploy). Both mechanisms are
confirmed working. Neither helps while GDELT returns nothing at all: an empty
cache has nothing to serve.

Phase 3 removes the dependency. Trade-press RSS is free, unthrottled, requires
no key, and is more on-topic than GDELT's keyword sweep of general news.

## Decisions

Each was made explicitly during brainstorming on 2026-09-26.

| # | Decision | Choice |
|---|---|---|
| 1 | Role of RSS relative to GDELT | **Primary**; GDELT retained as best-effort bonus |
| 2 | Which RSS items are admitted | **Disruption keyword filter** (not ingest-everything) |
| 3 | XML parsing | **Add `fast-xml-parser`** |
| 4 | Region for RSS events | **Infer from headline**, `"Unknown"` when no match |
| 5 | `assignCategory` fix scope | **Word-boundary matching only** |
| 6 | Feed balance | **Fixed per-source caps** |
| 7 | `scoreSeverity` word-boundary fix | **Yes**, included in this phase |

Decision 7 required explicit permission: CLAUDE.md marks the severity scoring
rules "DO NOT CHANGE without asking". The documented rules are unchanged — same
keyword lists, same 3/2/1 tiers. Only the matching becomes word-accurate.

## Why GDELT is retained rather than removed

GDELT contributes global, multilingual breadth that six English-language trade
publications cannot. It works intermittently rather than never, and the v4.8
cache is already built and tested. Removing it would discard working code to
solve a problem the RSS source already solves. Revisit only if GDELT stays
dead after Phase 3 ships.

## Architecture

Two new files, following the adapter pattern established by v4.0's
`fetchGlobalDisasters.ts` / `fetchWeatherAlerts.ts`, and the data/logic split
established by v4.2's `structuralRisk.ts`.

### `lib/tradeFeeds.ts` — data and pure functions, no I/O

```ts
export interface TradeFeed {
  url: string
  publisher: string        // display name, becomes sourceDomain
  format: "rss" | "atom"
  lastVerified: string     // ISO date a human last confirmed the URL works
}

export const TRADE_FEEDS: TradeFeed[]
export const DISRUPTION_TERMS: string[]       // gate 1
export const SUPPLY_CHAIN_TERMS: string[]     // gate 2
export const HEADLINE_REGION_HINTS: Record<string, Region>

export function matchesDisruptionKeywords(title: string): boolean
export function inferRegionFromHeadline(title: string): Region
```

Feeds verified live on 2026-09-26, all HTTP 200:

| Publisher | Format | Items observed |
|---|---|---|
| Supply Chain Dive | RSS 2.0 | 10 |
| FreightWaves | RSS 2.0 | 56 |
| Maritime Executive | **Atom** | 68 |
| gCaptain | RSS 2.0 | 12 |
| Splash247 | RSS 2.0 | 10 |
| Journal of Commerce | RSS 2.0 | 40 |

Maritime Executive being Atom is why a hand-rolled `<item>` parser was
rejected: it would have silently returned zero items for that feed.

`HEADLINE_REGION_HINTS` lives here, not in the adapter, because it is the
largest and most frequently edited part of the feature. Edits to a lookup
table must not be able to break parsing.

### `lib/fetchTradeNews.ts` — the adapter

```ts
export async function fetchTradeNews(): Promise<DisruptionEvent[]>
```

Signature is identical to `fetchGlobalDisasters()` and `fetchWeatherAlerts()`,
so it drops into the existing `Promise.all` with a one-line change.

### `lib/fetchDisruptions.ts` — two small changes

1. Add `fetchTradeNews()` to the `Promise.all`; count its results toward
   `anySuccess`.
2. Extend the existing `seenUrls` dedup to span all sources. It currently runs
   only within GDELT, so the same story appearing in both GDELT and RSS would
   duplicate.

Also in this file: word-boundary fixes to `assignCategory` and `scoreSeverity`.

## Data flow

Per feed: fetch → parse → normalise → **two-gate filter** → map → dedup → cap
→ merge.

### Two-gate admission filter

An item is admitted only if its title contains **both**:

1. a **disruption term** — strike, closure, delay, shortage, congestion,
   tariff, sanctions, halt, backlog, suspend, disruption, blocked, shutdown,
   ban, embargo, curtail
2. a **supply-chain context term** — port, freight, cargo, shipping,
   container, vessel, terminal, rail, truck, warehouse, supplier, factory,
   trade, logistics, harbor, dock, carrier, shipment

Both gates use word-boundary matching from the outset.

The second gate exists because gate 1 alone produces false positives on real
headlines. Traced against feed content pulled 2026-09-26:

| Headline | Gate 1 | Gate 2 | Result |
|---|---|---|---|
| "Closure of Los Angeles harbor bridge amid elevated container dwells" | closure | harbor, container | admit |
| "US, China to extend trade war truce by 2 months" | trade war | trade | admit |
| "USPS warns of Indianapolis, Louisville delays" | delays | — | reject |
| "Iceland's Last Whaling Company Shrugs Off Threat Of Permanent Ban" | ban | — | reject |
| "6 food manufacturers talk supply chain tactics" | — | supply chain | reject |

The whaling headline is the motivating case: under the frozen severity rules
`ban` scores CRITICAL, so admitting it would put a whaling story at the top of
a supply chain risk feed.

Note the USPS row: a real disruption rejected for lacking a context term. This
is an accepted precision-over-recall tradeoff. Revisit the term lists if the
feed starves, not by loosening to a single gate.

### Region inference

`inferRegionFromHeadline(title)` matches country, port and chokepoint names
against `HEADLINE_REGION_HINTS`.

- Multiple matches → **first in reading order** wins. `DisruptionEvent.region`
  is a single value and every consumer assumes that; introducing a multi-region
  concept would ripple through scoring, the map and the KPI bar for marginal
  gain.
- No match → `"Unknown"`. Never guess.

`mapCountryToRegion()` is deliberately **not** reused: it expects GDELT's
FIPS-style country codes, and the same 2-letter code means different countries
between schemes. This is the trap v4.0 documented for GDACS.

### Mapping to `DisruptionEvent`

| Field | Source |
|---|---|
| `id` | `rss-{publisher-slug}-{stable hash of item URL}` — see note below |
| `title` | item title, entities decoded |
| `url` | item link |
| `date` | RSS `pubDate` (RFC-822) or Atom `updated` (ISO-8601) |
| `sourceDomain` | `TradeFeed.publisher` |
| `sourceCountry` | `""` — feeds do not provide one |
| `category` | `assignCategory(title, url)`, word-boundary fixed |
| `severity` | `scoreSeverity(title)`, word-boundary fixed |
| `region` | `inferRegionFromHeadline(title)` |

The id derives from the item URL, not its position in the feed. A positional
index would point at a different article every time the feed shifts, churning
React keys on every regeneration. This deliberately differs from the existing
GDELT ids, which embed `Date.now()` and are unstable by construction — that is
pre-existing and out of scope here, but the new source should not copy it.

### Caps

Total admitted items capped at **30**, allocated **round-robin across feeds**:
take the first admitted item from each feed in turn, then the second from each,
and so on until either the cap is reached or every feed is exhausted. A feed
that runs out drops out of the rotation. This guarantees every publisher is
represented before any publisher receives a second slot. FreightWaves alone returns
56 items against Supply Chain Dive's 10; naive concatenation plus a flat cap
would let FreightWaves fill the entire allowance.

NOAA stays at 15, GDACS stays uncapped. Weather is never suppressed — a real
hurricane still surfaces fully. The fix is that trade news stops being absent,
not that weather gets trimmed.

## Error handling

Six feeds fetched in **parallel** via `Promise.allSettled`, 10s timeout each.
Independent hosts with no shared throttle, so GDELT's sequential-with-gap
treatment is unnecessary here.

**Per-feed last-good cache**, reusing the v4.8 pattern exactly: keyed by feed
URL, overwritten **only on a genuine non-empty success**, so a throttled or
failed fetch can never wipe the data protecting the feed.

Degradation ladder: fresh items → that feed's cached items → omit that feed.
RSS success counts toward `anySuccess`, so `data/fallback.json` remains the
last resort only when every source fails.

Per-item:

- Malformed XML → parser throws → feed treated as failed → cache fallback
- Item missing title or link → skipped; without a URL it cannot be deduped or
  linked
- Unparseable date → fall back to fetch time. Defensible because every item in
  a live feed is recent by construction; documented rather than silent.

## Testing

1. **Pure functions** — `matchesDisruptionKeywords` and
   `inferRegionFromHeadline`, driven by real headlines pulled 2026-09-26,
   including the whaling-ban rejection and the USPS accepted-loss case.
2. **Regression** — the exact strings proven broken:
   - `assignCategory`: "imported", "export", "transport", "reporter" must no
     longer classify as Port
   - `scoreSeverity`: "Albania", "asphalt", "urban", "abandoned", "Lebanon"
     must no longer score CRITICAL
   - Control: "Port strike halts container terminal operations" must still be
     Port and still CRITICAL
3. **Adapter with stubbed fetch** — feed down, malformed XML, Atom vs RSS
   shape, cache fallback, round-robin cap. Same harness style as v4.8.
4. **Live smoke test** against the six real feeds, then browser verification of
   the merged feed.

## Consequences

Both visible, neither a bug:

- **Event volume roughly doubles** (23 → ~50). KPI counts, the category chart
  and "Events Affecting You" all shift.
- **Stored 7-day category trends become apples-to-oranges** across this change.
  Both the word-boundary fix and the new source alter the category mix, so
  sparklines compare old-rules history against new-rules counts for a week.

## Out of scope

- **Title-based fuzzy dedup.** URL dedup only. A wrong fuzzy match silently
  deletes a real event.
- **Publisher `<category>` tags.** Considered and rejected: tags vary across
  outlets and need per-feed mapping tables that drift when publishers rename
  sections.
- **Removing GDELT.** See rationale above.
- **Durable cross-instance cache.** In-memory only, consistent with v4.8. A
  cold instance during a total outage still degrades; RSS reliability is what
  makes that acceptable.

## Files touched

| File | Change |
|---|---|
| `lib/tradeFeeds.ts` | new — feed registry, term lists, region hints, pure matchers |
| `lib/fetchTradeNews.ts` | new — adapter |
| `lib/fetchDisruptions.ts` | add source to `Promise.all`; cross-source dedup; word-boundary fixes to `assignCategory` and `scoreSeverity` |
| `package.json` | add `fast-xml-parser` |
| `CLAUDE.md` | v4.9 entry, folder structure, severity rules note |

No protected file is modified. `lib/profile.ts`, `lib/scoreEvents.ts`,
`lib/gemini.ts` and all API routes are untouched. `lib/fetchDisruptions.ts` is
not on the protected list, but the severity-rules change inside it was
explicitly authorised.
