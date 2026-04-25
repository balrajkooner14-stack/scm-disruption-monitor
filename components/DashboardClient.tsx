"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import KPIBar from "@/components/KPIBar"
import AnalyticsTab from "@/components/AnalyticsTab"
import ProfilePromptModal from "@/components/ProfilePromptModal"
import AIAdvisor from "@/components/AIAdvisor"
import AIChatPanel from "@/components/AIChatPanel"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import { DisruptionEvent } from "@/lib/types"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"

type TabId = "overview" | "advisor" | "scenarios" | "analytics"

const VALID_TABS: TabId[] = ["overview", "advisor", "scenarios", "analytics"]

const TABS = [
  { id: "overview",   label: "Overview",   icon: "🗺️", description: "Live map & disruption feed" },
  { id: "advisor",    label: "Advisor",    icon: "🤖", description: "AI recommendations" },
  { id: "scenarios",  label: "Scenarios",  icon: "🔮", description: "What-if analysis" },
  { id: "analytics",  label: "Analytics",  icon: "📊", description: "Category breakdown" },
] as const

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "overview"
    const saved = localStorage.getItem("scm_active_tab")
    return VALID_TABS.includes(saved as TabId) ? (saved as TabId) : "overview"
  })

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

  const criticalCount = scoredEvents.filter(e => e.severity === 3).length
  const profileMatchCount = scoredEvents.filter(e => e.isProfileMatch).length

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    localStorage.setItem("scm_active_tab", tab)
  }

  return (
    <>
      <ProfilePromptModal />

      {showToast && (
        <div className="mb-4 bg-green-900 border border-green-700 text-green-300 text-sm px-4 py-2 rounded-lg animate-pulse">
          ✅ Company profile saved! Your dashboard is now personalized.
        </div>
      )}

      <KPIBar
        events={scoredEvents}
        kpiFilter={kpiFilter}
        onKpiFilter={setKpiFilter}
        scoredEvents={scoredEvents}
        profile={profile}
      />

      {/* Tab navigation bar */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2.5
              rounded-lg text-sm font-medium transition-all duration-150
              ${activeTab === tab.id
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }
            `}
          >
            <span className="text-base hidden sm:inline">{tab.icon}</span>
            <span>{tab.label}</span>

            {/* Red critical badge on Overview */}
            {tab.id === "overview" && criticalCount > 0 && (
              <span className="text-xs bg-red-600 text-white rounded-full
                               px-1.5 py-0.5 flex-shrink-0 font-bold leading-none">
                {criticalCount}
              </span>
            )}

            {/* Blue dot on Advisor when profile matches exist */}
            {tab.id === "advisor" && profile && profileMatchCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[600px]">

        {/* OVERVIEW */}
        {activeTab === "overview" && (
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
        )}

        {/* ADVISOR */}
        {activeTab === "advisor" && (
          <div className="max-w-3xl mx-auto">
            <AIAdvisor events={scoredEvents} />
          </div>
        )}

        {/* SCENARIOS */}
        {activeTab === "scenarios" && (
          <div className="max-w-3xl mx-auto">
            <ScenarioPlanner events={scoredEvents} defaultOpen={true} />
          </div>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <AnalyticsTab events={scoredEvents} />
        )}

      </div>

      {/* Floating chat — always visible on all tabs */}
      <AIChatPanel events={scoredEvents} />
    </>
  )
}
