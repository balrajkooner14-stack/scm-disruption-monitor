"use client"

import { useMemo } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import { DisruptionEvent } from "@/lib/types"

export default function ScenarioPageClient({
  events,
}: {
  events: DisruptionEvent[]
}) {
  const { profile, isLoaded } = useCompanyProfile()

  const scoredEvents = useMemo((): ScoredEvent[] => {
    if (!profile || !isLoaded)
      return events.map(e => ({
        ...e,
        relevanceScore: 0,
        relevanceReason: "",
        isProfileMatch: false,
      }))
    return scoreEventsForProfile(events, profile)
  }, [events, profile, isLoaded])

  return <ScenarioPlanner events={scoredEvents} />
}
