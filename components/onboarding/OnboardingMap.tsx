"use client"

import { useMemo } from "react"
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import type { DisruptionEvent } from "@/lib/types"
import { COLOR } from "@/lib/brand"
import { COUNTRY_NAME_TO_REGION, GEO_URL } from "@/lib/mapGeo"
import { countryGeoName, findCountry } from "@/lib/countries"

// Read-only map for the sign-in panel and onboarding. Events carry a region,
// not coordinates, so regions are shaded by today's event count on the same
// ramp as the dashboard map. No dots: there is nothing real to place them on.
//   heat:      every region shaded by its event count.
//   suppliers: supplier countries in ink; other countries in a supplier
//              region shaded by that region's events; everything else plain.

type OnboardingMapProps =
  | { mode: "heat"; events: DisruptionEvent[] }
  | { mode: "suppliers"; events: DisruptionEvent[]; supplierCountries: string[] }

function heatFill(count: number): string {
  if (count <= 0) return COLOR.heat0
  if (count <= 2) return COLOR.heat1
  if (count <= 5) return COLOR.heat2
  return COLOR.heat3
}

export default function OnboardingMap(props: OnboardingMapProps) {
  const { events, mode } = props
  const supplierCountries = mode === "suppliers" ? props.supplierCountries : null

  const regionCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of events) counts[e.region] = (counts[e.region] ?? 0) + 1
    return counts
  }, [events])

  const supplierGeoNames = useMemo(
    () => new Set((supplierCountries ?? []).map(c => countryGeoName(c)).filter((n): n is string => !!n)),
    [supplierCountries],
  )
  const supplierRegions = useMemo(
    () => new Set((supplierCountries ?? []).map(c => findCountry(c)?.region).filter(Boolean) as string[]),
    [supplierCountries],
  )

  const label = useMemo(() => {
    if (mode === "suppliers") {
      const names = Array.from(new Set((supplierCountries ?? []).map(c => findCountry(c)?.name ?? c)))
      return names.length
        ? `World map highlighting your supplier countries: ${names.join(", ")}.`
        : "World map. No supplier countries added yet."
    }
    const parts = Object.entries(regionCounts)
      .filter(([region]) => region !== "Unknown")
      .sort((a, b) => b[1] - a[1])
      .map(([region, n]) => `${region} ${n}`)
    return parts.length
      ? `World map shaded by today's disruption events per region: ${parts.join(", ")}.`
      : "World map. No regional disruption events today."
  }, [mode, regionCounts, supplierCountries])

  const fillFor = (geoName: string): string => {
    const region = COUNTRY_NAME_TO_REGION[geoName]
    const count = region ? regionCounts[region] ?? 0 : 0
    if (mode === "heat") return heatFill(count)
    if (supplierGeoNames.has(geoName)) return COLOR.ink
    return region && supplierRegions.has(region) ? heatFill(count) : COLOR.heat0
  }

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
              .map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillFor(geo.properties.name)}
                  stroke={COLOR.paper}
                  strokeWidth={0.5}
                  tabIndex={-1}
                  style={{
                    default: { outline: "none", transition: "fill 150ms ease-out" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
          }
        </Geographies>
      </ComposableMap>
    </div>
  )
}
