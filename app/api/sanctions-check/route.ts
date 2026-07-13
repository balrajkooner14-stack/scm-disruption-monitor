import { NextRequest, NextResponse } from "next/server"
import Papa from "papaparse"
import { screenSupplierNames, type SanctionsMatch } from "@/lib/sanctionsScreening"

// US Treasury OFAC Specially Designated Nationals (SDN) list — free, no
// auth. The classic treasury.gov URL 302-redirects to the current
// Sanctions List Service export, which itself redirects to a presigned
// S3 URL; fetch() follows both automatically.
const SDN_CSV_URL = "https://www.treasury.gov/ofac/downloads/sdn.csv"

const CACHE_VERSION = "v1"
const CACHE_TTL = 24 * 60 * 60 * 1000

let cache: { entityNames: string[]; timestamp: number; version: string } | null = null

async function fetchSdnEntityNames(): Promise<string[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  const res = await fetch(SDN_CSV_URL, {
    signal: controller.signal,
    headers: { "User-Agent": "Mozilla/5.0" },
  }).finally(() => clearTimeout(timeout))

  if (!res.ok) throw new Error(`OFAC SDN list returned ${res.status}`)
  const csvText = await res.text()

  const parsed = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: true })

  // Columns (no header row): ent_num, SDN_Name, SDN_Type, Program, ...
  // SDN_Type is "individual" for people, blank/"-0-" for companies/vessels/
  // entities — only entity-type rows are relevant to matching supplier
  // company names.
  const entityNames = parsed.data
    .filter(row => row.length > 2 && row[2]?.trim().toLowerCase() !== "individual")
    .map(row => row[1]?.trim())
    .filter((name): name is string => !!name && name !== "-0-")

  return entityNames
}

export async function POST(req: NextRequest) {
  try {
    const { suppliers } = await req.json() as {
      suppliers: { id: string; name: string }[]
    }

    if (!Array.isArray(suppliers) || suppliers.length === 0) {
      return NextResponse.json({ matches: [] as SanctionsMatch[] })
    }

    const now = Date.now()
    if (!cache || cache.version !== CACHE_VERSION || now - cache.timestamp >= CACHE_TTL) {
      const entityNames = await fetchSdnEntityNames()
      cache = { entityNames, timestamp: now, version: CACHE_VERSION }
    }

    const matches = screenSupplierNames(suppliers, cache.entityNames)

    return NextResponse.json({
      matches,
      listSize: cache.entityNames.length,
      checkedAt: new Date(cache.timestamp).toISOString(),
    })
  } catch (error) {
    console.error("Sanctions check error:", error)
    return NextResponse.json(
      { error: "Failed to check sanctions list", matches: [] as SanctionsMatch[] },
      { status: 502 }
    )
  }
}
