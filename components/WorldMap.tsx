"use client"

import { useState, useMemo } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps"
import { ScoredEvent } from "@/lib/scoreEvents"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { COLOR } from "@/lib/brand"
import { ui } from "@/lib/ui"
import { COUNTRY_NAME_TO_REGION, GEO_URL } from "@/lib/mapGeo"

function countByRegion(events: { region: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.region] = (counts[e.region] ?? 0) + 1
  }
  return counts
}

// Dim ramp: regions with events that are not your supplier regions.
const DIM_RAMP = ["#EFE4D6", "#E9D6C2", "#DFC1A8"] as const
const TIER2_FILL = "url(#tier2Hatch)"

function getCountryColor(
  geoName: string,
  regionCounts: Record<string, number>,
  supplierCountries: Set<string>,
  supplierRegions: Set<string>,
  tier2Countries: Set<string>
): string {
  const region = COUNTRY_NAME_TO_REGION[geoName]

  // Selection is no longer a fill — see the opacity rule on <Geography>.

  // Priority 2: supplier country — ink, distinct from the heat ramp
  if (supplierCountries.has(geoName)) return COLOR.ink

  // Priority 2.5: tier-2 (your supplier's supplier) country — diagonal
  // hatch. Only applies if not already a tier-1 country (checked above).
  if (tier2Countries.has(geoName)) return TIER2_FILL

  const count = region ? (regionCounts[region] || 0) : 0
  const hasProfile = supplierRegions.size > 0 || supplierCountries.size > 0

  if (count > 0) {
    // Priority 3: supplier region with events — normal heat colors
    if (!hasProfile || (region && supplierRegions.has(region))) {
      if (count <= 2) return COLOR.heat1
      if (count <= 5) return COLOR.heat2
      return COLOR.heat3
    }
    // Priority 4: has events but NOT in supplier regions — muted
    if (count <= 2) return DIM_RAMP[0]
    if (count <= 5) return DIM_RAMP[1]
    return DIM_RAMP[2]
  }

  // Priority 5: no events, not supplier
  return COLOR.heat0
}

function HatchPattern({ id }: { id: string }) {
  return (
    <pattern id={id} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="4" fill={COLOR.heat0} />
      <line x1="0" y1="0" x2="0" y2="4" stroke={COLOR.ink} strokeWidth="1.5" />
    </pattern>
  )
}

const LEGEND: { label: string; color?: string; hatch?: boolean }[] = [
  { color: COLOR.heat0, label: "No events" },
  { color: COLOR.heat1, label: "1–2" },
  { color: COLOR.heat2, label: "3–5" },
  { color: COLOR.heat3, label: "6+" },
  { color: COLOR.ink, label: "Your suppliers" },
  { hatch: true, label: "Suppliers' suppliers" },
]

interface WorldMapProps {
  events: ScoredEvent[]
  selectedRegion: string | null
  onRegionSelect: (region: string | null) => void
}

export default function WorldMap({ events, selectedRegion, onRegionSelect }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const { profile } = useCompanyProfile()

  const regionCounts = countByRegion(events)

  const supplierCountries = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(profile.suppliers.map(s => s.country))
  }, [profile])

  const supplierRegions = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(profile.suppliers.map(s => s.region))
  }, [profile])

  const tier2Countries = useMemo(() => {
    if (!profile) return new Set<string>()
    return new Set(
      profile.suppliers.flatMap(s => (s.tier2Suppliers ?? []).map(t2 => t2.country))
    )
  }, [profile])

  // Maps a tier-2 country name to the tier-1 supplier(s) that source from
  // it, for the "indirect exposure via X" hover callout.
  const tier2ToTier1Names = useMemo(() => {
    const map: Record<string, string[]> = {}
    if (!profile) return map
    for (const supplier of profile.suppliers) {
      for (const t2 of supplier.tier2Suppliers ?? []) {
        if (!t2.country) continue
        if (!map[t2.country]) map[t2.country] = []
        map[t2.country].push(supplier.name)
      }
    }
    return map
  }, [profile])

  function handleCountryClick(geoName: string) {
    const region = COUNTRY_NAME_TO_REGION[geoName]
    if (!region) return
    onRegionSelect(selectedRegion === region ? null : region)
  }

  const hoveredRegion = hoveredCountry ? COUNTRY_NAME_TO_REGION[hoveredCountry] : null
  const hoveredCount = hoveredRegion ? (regionCounts[hoveredRegion] || 0) : 0

  const hoverText = (() => {
    if (!hoveredCountry) return "Hover a country for detail"

    if (supplierCountries.has(hoveredCountry) && profile) {
      const suppliersHere = profile.suppliers.filter(s => s.country === hoveredCountry)
      const supplierDetail = suppliersHere.length > 0
        ? `${suppliersHere[0].name} supplies ${suppliersHere[0].sharePercent}% of your ${suppliersHere[0].category}`
        : ""
      return `${hoveredCountry} · your supplier · ${hoveredCount} active event${hoveredCount !== 1 ? "s" : ""}${supplierDetail ? ` · ${supplierDetail}` : ""}`
    }

    if (tier2ToTier1Names[hoveredCountry]?.length) {
      const viaNames = tier2ToTier1Names[hoveredCountry].join(", ")
      return `${hoveredCountry} · indirect exposure via ${viaNames} · ${hoveredCount} active event${hoveredCount !== 1 ? "s" : ""}`
    }

    if (!hoveredRegion) return hoveredCountry
    return `${hoveredCountry} · ${hoveredRegion} · ${hoveredCount} event${hoveredCount !== 1 ? "s" : ""}`
  })()

  return (
    <section className={`${ui.card} flex flex-col gap-3.5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className={ui.h2}>Risk by region</h2>
        <p className={ui.meta}>Click a country to filter the feed</p>
      </div>

      <p className={`${ui.meta} h-5 truncate`}>
        {selectedRegion
          ? `Filtering feed by ${selectedRegion} · click again to clear`
          : hoverText}
      </p>

      <ComposableMap projectionConfig={{ scale: 140 }}>
        <defs>
          <HatchPattern id="tier2Hatch" />
        </defs>
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                const region = COUNTRY_NAME_TO_REGION[geo.properties.name]
                // Selected region keeps full opacity; everything else recedes.
                const opacity = selectedRegion && region !== selectedRegion ? 0.4 : 1
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getCountryColor(
                      geo.properties.name,
                      regionCounts,
                      supplierCountries,
                      supplierRegions,
                      tier2Countries
                    )}
                    stroke={COLOR.paper}
                    strokeWidth={0.5}
                    onMouseEnter={() => setHoveredCountry(geo.properties.name)}
                    onMouseLeave={() => setHoveredCountry(null)}
                    onClick={() => handleCountryClick(geo.properties.name)}
                    style={{
                      default: { outline: "none", cursor: "pointer", opacity, transition: "opacity 0.2s ease" },
                      hover: { outline: "none", cursor: "pointer", opacity, stroke: COLOR.ink, strokeWidth: 1 },
                      pressed: { outline: "none", opacity },
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="flex flex-wrap gap-4 text-xs text-ink-2">
        {LEGEND.map(({ color, hatch, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            {hatch ? (
              <svg width="12" height="12" className="rounded-[3px]" aria-hidden="true">
                <defs>
                  <HatchPattern id="tier2HatchLegend" />
                </defs>
                <rect width="12" height="12" fill="url(#tier2HatchLegend)" />
              </svg>
            ) : (
              <span className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: color }} aria-hidden="true" />
            )}
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}
