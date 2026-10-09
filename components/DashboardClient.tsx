"use client"

import { isDemoMode } from "@/lib/demoMode"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import KPIBar from "@/components/KPIBar"
import AnalyticsTab from "@/components/AnalyticsTab"
import ProfilePromptModal from "@/components/ProfilePromptModal"
import DemoBanner from "@/components/DemoBanner"
import GuestCarryOverPrompt from "@/components/GuestCarryOverPrompt"
import AIAdvisor from "@/components/AIAdvisor"
import SupplierHealthScorecard from "@/components/SupplierHealthScorecard"
import ConcentrationRiskCard from "@/components/ConcentrationRiskCard"
import SanctionsScreeningCard from "@/components/SanctionsScreeningCard"
import DisruptionHistoryTab from "@/components/DisruptionHistoryTab"
import PerformanceAlertBanner from "@/components/PerformanceAlertBanner"
import DisruptionUpdatePrompt from "@/components/DisruptionUpdatePrompt"
import LaborCalendarCard from "@/components/LaborCalendarCard"
import StructuralRiskCard from "@/components/StructuralRiskCard"
import AIRiskRadarCard from "@/components/AIRiskRadarCard"
import SupplyChainNetworkGraph from "@/components/SupplyChainNetworkGraph"
import AIChatPanel from "@/components/AIChatPanel"
import ScenarioPlanner from "@/components/ScenarioPlanner"
import AIInsightPanel from "@/components/AIInsightPanel"
import DailyBriefButton from "@/components/DailyBriefButton"
import InventoryRiskPanel from "@/components/InventoryRiskPanel"
import { DisruptionEvent } from "@/lib/types"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useOnboardingExtras } from "@/hooks/useOnboardingExtras"
import { useDisruptionHistory } from "@/hooks/useDisruptionHistory"
import { scoreEventsForProfile, ScoredEvent } from "@/lib/scoreEvents"
import { calculateInventoryRisk, getDaysSinceDate, calculateOrderRecommendation } from "@/lib/inventoryRisk"
import { calculateConcentrationRisk } from "@/lib/concentrationRisk"
import { findSinglePointsOfFailure } from "@/lib/supplyChainGraph"
import { ENABLE_SANCTIONS_SCREENING } from "@/lib/featureFlags"
import { ui } from "@/lib/ui"
import type { BriefData } from "@/lib/generateBrief"
import type { MarketData } from "@/app/api/market-data/route"

type TabId = "overview" | "advisor" | "scenarios" | "analytics" | "history"

const VALID_TABS: TabId[] = ["overview", "advisor", "scenarios", "analytics", "history"]

const TABS = [
  { id: "overview",  label: "Overview",  description: "Live map & disruption feed" },
  { id: "advisor",   label: "Advisor",   description: "AI recommendations" },
  { id: "scenarios", label: "Scenarios", description: "What-if analysis" },
  { id: "analytics", label: "Analytics", description: "Category breakdown" },
  { id: "history",   label: "History",   description: "90-day disruption log" },
] as const

interface DashboardClientProps {
  events: DisruptionEvent[]
}

export default function DashboardClient({ events }: DashboardClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [kpiFilter, setKpiFilter] = useState<string | null>(null)
  const [showToast, setShowToast] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()
  const { extras } = useOnboardingExtras()
  const { entries: historyEntries, saveEvents: saveEventsToHistory } = useDisruptionHistory()

  function handleAiStatusChange(status: "live" | "cached" | "error") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ai-status-change", { detail: status }))
    }
  }

  // PDF brief data — lifted from child components via callbacks
  const [aiSummaryPoints, setAiSummaryPoints] = useState<string[]>([])
  const [advisorRecs, setAdvisorRecs] = useState<BriefData["recommendations"]>([])
  const [commodityData, setCommodityData] = useState<BriefData["commodityPrices"]>([])
  const [inventoryRecs, setInventoryRecs] = useState<NonNullable<BriefData["inventoryRecommendations"]>>([])

  const historyCount = historyEntries.length
  const historyForBrief = useMemo(
    () =>
      historyEntries.slice(0, 10).map(e => ({
        date: e.date,
        title: e.title,
        severityLabel: e.severityLabel,
        category: e.category,
        isProfileMatch: e.isProfileMatch,
      })),
    [historyEntries]
  )

  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "overview"
    const saved = localStorage.getItem("scm_active_tab")
    return VALID_TABS.includes(saved as TabId) ? (saved as TabId) : "overview"
  })

  const searchParams = useSearchParams()

  // Set after mount: the page is prerendered, so a render-time clock would
  // not match between server and client.
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  useEffect(() => {
    setUpdatedAt(
      new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      }),
    )
  }, [])

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
    return scoreEventsForProfile(events, profile, extras?.entryPorts)
  }, [events, profile, isLoaded, extras])

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

  useEffect(() => {
    if (!inventorySnapshot) return
    const recs = inventorySnapshot.products
      .filter(p => p.riskLevel === "critical" || p.riskLevel === "warning")
      .flatMap(p => {
        const rec = calculateOrderRecommendation(p)
        if (!rec) return []
        return [{
          productName: p.productName,
          riskLevel: p.riskLevel,
          daysRemaining: p.daysRemaining,
          recommendedOrderDays: rec.recommendedOrderQty,
          urgencyLabel: rec.urgencyLabel,
          supplierName: p.primarySupplier?.name ?? "Primary supplier",
          leadTimeDays: p.primaryLeadTimeDays,
        }]
      })
    setInventoryRecs(recs)
  }, [inventorySnapshot])

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

  const spofCount = useMemo(() => {
    if (!profile) return 0
    return findSinglePointsOfFailure(profile).filter(s => s.isSinglePointOfFailure).length
  }, [profile])

  // Listen for tab-switch events dispatched by child components
  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail
      if (VALID_TABS.includes(tab as TabId)) {
        setActiveTab(tab as TabId)
        if (!isDemoMode()) localStorage.setItem("scm_active_tab", tab)
      }
    }
    window.addEventListener("switchTab", handleSwitchTab)
    return () => window.removeEventListener("switchTab", handleSwitchTab)
  }, [])

  // Auto-save events to history on every load (2s delay to avoid blocking render)
  useEffect(() => {
    if (scoredEvents.length === 0) return
    const timer = setTimeout(() => {
      saveEventsToHistory(scoredEvents)
    }, 2000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoredEvents.length])

  const top5Headlines = useMemo(
    () => scoredEvents.slice(0, 5).map((e) => e.title),
    [scoredEvents],
  )

  function handleTabChange(tab: TabId) {
    setActiveTab(tab)
    if (!isDemoMode()) localStorage.setItem("scm_active_tab", tab)
  }

  return (
    <>
      <ProfilePromptModal />
      <DemoBanner />
      <GuestCarryOverPrompt />

      {showToast && (
        <div className="rounded-lg border border-line bg-surface px-4 py-2 text-sm text-ink">
          <span className="text-moss">✓</span> Profile saved. Your dashboard now reflects your supply chain.
        </div>
      )}

      {/* Brief — inside DashboardClient so summary state can be lifted for the PDF */}
      <AIInsightPanel
        headlines={top5Headlines}
        onSummaryLoaded={setAiSummaryPoints}
        onStatusChange={handleAiStatusChange}
        relevantCount={profileMatchCount}
        criticalCount={criticalCount}
        totalCount={scoredEvents.length}
      />

      <KPIBar
        events={scoredEvents}
        kpiFilter={kpiFilter}
        onKpiFilter={setKpiFilter}
        scoredEvents={scoredEvents}
        profile={profile}
        inventorySnapshot={inventorySnapshot}
        concentrationResult={concentrationResult}
        spofCount={spofCount}
      />

      {/* Tab bar + export */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 border-b border-line">
        <nav aria-label="Sections" className="flex gap-9 overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                title={tab.description}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center py-3 text-[15px] -mb-px border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-ember font-semibold text-ink"
                    : "border-transparent text-ink-2 hover:text-ink"
                }`}
              >
                {tab.label}

                {tab.id === "overview" && criticalCount > 0 && (
                  <span className="ml-2 rounded-full bg-ember px-2 text-xs text-white">
                    {criticalCount}
                  </span>
                )}

                {tab.id === "advisor" && profile && profileMatchCount > 0 && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-ember" aria-label="Relevant events" />
                )}

                {tab.id === "history" && historyCount > 0 && (
                  <span className="ml-2 rounded-full bg-line-soft px-2 text-xs text-ink-2">
                    {historyCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div className="flex items-center gap-4 pb-2">
          <span className={ui.meta}>
            {scoredEvents.length} events{updatedAt && ` · Updated ${updatedAt}`}
          </span>
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
            historyEntries={historyForBrief}
            inventoryRecommendations={inventoryRecs}
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="min-h-[600px]">

        {activeTab === "overview" && (
          <div className="space-y-7">
            <DisruptionUpdatePrompt events={scoredEvents} />
            <PerformanceAlertBanner />
            <InventoryRiskPanel events={scoredEvents} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7">
                <WorldMap
                  events={scoredEvents}
                  selectedRegion={selectedRegion}
                  onRegionSelect={setSelectedRegion}
                />
              </div>
              <div className="lg:col-span-5">
                <DisruptionFeed
                  events={scoredEvents}
                  regionFilter={selectedRegion}
                  onRegionClear={() => setSelectedRegion(null)}
                  kpiFilter={kpiFilter}
                />
              </div>
            </div>
            <AIRiskRadarCard />
            <StructuralRiskCard />
            <LaborCalendarCard />
          </div>
        )}

        {activeTab === "advisor" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 min-w-0">
              <AIAdvisor
                events={scoredEvents}
                onRecsLoaded={setAdvisorRecs}
              />
            </div>
            <aside className="lg:col-span-4 flex flex-col gap-5 min-w-0">
              <ConcentrationRiskCard />
              {ENABLE_SANCTIONS_SCREENING && <SanctionsScreeningCard />}
              <SupplierHealthScorecard events={scoredEvents} />
            </aside>
          </div>
        )}

        {activeTab === "scenarios" && (
          <div className="space-y-6">
            <SupplyChainNetworkGraph events={scoredEvents} />
            <ScenarioPlanner events={scoredEvents} defaultOpen={true} />
          </div>
        )}

        {activeTab === "analytics" && (
          <AnalyticsTab events={scoredEvents} />
        )}

        {activeTab === "history" && (
          <DisruptionHistoryTab />
        )}

      </div>

      <AIChatPanel events={scoredEvents} />
    </>
  )
}
