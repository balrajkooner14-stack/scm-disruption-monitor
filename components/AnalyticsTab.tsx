"use client"

import { useState, useEffect } from "react"
import CommodityChart from "@/components/CommodityChart"
import CurrencyExposureCard from "@/components/CurrencyExposureCard"
import FreightRateCard from "@/components/FreightRateCard"
import CategorySparkline from "@/components/CategorySparkline"
import {
  loadRawHistory,
  buildCategoryTrends,
  getTrendColor,
  type CategoryTrend,
} from "@/lib/categoryTrends"
import type { MarketData } from "@/app/api/market-data/route"
import type { ScoredEvent } from "@/lib/scoreEvents"
import type { DisruptionCategory } from "@/lib/types"
import { formatSignedPercent } from "@/components/MarketRow"
import { ui } from "@/lib/ui"

const CATEGORIES: DisruptionCategory[] = ["Port", "Tariff", "Labor", "Geopolitical", "Weather", "General"]

const TREND_WORD = { rising: "Rising", falling: "Falling", stable: "Stable" } as const

interface AnalyticsTabProps {
  events: ScoredEvent[]
}

export default function AnalyticsTab({ events }: AnalyticsTabProps) {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [trends, setTrends] = useState<Record<string, CategoryTrend>>({})
  const [historyDays, setHistoryDays] = useState(0)

  useEffect(() => {
    const history = loadRawHistory()
    setHistoryDays(history.length)
    if (events.length > 0) {
      setTrends(buildCategoryTrends(events))
    }
  }, [events.length])

  useEffect(() => {
    fetch("/api/market-data")
      .then((r) => {
        if (!r.ok) throw new Error("market-data fetch failed")
        return r.json() as Promise<MarketData>
      })
      .then((d) => setMarketData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  const hasTrendData = historyDays >= 2

  // Same counts the old bar chart showed; sorted highest first for display.
  const categoryCells = CATEGORIES
    .map(category => ({
      category,
      count: events.filter(e => e.category === category).length,
      trend: trends[category],
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      {/* Events by category — counts today plus 7-day trend */}
      <section className={`${ui.card} p-7 flex flex-col gap-5`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className={ui.h1}>Events by category</h1>
          <p className={ui.meta}>Today · with change over 7 days</p>
        </div>

        {events.length === 0 ? (
          <p className={`${ui.emptyText} border-t border-line-soft pt-5`}>No category data available.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-t border-line-soft">
            {categoryCells.map(({ category, count, trend }, i) => {
              const colors = trend ? getTrendColor(trend.trend) : null
              return (
                <div
                  key={category}
                  className={`p-5 flex flex-col gap-2.5 ${i === 0 ? "" : "border-l border-line-soft"}`}
                >
                  <span className="text-sm text-ink-2">{category}</span>
                  <span className={ui.stat}>{count}</span>
                  {hasTrendData && trend && (
                    <>
                      <CategorySparkline trend={trend} width={120} height={28} />
                      <span
                        className={`text-[13px] ${colors?.text ?? "text-ink-3"} ${
                          trend.trend === "rising" ? "font-semibold" : ""
                        }`}
                      >
                        {TREND_WORD[trend.trend]} · {formatSignedPercent(trend.changePercent).replace(".0%", "%")}
                      </span>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className={ui.meta}>
          {hasTrendData
            ? `${historyDays} days of trend data, saved locally and updated on each dashboard visit.`
            : "Building trend data — it builds automatically with each visit. Come back tomorrow to see your first trend lines."}
        </p>
      </section>

      {/* Market data — loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className={`${ui.card} space-y-4 min-h-[220px]`}>
              <div className={`${ui.skeleton} h-6 w-40`} />
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className={`${ui.skeleton} h-8`} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Market data — error state */}
      {error && (
        <div className={ui.card}>
          <p className={ui.meta}>
            Could not load market data. Yahoo Finance may be temporarily
            unavailable — try refreshing.
          </p>
        </div>
      )}

      {/* Market data — loaded */}
      {marketData && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <CommodityChart
              commodities={marketData.commodities}
              lastUpdated={marketData.lastUpdated}
            />
            <CurrencyExposureCard
              currencies={marketData.currencies}
              lastUpdated={marketData.lastUpdated}
            />
          </div>
          <FreightRateCard rates={marketData.freight} />
        </>
      )}

      {/* Reading these indicators */}
      <details className="group">
        <summary className={`${ui.btnGhost} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="group-open:rotate-180">
            <path d="M6 9 L12 15 L18 9" />
          </svg>
          How to read these indicators
        </summary>
        <div className="grid md:grid-cols-4 gap-6 pt-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Commodity prices</p>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Rising input costs compress margins and may signal supply
              shortages. Watch for spikes that precede freight rate increases
              by 4–8 weeks.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Container freight rates</p>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Rate surges indicate port congestion or capacity crunch.
              Falling rates suggest excess supply or slowing trade volumes.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Crude oil</p>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Drives air and ocean freight costs. A 10% oil spike typically
              adds 2–3% to total logistics spend within 6–8 weeks.
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-ink">Data sources</p>
            <p className="text-[13px] leading-relaxed text-ink-2">
              Commodity prices: Yahoo Finance futures (CL=F, NG=F, HG=F, ZW=F). Freight rates:
              static index benchmarks updated periodically. Not financial
              advice.
            </p>
          </div>
        </div>
      </details>
    </div>
  )
}
