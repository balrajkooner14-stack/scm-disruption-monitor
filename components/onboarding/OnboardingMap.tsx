"use client"

import { useMemo } from "react"
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import type { DisruptionEvent } from "@/lib/types"
import { COLOR } from "@/lib/brand"
import { COUNTRY_NAME_TO_REGION, GEO_URL } from "@/lib/mapGeo"

// Read-only map for the sign-in panel and onboarding. Events carry a region,
// not coordinates, so "heat" shades each region by today's event count on the
// same ramp as the dashboard map. No dots: there is nothing real to place them on.

interface OnboardingMapProps {
  events: DisruptionEvent[]
  mode: "heat"
}

function heatFill(count: number): string {
  if (count <= 0) return COLOR.heat0
  if (count <= 2) return COLOR.heat1
  if (count <= 5) return COLOR.heat2
  return COLOR.heat3
}

export default function OnboardingMap({ events }: OnboardingMapProps) {
  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) counts[e.region] = (counts[e.region] ?? 0) + 1
    return counts
  }, [events])

  const label = useMemo(() => {
    const parts = Object.entries(regionCounts)
      .filter(([region]) => region !== "Unknown")
      .sort((a, b) => b[1] - a[1])
      .map(([region, n]) => `${region} ${n}`)
    return parts.length
      ? `World map shaded by today's disruption events per region: ${parts.join(", ")}.`
      : "World map. No regional disruption events today."
  }, [regionCounts])

  return (
    <div role="img" aria-label={label}>
      <ComposableMap
        width={800}
        height={410}
        projectionConfig={{ scale: 150, center: [10, 18] }}
        style={{ width: "100%", height: "auto", display: "block" }}
        aria-hidden="true"
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies
              .filter(geo => geo.properties.name !== "Antarctica")
              .map(geo => {
                const region = COUNTRY_NAME_TO_REGION[geo.properties.name]
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={heatFill(region ? regionCounts[region] ?? 0 : 0)}
                    stroke={COLOR.paper}
                    strokeWidth={0.5}
                    tabIndex={-1}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none" },
                      pressed: { outline: "none" },
                    }}
                  />
                )
              })
          }
        </Geographies>
      </ComposableMap>
    </div>
  )
}
