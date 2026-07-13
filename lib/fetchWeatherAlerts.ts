import { DisruptionEvent, SeverityLevel } from "./types"

// NOAA/NWS — free, no auth. US-specific supplement to the global GDACS
// layer (fetchGlobalDisasters.ts): faster/more granular for domestic
// alerts (e.g. tornado warnings) than GDACS resolves to. NOT a global
// source — api.weather.gov only covers the US and its territories, so
// region always resolves to "North America" here.
const NOAA_ALERTS_URL = "https://api.weather.gov/alerts/active?severity=Severe,Extreme"

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

    return (json.features ?? []).map((f) => {
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
  } catch (error) {
    console.error("[NOAA] Fetch failed:", error)
    return []
  } finally {
    clearTimeout(timer)
  }
}
