"use client"

import { useState } from "react"
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps"
import { DisruptionEvent, Region } from "@/lib/types"

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

const MAP_COUNTRY_TO_REGION: Record<string, Region> = {
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
  "Switzerland": "Europe",
  "Austria": "Europe",
  "United States of America": "North America",
  "Canada": "North America",
  "Mexico": "North America",
  "Saudi Arabia": "Middle East",
  "United Arab Emirates": "Middle East",
  "Iran": "Middle East",
  "Iraq": "Middle East",
  "Israel": "Middle East",
  "Turkey": "Middle East",
  "Egypt": "Middle East",
  "Qatar": "Middle East",
  "Kuwait": "Middle East",
  "Brazil": "Latin America",
  "Argentina": "Latin America",
  "Chile": "Latin America",
  "Colombia": "Latin America",
  "Peru": "Latin America",
  "Venezuela": "Latin America",
  "Nigeria": "Africa",
  "South Africa": "Africa",
  "Kenya": "Africa",
  "Ghana": "Africa",
  "Ethiopia": "Africa",
  "Tanzania": "Africa",
}

function countByRegion(events: DisruptionEvent[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const e of events) {
    counts[e.region] = (counts[e.region] ?? 0) + 1
  }
  return counts
}

function getCountryColor(geoName: string, regionCounts: Record<string, number>): string {
  const region = MAP_COUNTRY_TO_REGION[geoName]
  if (!region) return "#e5e7eb"
  const count = regionCounts[region] ?? 0
  if (count === 0) return "#e5e7eb"
  if (count <= 2) return "#fef3c7"
  if (count <= 5) return "#f97316"
  return "#dc2626"
}

interface WorldMapProps {
  events: DisruptionEvent[]
}

export default function WorldMap({ events }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null)
  const regionCounts = countByRegion(events)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
        Risk by Region
      </h2>

      <p className="text-xs text-gray-500 h-4 mb-2">
        {hoveredCountry ? hoveredCountry : "Hover a country to see details"}
      </p>

      <ComposableMap projectionConfig={{ scale: 140 }}>
        <ZoomableGroup zoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={getCountryColor(geo.properties.name, regionCounts)}
                  stroke="#fff"
                  strokeWidth={0.5}
                  onMouseEnter={() => setHoveredCountry(geo.properties.name)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none", opacity: 0.8 },
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
          { color: "#e5e7eb", label: "No events" },
          { color: "#fef3c7", label: "1–2 events" },
          { color: "#f97316", label: "3–5 events" },
          { color: "#dc2626", label: "6+ events" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
