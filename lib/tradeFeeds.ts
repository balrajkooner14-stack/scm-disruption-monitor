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

// Leading boundary only, matching lib/fetchDisruptions.ts. A trailing boundary
// would stop "tariffs", "delays", "closures", "shipments" and "containers"
// from matching their singular keywords, which would starve the admission
// filter. Note the region hints below deliberately use FULL boundaries
// instead: place names do not inflect, and "us" is far too short to be safe
// with a leading-only boundary.
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`\\b${escaped}`, "i").test(haystack)
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
