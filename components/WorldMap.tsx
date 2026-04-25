"use client"

import { useState, useMemo } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps"
import { Region } from "@/lib/types"
import { ScoredEvent } from "@/lib/scoreEvents"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const COUNTRY_NAME_TO_REGION: Record<string, Region> = {
  // North America
  "United States of America": "North America",
  "Canada": "North America",
  "Mexico": "North America",
  "Cuba": "North America",
  "Guatemala": "North America",
  "Honduras": "North America",
  "El Salvador": "North America",
  "Nicaragua": "North America",
  "Costa Rica": "North America",
  "Panama": "North America",
  "Jamaica": "North America",
  "Haiti": "North America",
  "Dominican Republic": "North America",
  // Europe
  "United Kingdom": "Europe",
  "France": "Europe",
  "Germany": "Europe",
  "Italy": "Europe",
  "Spain": "Europe",
  "Netherlands": "Europe",
  "Sweden": "Europe",
  "Norway": "Europe",
  "Poland": "Europe",
  "Belgium": "Europe",
  "Austria": "Europe",
  "Switzerland": "Europe",
  "Portugal": "Europe",
  "Greece": "Europe",
  "Hungary": "Europe",
  "Czech Republic": "Europe",
  "Romania": "Europe",
  "Bulgaria": "Europe",
  "Croatia": "Europe",
  "Serbia": "Europe",
  "Finland": "Europe",
  "Denmark": "Europe",
  "Ireland": "Europe",
  "Slovakia": "Europe",
  "Slovenia": "Europe",
  "Russia": "Europe",
  "Ukraine": "Europe",
  "Belarus": "Europe",
  "Latvia": "Europe",
  "Lithuania": "Europe",
  "Estonia": "Europe",
  // Asia Pacific
  "China": "Asia Pacific",
  "Japan": "Asia Pacific",
  "South Korea": "Asia Pacific",
  "India": "Asia Pacific",
  "Singapore": "Asia Pacific",
  "Australia": "Asia Pacific",
  "Thailand": "Asia Pacific",
  "Vietnam": "Asia Pacific",
  "Indonesia": "Asia Pacific",
  "Malaysia": "Asia Pacific",
  "Philippines": "Asia Pacific",
  "Taiwan": "Asia Pacific",
  "New Zealand": "Asia Pacific",
  "Bangladesh": "Asia Pacific",
  "Pakistan": "Asia Pacific",
  "Myanmar": "Asia Pacific",
  "Cambodia": "Asia Pacific",
  "Mongolia": "Asia Pacific",
  "Kazakhstan": "Asia Pacific",
  "Sri Lanka": "Asia Pacific",
  "Nepal": "Asia Pacific",
  "Afghanistan": "Asia Pacific",
  // Middle East
  "Saudi Arabia": "Middle East",
  "United Arab Emirates": "Middle East",
  "Iran": "Middle East",
  "Iraq": "Middle East",
  "Israel": "Middle East",
  "Turkey": "Middle East",
  "Egypt": "Middle East",
  "Qatar": "Middle East",
  "Kuwait": "Middle East",
  "Bahrain": "Middle East",
  "Oman": "Middle East",
  "Yemen": "Middle East",
  "Jordan": "Middle East",
  "Lebanon": "Middle East",
  "Syria": "Middle East",
  "Cyprus": "Middle East",
  // Latin America
  "Brazil": "Latin America",
  "Argentina": "Latin America",
  "Chile": "Latin America",
  "Colombia": "Latin America",
  "Peru": "Latin America",
  "Venezuela": "Latin America",
  "Ecuador": "Latin America",
  "Bolivia": "Latin America",
  "Paraguay": "Latin America",
  "Uruguay": "Latin America",
  "Guyana": "Latin America",
  "Suriname": "Latin America",
  // Africa
  "Nigeria": "Africa",
  "South Africa": "Africa",
  "Kenya": "Africa",
  "Ghana": "Africa",
  "Ethiopia": "Africa",
  "Tanzania": "Africa",
  "Uganda": "Africa",
  "Zimbabwe": "Africa",
  "Morocco": "Africa",
  "Algeria": "Africa",
  "Tunisia": "Africa",
  "Libya": "Africa",
  "Angola": "Africa",
  "Mozambique": "Africa",
  "Somalia": "Africa",
  "Sudan": "Africa",
  "Cameroon": "Africa",
  "Senegal": "Africa",
  "Mali": "Africa",
  "Zambia": "Africa",
}

function countByRegion(events: { region: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.region] = (counts[e.region] ?? 0) + 1
  }
  return counts
}

function getCountryColor(
  geoName: string,
  regionCounts: Record<string, number>,
  selectedRegion: string | null,
  supplierCountries: Set<string>,
  supplierRegions: Set<string>
): string {
  const region = COUNTRY_NAME_TO_REGION[geoName]

  // Priority 1: selected (clicked) — highest priority
  if (selectedRegion && region === selectedRegion) return "#2563eb"

  // Priority 2: supplier country — amber
  if (supplierCountries.has(geoName)) return "#d97706"

  const count = region ? (regionCounts[region] || 0) : 0
  const hasProfile = supplierRegions.size > 0 || supplierCountries.size > 0

  if (count > 0) {
    // Priority 3: supplier region with events — normal heat colors
    if (!hasProfile || (region && supplierRegions.has(region))) {
      if (count <= 2) return "#854d0e"
      if (count <= 5) return "#c2410c"
      return "#991b1b"
    }
    // Priority 4: has events but NOT in supplier regions — muted
    if (count <= 2) return "#1e3a2f"
    if (count <= 5) return "#2d3a1a"
    return "#3a1a1a"
  }

  // Priority 5: no events, not supplier
  return "#1e293b"
}

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

  function handleCountryClick(geoName: string) {
    const region = COUNTRY_NAME_TO_REGION[geoName]
    if (!region) return
    onRegionSelect(selectedRegion === region ? null : region)
  }

  const hoveredRegion = hoveredCountry ? COUNTRY_NAME_TO_REGION[hoveredCountry] : null
  const hoveredCount = hoveredRegion ? (regionCounts[hoveredRegion] || 0) : 0

  const hoverText = (() => {
    if (!hoveredCountry) return "Hover or click a country to filter the feed"

    if (supplierCountries.has(hoveredCountry) && profile) {
      const suppliersHere = profile.suppliers.filter(s => s.country === hoveredCountry)
      const supplierDetail = suppliersHere.length > 0
        ? `${suppliersHere[0].name} supplies ${suppliersHere[0].sharePercent}% of your ${suppliersHere[0].category}`
        : ""
      return `📍 ${hoveredCountry} — YOUR SUPPLIER — ${hoveredCount} active event${hoveredCount !== 1 ? "s" : ""}${supplierDetail ? ` · ${supplierDetail}` : ""}`
    }

    if (!hoveredRegion) return hoveredCountry
    return `${hoveredCountry} · ${hoveredRegion} · ${hoveredCount} event${hoveredCount !== 1 ? "s" : ""}`
  })()

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
        Risk by Region
      </h2>

      <p className="text-xs text-slate-500 h-5 mb-2 truncate">
        {selectedRegion
          ? `📍 Filtering feed by: ${selectedRegion} — click again to clear`
          : hoverText}
      </p>

      <ComposableMap projectionConfig={{ scale: 140 }}>
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryColor(
                    geo.properties.name,
                    regionCounts,
                    selectedRegion,
                    supplierCountries,
                    supplierRegions
                  )}
                  stroke="#334155"
                  strokeWidth={0.5}
                  onMouseEnter={() => setHoveredCountry(geo.properties.name)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  onClick={() => handleCountryClick(geo.properties.name)}
                  style={{
                    default: { outline: "none", cursor: "pointer", transition: "fill 0.2s ease" },
                    hover: { outline: "none", opacity: 0.75, cursor: "pointer" },
                    pressed: { outline: "none" },
                  }}
                />
              ))
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>

      <div className="flex flex-wrap gap-3 mt-3">
        {[
          { color: "#1e293b", label: "No events" },
          { color: "#854d0e", label: "1–2 events" },
          { color: "#c2410c", label: "3–5 events" },
          { color: "#991b1b", label: "6+ events" },
          { color: "#d97706", label: "Your supplier countries" },
          { color: "#2563eb", label: "Selected" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm border border-slate-600" style={{ backgroundColor: color }} />
            <span className="text-xs text-slate-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
