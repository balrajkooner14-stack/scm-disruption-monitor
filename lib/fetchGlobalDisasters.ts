import { DisruptionEvent, DisruptionCategory, SeverityLevel, Region } from "./types"

// GDACS (Global Disaster Alert and Coordination System) — UN/EU-backed,
// free, no auth. Genuinely global, unlike GDELT (news-lag) or NOAA
// (US-only) — covers earthquakes, cyclones, floods, volcanoes, droughts,
// wildfires. Uses standard ISO2 country codes via `affectedcountries`,
// which is why this file has its own country→region mapper by NAME rather
// than reusing mapCountryToRegion() in fetchDisruptions.ts — that function
// expects GDELT's own FIPS-style codes (e.g. "CH" = China there), which
// collide with standard ISO2 in dangerous ways (ISO2 "CH" = Switzerland).
const GDACS_URL = "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH"

interface GdacsFeature {
  properties: {
    eventtype: string
    eventid: number
    episodeid: number
    name: string
    alertlevel: "Green" | "Orange" | "Red"
    country: string
    affectedcountries?: { iso2: string; iso3: string; countryname: string }[]
    fromdate: string
    url?: { report?: string }
  }
}

interface GdacsResponse {
  features?: GdacsFeature[]
}

const EVENT_TYPE_NAMES: Record<string, string> = {
  EQ: "Earthquake",
  TC: "Tropical Cyclone",
  FL: "Flood",
  VO: "Volcano",
  DR: "Drought",
  WF: "Wildfire",
}

// Cyclones/floods/wildfires map to the existing "Weather" category;
// earthquakes/volcanoes/droughts map to "General" — the closest existing
// fit, avoiding an extension of the closed DisruptionCategory union.
function gdacsCategoryFor(eventType: string): DisruptionCategory {
  if (eventType === "TC" || eventType === "FL" || eventType === "WF") return "Weather"
  return "General"
}

function alertLevelToSeverity(level: string): SeverityLevel {
  if (level === "Red") return 3
  if (level === "Orange") return 2
  return 1
}

const COUNTRY_NAME_TO_REGION: Record<string, Region> = {
  "United States of America": "North America", "United States": "North America",
  "USA": "North America", "Canada": "North America", "Mexico": "North America",
  "Guam": "Asia Pacific", "Northern Mariana Islands": "Asia Pacific",

  "United Kingdom": "Europe", "Germany": "Europe", "France": "Europe",
  "Italy": "Europe", "Spain": "Europe", "Netherlands": "Europe",
  "Poland": "Europe", "Sweden": "Europe", "Switzerland": "Europe",
  "Belgium": "Europe", "Greece": "Europe", "Portugal": "Europe",
  "Romania": "Europe", "Iceland": "Europe", "Norway": "Europe",

  China: "Asia Pacific", Japan: "Asia Pacific", "South Korea": "Asia Pacific",
  India: "Asia Pacific", Vietnam: "Asia Pacific", Thailand: "Asia Pacific",
  Indonesia: "Asia Pacific", Singapore: "Asia Pacific", Taiwan: "Asia Pacific",
  Bangladesh: "Asia Pacific", Philippines: "Asia Pacific", Malaysia: "Asia Pacific",
  Myanmar: "Asia Pacific", "New Zealand": "Asia Pacific", Australia: "Asia Pacific",
  "New Caledonia": "Asia Pacific", Nepal: "Asia Pacific", "Papua New Guinea": "Asia Pacific",
  Fiji: "Asia Pacific", Cambodia: "Asia Pacific", Laos: "Asia Pacific",

  "United Arab Emirates": "Middle East", "Saudi Arabia": "Middle East",
  Israel: "Middle East", Turkey: "Middle East", Iran: "Middle East",
  Iraq: "Middle East", Yemen: "Middle East", Jordan: "Middle East",

  Brazil: "Latin America", Argentina: "Latin America", Colombia: "Latin America",
  Chile: "Latin America", Peru: "Latin America", Ecuador: "Latin America",
  Guatemala: "Latin America", Haiti: "Latin America", "Dominican Republic": "Latin America",

  Nigeria: "Africa", "South Africa": "Africa", Kenya: "Africa",
  Morocco: "Africa", Egypt: "Africa", Madagascar: "Africa",
  Ethiopia: "Africa", Mozambique: "Africa", Somalia: "Africa",
}

function countryNameToRegion(name: string): Region {
  return COUNTRY_NAME_TO_REGION[name] ?? "Unknown"
}

export async function fetchGlobalDisasters(): Promise<DisruptionEvent[]> {
  const today = new Date()
  const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000)
  const fromDate = twoWeeksAgo.toISOString().slice(0, 10)
  const toDate = today.toISOString().slice(0, 10)

  const url = `${GDACS_URL}?fromDate=${fromDate}&toDate=${toDate}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "SCM-Disruption-Monitor/1.0" },
    })
    if (!res.ok) throw new Error(`GDACS responded with ${res.status}`)
    const json = (await res.json()) as GdacsResponse

    return (json.features ?? []).map((f) => {
      const p = f.properties
      const typeName = EVENT_TYPE_NAMES[p.eventtype] ?? p.eventtype
      const primaryCountry = p.affectedcountries?.[0]?.countryname ?? p.country ?? ""

      return {
        id: `gdacs-${p.eventtype}-${p.eventid}-${p.episodeid}`,
        title: `${typeName}: ${p.name}`,
        url: p.url?.report ?? "",
        date: p.fromdate,
        sourceDomain: "gdacs.org",
        sourceCountry: primaryCountry,
        category: gdacsCategoryFor(p.eventtype),
        severity: alertLevelToSeverity(p.alertlevel),
        region: countryNameToRegion(primaryCountry),
      }
    })
  } catch (error) {
    console.error("[GDACS] Fetch failed:", error)
    return []
  } finally {
    clearTimeout(timer)
  }
}
