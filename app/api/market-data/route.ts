import { NextResponse } from "next/server"

const COMMODITIES = [
  { id: "PNGASEUUSDM", name: "Natural Gas", unit: "$/mmbtu" },
  { id: "PCOPP",       name: "Copper",      unit: "$/mt"    },
  { id: "PWHEAMT",     name: "Wheat",        unit: "$/mt"    },
  { id: "POILAPSP",    name: "Crude Oil",    unit: "$/bbl"   },
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
}

export interface MarketData {
  commodities: CommodityResult[]
  freight: FreightRate[]
  lastUpdated: string
}

// 24-hour server-side cache
let cache: { data: MarketData; timestamp: number } | null = null
const CACHE_TTL = 24 * 60 * 60 * 1000

async function fetchCommodity(
  id: string,
  name: string,
  unit: string,
): Promise<CommodityResult> {
  const url = `https://api.worldbank.org/v2/en/indicator/${id}?format=json&mrv=13&frequency=M`
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`Failed to fetch ${id}`)
  const json = await res.json()

  const rows: Array<{ date: string; value: number | null }> = json[1] ?? []
  const data: DataPoint[] = rows
    .filter((r) => r.value !== null)
    .map((r) => ({ date: r.date, value: r.value as number }))
    .reverse() // oldest→newest for sparkline

  const change =
    data.length >= 2
      ? ((data[data.length - 1].value - data[data.length - 2].value) /
          data[data.length - 2].value) *
        100
      : 0

  return { id, name, unit, data, change }
}

// Static freight benchmarks — refreshed manually each phase
const FREIGHT_RATES: FreightRate[] = [
  {
    lane: "Asia-Pacific to US West Coast",
    rate: 2_350,
    unit: "$/40ft",
    change: -4.2,
    trend: "down",
  },
  {
    lane: "Asia-Pacific to Europe",
    rate: 3_100,
    unit: "$/40ft",
    change: 1.8,
    trend: "up",
  },
  {
    lane: "Europe to US",
    rate: 1_850,
    unit: "$/40ft",
    change: -1.1,
    trend: "down",
  },
  {
    lane: "Middle East to Europe",
    rate: 2_050,
    unit: "$/40ft",
    change: 6.3,
    trend: "up",
  },
]

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data)
  }

  try {
    const commodities = await Promise.all(
      COMMODITIES.map((c) => fetchCommodity(c.id, c.name, c.unit)),
    )
    const data: MarketData = {
      commodities,
      freight: FREIGHT_RATES,
      lastUpdated: new Date().toISOString(),
    }
    cache = { data, timestamp: now }
    return NextResponse.json(data)
  } catch {
    // Serve stale cache rather than erroring out
    if (cache) return NextResponse.json(cache.data)
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 502 },
    )
  }
}
