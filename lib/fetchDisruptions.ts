import fs from "fs"
import path from "path"
import { DisruptionEvent, DisruptionCategory, SeverityLevel, Region } from "./types"

export function scoreSeverity(title: string): SeverityLevel {
  const t = title.toLowerCase()
  const critical = ["strike", "closure", "sanctions", "blocked", "halt", "shutdown", "ban"]
  const warning = ["delay", "shortage", "disruption", "tariff", "congestion", "reduced"]
  if (critical.some((kw) => t.includes(kw))) return 3
  if (warning.some((kw) => t.includes(kw))) return 2
  return 1
}

export function mapCountryToRegion(countryCode: string): Region {
  const code = (countryCode ?? "").toUpperCase()
  const regions: Record<string, Region> = {
    US: "North America", CA: "North America", MX: "North America",
    GB: "Europe", FR: "Europe", DE: "Europe", IT: "Europe", ES: "Europe",
    NL: "Europe", SE: "Europe", NO: "Europe", PL: "Europe", BE: "Europe",
    CH: "Europe", AT: "Europe",
    CN: "Asia Pacific", JP: "Asia Pacific", KR: "Asia Pacific", IN: "Asia Pacific",
    SG: "Asia Pacific", AU: "Asia Pacific", TH: "Asia Pacific", VN: "Asia Pacific",
    ID: "Asia Pacific", MY: "Asia Pacific", PH: "Asia Pacific", TW: "Asia Pacific",
    SA: "Middle East", AE: "Middle East", IR: "Middle East", IQ: "Middle East",
    IL: "Middle East", TR: "Middle East", EG: "Middle East", QA: "Middle East",
    KW: "Middle East",
    BR: "Latin America", AR: "Latin America", CL: "Latin America",
    CO: "Latin America", PE: "Latin America", VE: "Latin America",
    NG: "Africa", ZA: "Africa", KE: "Africa", GH: "Africa", ET: "Africa", TZ: "Africa",
  }
  return regions[code] ?? "Unknown"
}

export function assignCategory(queryIndex: number, title: string): DisruptionCategory {
  const t = title.toLowerCase()
  if (queryIndex === 0) return "General"
  if (queryIndex === 1) {
    return t.includes("strike") || t.includes("labor") ? "Labor" : "Port"
  }
  // queryIndex === 2
  return t.includes("sanction") || t.includes("geopolit") ? "Geopolitical" : "Tariff"
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

export async function fetchDisruptions(): Promise<DisruptionEvent[]> {
  const queries = [
    "supply chain disruption",
    "port strike OR port closure OR freight delay",
    "tariff OR sanctions OR trade war",
  ]

  const fetchQuery = async (query: string): Promise<GdeltResponse> => {
    const url =
      `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&maxrecords=25&format=json&timespan=24H`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "SCM-Disruption-Monitor/1.0" },
      })
      if (!res.ok) throw new Error(`GDELT responded with ${res.status}`)
      return (await res.json()) as GdeltResponse
    } finally {
      clearTimeout(timer)
    }
  }

  const results = await Promise.allSettled(queries.map((q) => fetchQuery(q)))

  const seenUrls = new Set<string>()
  const events: DisruptionEvent[] = []
  let anySuccess = false

  results.forEach((result, queryIndex) => {
    if (result.status !== "fulfilled") return
    anySuccess = true
    const articles = result.value.articles ?? []
    articles.forEach((article, i) => {
      if (seenUrls.has(article.url)) return
      seenUrls.add(article.url)
      events.push({
        id: `gdelt-${queryIndex}-${i}-${Date.now()}`,
        title: article.title,
        url: article.url,
        date: parseGdeltDate(article.seendate),
        sourceDomain: article.domain,
        sourceCountry: article.sourcecountry,
        category: assignCategory(queryIndex, article.title),
        severity: scoreSeverity(article.title),
        region: mapCountryToRegion(article.sourcecountry),
      })
    })
  })

  if (!anySuccess) {
    return loadFallback()
  }

  events.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  if (process.env.NODE_ENV === "development") {
    console.log(`[GDELT] Fetched ${events.length} events`)
  }

  return events
}
