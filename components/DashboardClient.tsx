"use client"

import { useState } from "react"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import { DisruptionEvent } from "@/lib/types"

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)

  return (
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
      />
    </div>
  )
}
