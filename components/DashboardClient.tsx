"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import KPIBar from "@/components/KPIBar"
import AnalyticsTab from "@/components/AnalyticsTab"
import ProfilePromptModal from "@/components/ProfilePromptModal"
import AIAdvisor from "@/components/AIAdvisor"
import SupplierHealthScorecard from "@/components/SupplierHealthScorecard"
import ConcentrationRiskCard from "@/components/ConcentrationRiskCard"
import AIChatPanel from "@/components/AIChatPanel"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import AIInsightPanel from "@/components/AIInsightPanel"
import DailyBriefButton from "@/components/DailyBriefButton"
import InventoryRiskPanel from "@/components/InventoryRiskPanel"
import { DisruptionEvent } from "@/lib/types"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"
import { calculateInventoryRisk, getDaysSinceDate } from "@/lib/inventoryRisk"
import { calculateConcentrationRisk } from "@/lib/concentrationRisk"
import type { BriefData } from "@/lib/generateBrief"
import type { MarketData } from "@/app/api/market-data/route"

type TabId = "overview" | "advisor" | "scenarios" | "analytics"

const VALID_TABS: TabId[] = ["overview", "advisor", "scenarios", "analytics"]

const TABS = [
  { id: "overview",  label: "Overview",  icon: "🗺️", description: "Live map & disruption feed" },
  { id: "advisor",   label: "Advisor",   icon: "🤖", description: "AI recommendations" },
  { id: "scenarios", label: "Scenarios", icon: "🔮", description: "What-if analysis" },
  { id: "analytics", label: "Analytics", icon: "📊", description: "Category breakdown" },
] as const

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()

  // PDF brief data — lifted from child components via callbacks
  const [aiSummaryPoints, setAiSummaryPoints] = useState<string[]>([])
  const [advisorRecs, setAdvisorRecs] = useState<BriefData["recommendations"]>([])
  const [commodityData, setCommodityData] = useState<BriefData["commodityPrices"]>([])

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

  // Background commodity fetch for PDF (24hr cache — free hit)
  useEffect(() => {
    fetch("/api/market-data")
      .then((r) => r.json() as Promise<MarketData>)
      .then((data) => {
        if (!data.commodities) return
        setCommodityData(
          data.commodities.map((c) => ({
            name: c.name,
            currentValue: c.data[c.data.length - 1]?.value ?? 0,
            unit: c.unit,
            changePercent: c.change,
            trend:
              c.change > 0.5
                ? "up"
                : c.change < -0.5
                  ? "down"
                  : "flat",
          })),
        )
      })
      .catch(() => {}) // silently — PDF just omits commodity section
  }, [])

  const scoredEvents = useMemo((): ScoredEvent[] => {
    if (!profile || !isLoaded)
      return events.map((e) => ({
        ...e,
        relevanceScore: 0,
        relevanceReason: "Set up your profile for personalized scoring",
        isProfileMatch: false,
      }))
    return scoreEventsForProfile(events, profile)
  }, [events, profile, isLoaded])

  const criticalCount = scoredEvents.filter((e) => e.severity === 3).length
  const profileMatchCount = scoredEvents.filter((e) => e.isProfileMatch).length

  const inventorySnapshot = useMemo(() => {
    if (!profile) return undefined
    const hasDisruptionByRegion: Record<string, boolean> = {}
    scoredEvents
      .filter(e => e.severity >= 2)
      .forEach(e => { if (e.region) hasDisruptionByRegion[e.region] = true })
    const daysSince = getDaysSinceDate(profile.updatedAt ?? new Date().toISOString())
    return calculateInventoryRisk(profile, hasDisruptionByRegion, daysSince)
  }, [profile, scoredEvents])

  const concentrationResult = useMemo(() => {
    if (!profile) return undefined
    const r = calculateConcentrationRisk(profile.suppliers)
    return {
      hhi: r.hhi,
      label: r.label,
      level: r.level,
      colorClass: r.colorClass,
      largestSingleCountry: r.breakdown.largestSingleCountry,
      largestCountryShare: r.breakdown.largestCountryShare,
    }
  }, [profile])

  const top5Headlines = useMemo(
    () => scoredEvents.slice(0, 5).map((e) => e.title),
    [scoredEvents],
  )

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

      {/* AI Risk Summary — moved inside DashboardClient so state can be lifted */}
      <AIInsightPanel
        headlines={top5Headlines}
        onSummaryLoaded={setAiSummaryPoints}
      />

      {/* Export bar — between AI summary and KPI bar */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {scoredEvents.length} events · Updated{" "}
          {new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZoneName: "short",
          })}
        </div>
        <DailyBriefButton
          events={scoredEvents}
          aiSummaryPoints={aiSummaryPoints}
          recommendations={advisorRecs}
          commodityPrices={commodityData}
          concentrationRisk={concentrationResult ? {
            hhi: concentrationResult.hhi,
            label: concentrationResult.label,
            largestCountry: concentrationResult.largestSingleCountry,
            largestCountryShare: concentrationResult.largestCountryShare,
          } : undefined}
        />
      </div>

      <KPIBar
        events={scoredEvents}
        kpiFilter={kpiFilter}
        onKpiFilter={setKpiFilter}
        scoredEvents={scoredEvents}
        profile={profile}
        inventorySnapshot={inventorySnapshot}
        concentrationResult={concentrationResult}
      />

      {/* Tab navigation bar */}
      <div className="flex gap-1 bg-slate-800/50 border border-slate-700 rounded-xl p-1 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2.5
              rounded-lg text-sm font-medium transition-all duration-150
              ${
                activeTab === tab.id
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
              }
            `}
          >
            <span className="text-base hidden sm:inline">{tab.icon}</span>
            <span>{tab.label}</span>

            {tab.id === "overview" && criticalCount > 0 && (
              <span className="text-xs bg-red-600 text-white rounded-full px-1.5 py-0.5 flex-shrink-0 font-bold leading-none">
                {criticalCount}
              </span>
            )}

            {tab.id === "advisor" && profile && profileMatchCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[600px]">

        {activeTab === "overview" && (
          <div>
            <InventoryRiskPanel events={scoredEvents} />
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
          </div>
        )}

        {activeTab === "advisor" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <AIAdvisor
              events={scoredEvents}
              onRecsLoaded={setAdvisorRecs}
            />
            <ConcentrationRiskCard />
            <SupplierHealthScorecard events={scoredEvents} />
          </div>
        )}

        {activeTab === "scenarios" && (
          <div className="max-w-3xl mx-auto">
            <ScenarioPlanner events={scoredEvents} defaultOpen={true} />
          </div>
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab events={scoredEvents} />
        )}

      </div>

      <AIChatPanel events={scoredEvents} />
    </>
  )
}
