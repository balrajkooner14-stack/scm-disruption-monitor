"use client"

import { useMemo } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useOnboardingExtras } from "@/hooks/useOnboardingExtras"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import { DisruptionEvent } from "@/lib/types"

export default function ScenarioPageClient({
  events,
}: {
  events: DisruptionEvent[]
}) {
  const { profile, isLoaded } = useCompanyProfile()
  const { extras } = useOnboardingExtras()

  const scoredEvents = useMemo((): ScoredEvent[] => {
    if (!profile || !isLoaded)
      return events.map(e => ({
        ...e,
        relevanceScore: 0,
        relevanceReason: "",
        isProfileMatch: false,
      }))
    return scoreEventsForProfile(events, profile, extras?.entryPorts)
  }, [events, profile, isLoaded, extras])

  return <ScenarioPlanner events={scoredEvents} />
}
