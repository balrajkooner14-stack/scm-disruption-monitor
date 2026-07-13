import { NextRequest, NextResponse } from "next/server"

// USITC Harmonized Tariff Schedule REST API — free, no auth, confirmed
// live this session against a real HS code (8542.31.00 → general "Free",
// other "35%").
const HTS_SEARCH_URL = "https://hts.usitc.gov/reststop/search"

export interface TariffRateResult {
  htsNumber: string
  description: string
  generalRate: string | null   // MFN/normal trade relations rate
  specialRate: string | null   // preferential program rates (USMCA, GSP, etc.)
  otherRate: string | null     // column 2 — non-normal-trade-relations countries
}

interface HtsEntry {
  htsno: string
  description: string
  general: string | null
  special: string | null
  other: string | null
}

const CACHE_TTL = 24 * 60 * 60 * 1000
const cache = new Map<string, { data: TariffRateResult[]; timestamp: number }>()

export async function GET(req: NextRequest) {
  const hsCode = req.nextUrl.searchParams.get("hsCode")?.trim()

  if (!hsCode) {
    return NextResponse.json({ error: "hsCode query param required" }, { status: 400 })
  }

  const cached = cache.get(hsCode)
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ results: cached.data })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)

  try {
    const url = `${HTS_SEARCH_URL}?keyword=${encodeURIComponent(hsCode)}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    }).finally(() => clearTimeout(timeout))

    if (!res.ok) throw new Error(`USITC HTS API returned ${res.status}`)
    const entries = (await res.json()) as HtsEntry[]

    // Only rows with an actual duty rate (leaf entries) — the API also
    // returns parent/heading rows (e.g. "8542") with no rate of their own.
    const results: TariffRateResult[] = entries
      .filter(e => e.general !== null && e.general !== "")
      .slice(0, 10)
      .map(e => ({
        htsNumber: e.htsno,
        description: e.description,
        generalRate: e.general,
        specialRate: e.special || null,
        otherRate: e.other,
      }))

    cache.set(hsCode, { data: results, timestamp: now })
    return NextResponse.json({ results })
  } catch (error) {
    console.error("Tariff lookup error:", error)
    if (cached) return NextResponse.json({ results: cached.data, stale: true })
    return NextResponse.json(
      { error: "Failed to look up tariff data", results: [] as TariffRateResult[] },
      { status: 502 }
    )
  }
}
