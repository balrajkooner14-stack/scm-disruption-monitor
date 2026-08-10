import { DisruptionEvent, SeverityLevel } from "./types"

// NOAA/NWS — free, no auth. US-specific supplement to the global GDACS
// layer (fetchGlobalDisasters.ts): faster/more granular for domestic
// alerts (e.g. tornado warnings) than GDACS resolves to. NOT a global
// source — api.weather.gov only covers the US and its territories, so
// region always resolves to "North America" here.
const NOAA_ALERTS_URL = "https://api.weather.gov/alerts/active?severity=Severe,Extreme"

// NWS's own "Severe/Extreme" severity classification is far broader than
// "supply-chain disruptive" — a live check on 2026-08-10 found 34 active
// alerts under that filter, all Weather-category, dominated by Extreme
// Heat Warning (10), Severe Thunderstorm Warning (9), and Red Flag Warning
// (8, fire-weather conditions) — none of which meaningfully affect
// freight/logistics, yet all mapped to the same severity tier as a real
// port strike or tariff headline. This allowlist keeps only Warning-level
// event types (no Watches — those mean conditions are merely favorable,
// nothing confirmed) that actually disrupt supply chains.
const DISRUPTIVE_EVENT_TYPES = new Set([
  "Hurricane Warning",
  "Hurricane Force Wind Warning",
  "Typhoon Warning",
  "Tropical Storm Warning",
  "Storm Surge Warning",
  "Extreme Wind Warning",
  "Tornado Warning",
  "Flash Flood Warning",
  "Flood Warning",
  "Blizzard Warning",
  "Ice Storm Warning",
  "Winter Storm Warning",
  "Dust Storm Warning",
  "Tsunami Warning",
])

// Safety-net cap, mirroring GDELT's own maxrecords pattern — rarely needed
// once the allowlist is applied, but bounds a widespread event (e.g. a
// hurricane producing dozens of county-level warnings) from dominating the
// merged feed the way unfiltered NOAA data did before this fix.
const MAX_ALERTS = 15

interface NoaaAlertFeature {
  properties: {
    id: string
    areaDesc: string
    event: string
    severity: string // "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
    headline: string | null
    effective: string
  }
}

interface NoaaResponse {
  features?: NoaaAlertFeature[]
}

function noaaSeverityToLevel(severity: string): SeverityLevel {
  if (severity === "Extreme") return 3
  if (severity === "Severe") return 2
  return 1
}

export async function fetchWeatherAlerts(): Promise<DisruptionEvent[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(NOAA_ALERTS_URL, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SCM-Disruption-Monitor/1.0 (contact: scm-disruption-monitor)",
        Accept: "application/geo+json",
      },
    })
    if (!res.ok) throw new Error(`NOAA responded with ${res.status}`)
    const json = (await res.json()) as NoaaResponse

    const events = (json.features ?? [])
      .filter((f) => DISRUPTIVE_EVENT_TYPES.has(f.properties.event))
      .map((f) => {
        const p = f.properties
        return {
          id: `noaa-${p.id}`,
          title: p.headline || `${p.event} — ${p.areaDesc}`,
          url: "https://www.weather.gov/",
          date: p.effective,
          sourceDomain: "weather.gov",
          sourceCountry: "US",
          category: "Weather" as const,
          severity: noaaSeverityToLevel(p.severity),
          region: "North America" as const,
        }
      })

    events.sort((a, b) => {
      if (b.severity !== a.severity) return b.severity - a.severity
      return new Date(b.date).getTime() - new Date(a.date).getTime()
    })

    return events.slice(0, MAX_ALERTS)
  } catch (error) {
    console.error("[NOAA] Fetch failed:", error)
    return []
  } finally {
    clearTimeout(timer)
  }
}
