"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import KPIBar from "@/components/KPIBar"
import ProfilePromptModal from "@/components/ProfilePromptModal"
import AIAdvisor from "@/components/AIAdvisor"
import AIChatPanel from "@/components/AIChatPanel"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import { DisruptionEvent } from "@/lib/types"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()

  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("profileSaved") === "true") {
      setShowToast(true)
      const timer = setTimeout(() => setShowToast(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [searchParams])

  const scoredEvents = useMemo((): ScoredEvent[] => {
    if (!profile || !isLoaded) return events.map(e => ({
      ...e,
      relevanceScore: 0,
      relevanceReason: "Set up your profile for personalized scoring",
      isProfileMatch: false,
    }))
    return scoreEventsForProfile(events, profile)
  }, [events, profile, isLoaded])

  return (
    <>
      <ProfilePromptModal />

      {showToast && (
        <div className="mb-4 bg-green-900 border border-green-700 text-green-300 text-sm px-4 py-2 rounded-lg animate-pulse">
          ✅ Company profile saved! Your dashboard is now personalized.
        </div>
      )}

      <KPIBar
        events={events}
        kpiFilter={kpiFilter}
        onKpiFilter={setKpiFilter}
        scoredEvents={scoredEvents}
        profile={profile}
      />
      <AIAdvisor events={scoredEvents} />
      <ScenarioPlanner events={scoredEvents} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <WorldMap
          events={scoredEvents}
          selectedRegion={selectedRegion}
          onRegionSelect={setSelectedRegion}
        />
        <DisruptionFeed
          events={scoredEvents}
          regionFilter={selectedRegion}
          onRegionClear={() => setSelectedRegion(null)}
          kpiFilter={kpiFilter}
        />
      </div>
      <AIChatPanel events={scoredEvents} />
    </>
  )
}
