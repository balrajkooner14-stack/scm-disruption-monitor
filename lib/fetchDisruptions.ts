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
  const text = (title + " " + url).toLowerCase()

  if (
    text.includes("port") || text.includes("ship") || text.includes("vessel") ||
    text.includes("container") || text.includes("freight") || text.includes("cargo") ||
    text.includes("maritime") || text.includes("dock") || text.includes("harbor") ||
    text.includes("berth") || text.includes("terminal")
  ) return "Port"

  if (
    text.includes("strike") || text.includes("worker") || text.includes("union") ||
    text.includes("labor") || text.includes("labour") || text.includes("walkout") ||
    text.includes("employment") || text.includes("workforce")
  ) return "Labor"

  if (
    text.includes("tariff") || text.includes("duty") || text.includes("import tax") ||
    text.includes("trade war") || text.includes("customs") || text.includes("levy") ||
    text.includes("trade barrier") || text.includes("protectionism")
  ) return "Tariff"

  if (
    text.includes("sanction") || text.includes("geopolit") || text.includes("conflict") ||
    text.includes("war") || text.includes("blockade") || text.includes("embargo") ||
    text.includes("invasion") || text.includes("missile") || text.includes("military") ||
    text.includes("strait") || text.includes("canal")
  ) return "Geopolitical"

  if (
    text.includes("storm") || text.includes("flood") || text.includes("hurricane") ||
    text.includes("earthquake") || text.includes("typhoon") || text.includes("drought") ||
    text.includes("wildfire") || text.includes("climate") || text.includes("weather")
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
        category: assignCategory(article.title, article.url),
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
