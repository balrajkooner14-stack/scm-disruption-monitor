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
