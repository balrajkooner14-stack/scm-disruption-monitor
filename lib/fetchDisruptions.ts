import fs from "fs"
import path from "path"
import { DisruptionEvent, DisruptionCategory, SeverityLevel, Region } from "./types"
import { fetchGlobalDisasters } from "./fetchGlobalDisasters"
import { fetchWeatherAlerts } from "./fetchWeatherAlerts"

// Requires the keyword to START a word. The previous substring checks meant
// "port" matched inside "imported"/"export"/"transport"/"reporter", and
// "ban"/"halt" matched inside "Albania"/"urban"/"abandoned"/"Lebanon"/
// "asphalt" — so tariff and geopolitical stories were labelled Port and
// unrelated headlines scored CRITICAL.
//
// A LEADING boundary only, deliberately NOT a trailing one. Verified
// 2026-09-26 that requiring both boundaries also breaks every inflected form:
// "tariffs", "sanctions", "shipping", "delays", "closures", "banned" and
// "containers" all stop matching their keyword. Those are among the most
// common words in trade headlines, so full-boundary matching would gut recall
// in exactly the categories this feature exists to fill. The residual cost is
// prefix false positives ("portal", "bankruptcy") — much cheaper.
//
// Keywords may be multi-word ("trade war"), so metacharacters are escaped.
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}`, "i").test(haystack)
}

export function scoreSeverity(title: string): SeverityLevel {
  const critical = ["strike", "closure", "sanctions", "blocked", "halt", "shutdown", "ban"]
  const warning = ["delay", "shortage", "disruption", "tariff", "congestion", "reduced"]
  if (critical.some((kw) => containsWord(title, kw))) return 3
  if (warning.some((kw) => containsWord(title, kw))) return 2
  return 1
}

export function mapCountryToRegion(countryCode: string): Region {
  const code = (countryCode || "").toUpperCase().trim()

  const northAmerica = ["US", "CA", "MX", "CU", "JM", "HT", "DO", "PR", "GT",
    "BZ", "HO", "ES", "NU", "CS", "PM"]
  const europe = ["UK", "FR", "GM", "IT", "SP", "NL", "SW", "NO", "PL", "BE",
    "AU", "SZ", "PO", "GR", "HU", "CZ", "RO", "BU", "HR", "SR", "FI", "DA",
    "IC", "IR", "LU", "SK", "SI", "AL", "MK", "BO", "EI", "LG", "LH", "MT",
    "EN", "RU", "UP", "BY", "MD", "AJ", "GG", "AM"]
  const asiaPacific = ["CH", "JA", "KS", "IN", "SN", "AS", "TH", "VM", "ID",
    "MY", "PH", "TW", "NZ", "BN", "CB", "LA", "BM", "MV", "NP", "BG", "CE",
    "KZ", "UZ", "TM", "KG", "TJ", "AF", "PK", "MG", "RS", "PP", "WF"]
  const middleEast = ["SA", "AE", "IR", "IZ", "IS", "TU", "EG", "QA", "KU",
    "BA", "OM", "YM", "JO", "LE", "SY", "WE", "GZ", "CY"]
  const latinAmerica = ["BR", "AR", "CI", "CO", "PE", "VE", "EC", "BO", "PA",
    "UR", "PY", "GY", "NS", "TD", "BB", "VC", "LC", "AC", "BH", "CJ", "RQ"]
  const africa = ["NI", "SF", "KE", "GH", "ET", "TZ", "UG", "ZI", "MO", "AO",
    "MZ", "ZA", "SO", "LY", "TU", "MR", "ML", "SG", "GV", "SL", "LI", "IV",
    "GH", "TO", "BN", "CM", "CF", "CD", "CG", "GA", "EK", "BY", "DJ", "ER",
    "RW", "BI", "MW", "ZM", "BC", "NA", "BW", "LS", "SV", "SE", "SU"]

  if (northAmerica.includes(code)) return "North America"
  if (europe.includes(code)) return "Europe"
  if (asiaPacific.includes(code)) return "Asia Pacific"
  if (middleEast.includes(code)) return "Middle East"
  if (latinAmerica.includes(code)) return "Latin America"
  if (africa.includes(code)) return "Africa"
  return "Unknown"
}

export function assignCategory(title: string, url: string): DisruptionCategory {
  const text = title + " " + url

  if (
    containsWord(text, "port") || containsWord(text, "ship") || containsWord(text, "vessel") ||
    containsWord(text, "container") || containsWord(text, "freight") || containsWord(text, "cargo") ||
    containsWord(text, "maritime") || containsWord(text, "dock") || containsWord(text, "harbor") ||
    containsWord(text, "berth") || containsWord(text, "terminal")
  ) return "Port"

  if (
    containsWord(text, "strike") || containsWord(text, "worker") || containsWord(text, "union") ||
    containsWord(text, "labor") || containsWord(text, "labour") || containsWord(text, "walkout") ||
    containsWord(text, "employment") || containsWord(text, "workforce")
  ) return "Labor"

  if (
    containsWord(text, "tariff") || containsWord(text, "duty") || containsWord(text, "import tax") ||
    containsWord(text, "trade war") || containsWord(text, "customs") || containsWord(text, "levy") ||
    containsWord(text, "trade barrier") || containsWord(text, "protectionism")
  ) return "Tariff"

  if (
    containsWord(text, "sanction") || containsWord(text, "geopolit") || containsWord(text, "conflict") ||
    containsWord(text, "war") || containsWord(text, "blockade") || containsWord(text, "embargo") ||
    containsWord(text, "invasion") || containsWord(text, "missile") || containsWord(text, "military") ||
    containsWord(text, "strait") || containsWord(text, "canal")
  ) return "Geopolitical"

  if (
    containsWord(text, "storm") || containsWord(text, "flood") || containsWord(text, "hurricane") ||
    containsWord(text, "earthquake") || containsWord(text, "typhoon") || containsWord(text, "drought") ||
    containsWord(text, "wildfire") || containsWord(text, "climate") || containsWord(text, "weather")
  ) return "Weather"

  return "General"
}

interface GdeltArticle {
  url: string
  title: string
  seendate: string
  domain: string
  sourcecountry: string
}

interface GdeltResponse {
  articles?: GdeltArticle[]
}

function isUsableUrl(url: string): boolean {
  if (!url || url.trim() === "") return false
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()
    const BAD_DOMAINS = [
      "example.com", "example.org", "example.net",
      "localhost", "127.0.0.1",
    ]
    if (BAD_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d))) {
      return false
    }
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function parseGdeltDate(seendate: string): string {
  // Format: YYYYMMDDTHHMMSSZ → ISO string
  const match = seendate.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (!match) return new Date().toISOString()
  const [, year, month, day, hour, min, sec] = match
  return `${year}-${month}-${day}T${hour}:${min}:${sec}Z`
}

function loadFallback(): DisruptionEvent[] {
  const fallbackPath = path.join(process.cwd(), "data", "fallback.json")
  const raw = fs.readFileSync(fallbackPath, "utf-8")
  return JSON.parse(raw) as DisruptionEvent[]
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// GDELT has a second, quieter failure mode alongside the 429: it answers
// HTTP 200 with a bare `{}` — no `articles` key at all. That is not an empty
// result set (the bare word "tariff" over 24H returns `{}` the same way, and
// that query obviously has thousands of hits), it's a soft throttle. The old
// code counted it as a success, contributed zero events from it, and reported
// the query as "ok" in the summary line — which is why the diagnostics
// overstated GDELT's health. Treated as a failure now so it falls through to
// the per-query cache below.
class GdeltSoftThrottleError extends Error {
  constructor() {
    super("GDELT returned HTTP 200 with no articles array (soft throttle)")
    this.name = "GdeltSoftThrottleError"
  }
}

// Last known-good events per query index, so a failing query falls back to its
// OWN previous results rather than the whole fetch collapsing. This matters
// because the failures are not uniform: query 0 ("supply chain disruption")
// frequently succeeds while queries 1 and 2 — the ones that actually produce
// Port / Labor / Tariff / Geopolitical events — are the ones that 429. Caching
// a single merged blob would let a lucky query 0 mask the loss of the other
// two. Write rule: only ever overwrite on a genuine, non-empty success, so a
// throttled response can never wipe the data protecting us.
interface CachedQueryResult {
  events: DisruptionEvent[]
  fetchedAt: number
}
const lastGoodByQuery = new Map<number, CachedQueryResult>()

// GDELT's own throttle message asks for "one request every 5 seconds". v4.6
// used a 2s gap, which is under their published limit — so we were knowingly
// breaking the documented rule on top of the shared-IP problem. 6s respects it.
// This is NOT the main cause of the 429s (a single isolated request from a
// quiet IP still gets throttled), but there's no reason to be self-inflicted.
const GDELT_REQUEST_GAP_MS = 6000

async function fetchGdeltQueriesSequentially(
  queries: string[],
  fetchQuery: (query: string) => Promise<GdeltResponse>
): Promise<PromiseSettledResult<GdeltResponse>[]> {
  const results: PromiseSettledResult<GdeltResponse>[] = []
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await delay(GDELT_REQUEST_GAP_MS)
    try {
      const value = await fetchQuery(queries[i])
      results.push({ status: "fulfilled", value })
    } catch (reason) {
      results.push({ status: "rejected", reason })
    }
  }
  return results
}

// Next.js invokes this page's data-fetching more than once per build
// (observed directly in Vercel build logs: 2-3 separate calls at different
// timestamps, likely a "collecting page data" pass plus the actual static
// generation pass). Those invocations are separate render/request scopes,
// so neither Next's automatic fetch() dedup nor React's cache() persist
// across them — each one independently re-fires all 3 GDELT queries,
// multiplying request volume against GDELT's strict per-IP throttle within
// a single deploy. A module-level promise is the one thing that actually
// persists across them, so the network fetch happens once.
//
// The memo is TTL'd rather than permanent. v4.6's version never expired,
// which was correct for a build process that exits — but the pages are now
// ISR (revalidate = 1800), so a warm serverless instance would hold the
// resolved promise forever and never re-fetch, silently turning revalidate
// into a no-op. The TTL must stay comfortably shorter than the ISR interval:
// long enough to dedupe the several invocations inside one build or
// regeneration, short enough that the next regeneration really does refetch.
const DISRUPTIONS_TTL_MS = 5 * 60 * 1000

let disruptionsPromise: Promise<DisruptionEvent[]> | null = null
let disruptionsFetchedAt = 0

export function fetchDisruptions(): Promise<DisruptionEvent[]> {
  const now = Date.now()
  if (!disruptionsPromise || now - disruptionsFetchedAt >= DISRUPTIONS_TTL_MS) {
    disruptionsFetchedAt = now
    disruptionsPromise = fetchDisruptionsUncached().catch((err) => {
      // Never leave a rejected promise memoized — that would pin the failure
      // for the whole TTL instead of letting the next call retry.
      disruptionsPromise = null
      disruptionsFetchedAt = 0
      throw err
    })
  }
  return disruptionsPromise
}

async function fetchDisruptionsUncached(): Promise<DisruptionEvent[]> {
  // GDELT rejects any OR'd query that isn't wrapped in parentheses (returns
  // HTTP 200 with a plain-text error body instead of JSON) — verified live
  // against the exact strings below before adding the parens.
  const queries = [
    "supply chain disruption",
    "(port strike OR port closure OR freight delay)",
    "(tariff OR sanctions OR trade war)",
  ]

  const fetchQuery = async (query: string): Promise<GdeltResponse> => {
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=25&format=json&timespan=24H`
    const controller = new AbortController()
    // GDELT responds noticeably slower to requests from datacenter/cloud IP
    // ranges than the old 8s timeout allowed — verified live at 11-13s for a
    // single request, and Vercel's own build logs showed all 3 queries
    // (including the syntactically-simple, no-OR one) hitting AbortError at
    // exactly 8000ms with no response at all. 20s gives real headroom.
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "SCM-Disruption-Monitor/1.0" },
      })
      if (!res.ok) throw new Error(`GDELT responded with ${res.status}`)
      // A throttled-but-200 body is either non-JSON (plain text) or `{}` with
      // no articles key. res.json() throws on the former; the explicit shape
      // check catches the latter, which would otherwise read as a success.
      const json = (await res.json()) as GdeltResponse
      if (!Array.isArray(json.articles)) throw new GdeltSoftThrottleError()
      return json
    } finally {
      clearTimeout(timer)
    }
  }

  const [gdeltResults, disasterEvents, weatherEvents] = await Promise.all([
    fetchGdeltQueriesSequentially(queries, fetchQuery),
    fetchGlobalDisasters(),
    fetchWeatherAlerts(),
  ])

  const seenUrls = new Set<string>()
  const events: DisruptionEvent[] = []
  let anySuccess = false

  // Per-query outcome, for an honest summary line at the end.
  const queryOutcomes: ("live" | "cached" | "failed")[] = []

  gdeltResults.forEach((result, queryIndex) => {
    const fresh: DisruptionEvent[] = []

    if (result.status === "fulfilled") {
      result.value.articles?.forEach((article, i) => {
        const bestUrl = isUsableUrl(article.url ?? "") ? (article.url ?? "") : ""
        fresh.push({
          id: `gdelt-${queryIndex}-${i}-${Date.now()}`,
          title: article.title,
          url: bestUrl,
          date: parseGdeltDate(article.seendate),
          sourceDomain: article.domain,
          sourceCountry: article.sourcecountry,
          category: assignCategory(article.title, article.url),
          severity: scoreSeverity(article.title),
          region: mapCountryToRegion(article.sourcecountry),
        })
      })
    } else {
      // Not gated to development — this is the only visibility into GDELT
      // failures on Vercel, since dev-only logs never reach the build log.
      console.error(`[GDELT] Query ${queryIndex} ("${queries[queryIndex]}") failed:`, result.reason)
    }

    let queryEvents: DisruptionEvent[]
    if (fresh.length > 0) {
      // Genuine, non-empty success — the only case that may overwrite the cache.
      lastGoodByQuery.set(queryIndex, { events: fresh, fetchedAt: Date.now() })
      queryEvents = fresh
      queryOutcomes.push("live")
      anySuccess = true
    } else {
      // Threw, or returned zero usable articles. Either way, do NOT touch the
      // cache — fall back to whatever this query last returned successfully.
      // A 24H supply-chain query legitimately matching nothing is implausible,
      // so an empty result is treated the same as a failure here.
      const cached = lastGoodByQuery.get(queryIndex)
      queryEvents = cached?.events ?? []
      queryOutcomes.push(cached ? "cached" : "failed")
      if (cached) anySuccess = true
    }

    for (const event of queryEvents) {
      // Dedupe across queries, and across a mix of fresh and cached results.
      // Events with no usable URL fall back to the title as the dedupe key so
      // they don't all collapse into a single entry under the empty string.
      const key = event.url || `title:${event.title}`
      if (seenUrls.has(key)) continue
      seenUrls.add(key)
      events.push(event)
    }
  })

  // GDACS/NOAA IDs are already source-prefixed and stable (not per-fetch
  // random), so no seenUrls-style dedupe needed against them — but they
  // could theoretically overlap with a GDELT article about the same event,
  // which is an acceptable, rare duplicate rather than a bug to chase.
  if (disasterEvents.length > 0) anySuccess = true
  events.push(...disasterEvents)

  if (weatherEvents.length > 0) anySuccess = true
  events.push(...weatherEvents)

  if (!anySuccess) {
    return loadFallback()
  }

  events.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  // Reports live / cached / failed per query rather than a single "ok" count.
  // The old line counted soft-throttled (HTTP 200, `{}`) queries as successes,
  // which made GDELT look healthier than it was — check this line first if the
  // feed ever looks weather-heavy again.
  const tally = (state: string) => queryOutcomes.filter((o) => o === state).length
  const gdeltEventCount = events.length - disasterEvents.length - weatherEvents.length
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
    `, GDACS: ${disasterEvents.length}, NOAA: ${weatherEvents.length})`
  )

  return events
}
