import { NextResponse } from "next/server"

const CACHE_VERSION = "v4"

// Yahoo Finance futures symbols — no API key required
// scale converts Yahoo's native unit to the display unit
const COMMODITIES = [
  { id: "CL=F", name: "Crude Oil",   unit: "$/bbl",   scale: 1        }, // USD/bbl
  { id: "NG=F", name: "Natural Gas", unit: "$/mmbtu", scale: 1        }, // USD/mmbtu
  { id: "HG=F", name: "Copper",      unit: "$/mt",    scale: 2204.62  }, // USD/lb → USD/mt
  { id: "ZW=F", name: "Wheat",       unit: "$/mt",    scale: 0.367437 }, // USc/bu → USD/mt (÷100 × 36.74 bu/mt)
]

// Yahoo Finance FX tickers ("{CODE}=X") — units of foreign currency per $1.
// Curated to the most common sourcing-country currencies rather than every
// possible country, to keep the request count reasonable against Yahoo's
// unauthenticated endpoint.
const CURRENCIES = [
  { id: "CNY=X", name: "Chinese Yuan",   unit: "¥/$1" },
  { id: "VND=X", name: "Vietnamese Dong", unit: "₫/$1" },
  { id: "KRW=X", name: "South Korean Won", unit: "₩/$1" },
  { id: "TWD=X", name: "Taiwan Dollar",  unit: "NT$/$1" },
  { id: "INR=X", name: "Indian Rupee",   unit: "₹/$1" },
  { id: "MXN=X", name: "Mexican Peso",   unit: "MX$/$1" },
  { id: "EUR=X", name: "Euro",           unit: "€/$1" },
  { id: "GBP=X", name: "British Pound",  unit: "£/$1" },
]

export interface DataPoint { date: string; value: number }

export interface CommodityResult {
  id: string
  name: string
  unit: string
  data: DataPoint[]
  change: number // % vs previous data point
}

export interface FreightRate {
  lane: string
  rate: number
  unit: string
  change: number
  trend: "up" | "down" | "flat"
  // Date a human last checked/updated this reference number — NOT a live
  // feed. Distinct from MarketData.lastUpdated (today's fetch timestamp),
  // which would misleadingly imply these numbers refresh daily.
  lastVerified: string
}

// No free live ocean freight index exists (Freightos Baltic Index requires
// a paid account for real API access, confirmed via research) — these are
// manually verified reference points, not live data. FREIGHT_LAST_VERIFIED
// must be updated by hand whenever the numbers below are actually re-checked.
const FREIGHT_LAST_VERIFIED = "2026-05-01"

export interface MarketData {
  commodities: CommodityResult[]
  currencies: CommodityResult[]
  freight: FreightRate[]
  lastUpdated: string
}

// 24-hour server-side cache
let cache: { data: MarketData; timestamp: number; version: string } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000

async function fetchCommodity(
  id: string,
  name: string,
  unit: string,
  scale: number,
): Promise<CommodityResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id)}?interval=1mo&range=13mo`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)

  const res = await fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 86400 },
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status} for ${id}`)
  const json = await res.json()

  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`No chart result for ${id}`)

  const timestamps: number[] = result.timestamp ?? []
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? []

  // Deduplicate by date (current month appears twice: last close + live tick)
  const seen = new Map<string, number>()
  for (let i = 0; i < timestamps.length; i++) {
    const raw = closes[i]
    if (raw === null || raw <= 0) continue
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 7)
    seen.set(date, raw) // later value overwrites — keeps the freshest
  }

  const data: DataPoint[] = Array.from(seen.entries())
    .map(([date, raw]) => ({ date, value: Math.round(raw * scale * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date))

  if (data.length < 2) throw new Error(`Insufficient data for ${id}`)

  const change =
    ((data[data.length - 1].value - data[data.length - 2].value) /
      data[data.length - 2].value) *
    100

  return { id, name, unit, data, change }
}

// Static freight benchmarks — manually verified reference points, not a
// live feed (see FREIGHT_LAST_VERIFIED above for why).
const FREIGHT_RATES: FreightRate[] = [
  {
    lane: "Asia-Pacific to US West Coast",
    rate: 2_350,
    unit: "$/40ft",
    change: -4.2,
    trend: "down",
    lastVerified: FREIGHT_LAST_VERIFIED,
  },
  {
    lane: "Asia-Pacific to Europe",
    rate: 3_100,
    unit: "$/40ft",
    change: 1.8,
    trend: "up",
    lastVerified: FREIGHT_LAST_VERIFIED,
  },
  {
    lane: "Europe to US",
    rate: 1_850,
    unit: "$/40ft",
    change: -1.1,
    trend: "down",
    lastVerified: FREIGHT_LAST_VERIFIED,
  },
  {
    lane: "Middle East to Europe",
    rate: 2_050,
    unit: "$/40ft",
    change: 6.3,
    trend: "up",
    lastVerified: FREIGHT_LAST_VERIFIED,
  },
]

export async function GET() {
  const now = Date.now()
  if (
    cache &&
    cache.version === CACHE_VERSION &&
    now - cache.timestamp < CACHE_TTL
  ) {
    return NextResponse.json(cache.data)
  }

  const [commodityResults, currencyResults] = await Promise.all([
    Promise.allSettled(
      COMMODITIES.map((c) => fetchCommodity(c.id, c.name, c.unit, c.scale)),
    ),
    Promise.allSettled(
      CURRENCIES.map((c) => fetchCommodity(c.id, c.name, c.unit, 1)),
    ),
  ])

  const commodities: CommodityResult[] = commodityResults
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value
      console.error(`Failed to fetch commodity ${COMMODITIES[i].id}:`, r.reason)
      return null
    })
    .filter((c): c is CommodityResult => c !== null)

  const currencies: CommodityResult[] = currencyResults
    .map((r, i) => {
      if (r.status === "fulfilled") return r.value
      console.error(`Failed to fetch currency ${CURRENCIES[i].id}:`, r.reason)
      return null
    })
    .filter((c): c is CommodityResult => c !== null)

  if (commodities.length === 0) {
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 502 },
    )
  }

  const data: MarketData = {
    commodities,
    currencies,
    freight: FREIGHT_RATES,
    lastUpdated: new Date().toISOString(),
  }
  cache = { data, timestamp: now, version: CACHE_VERSION }
  return NextResponse.json(data)
}
