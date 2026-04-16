"use client"

import { useState } from "react"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import KPIBar from "@/components/KPIBar"
import { DisruptionEvent } from "@/lib/types"

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)

  return (
    <>
      <KPIBar events={events} kpiFilter={kpiFilter} onKpiFilter={setKpiFilter} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorldMap
          events={events}
          selectedRegion={selectedRegion}
          onRegionSelect={setSelectedRegion}
        />
        <DisruptionFeed
          events={events}
          regionFilter={selectedRegion}
          onRegionClear={() => setSelectedRegion(null)}
          kpiFilter={kpiFilter}
        />
      </div>
    </>
  )
}
