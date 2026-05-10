"use client"

import { useState, useEffect } from "react"
import CategoryChart from "@/components/CategoryChart"
import CommodityChart from "@/components/CommodityChart"
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

  return (
    <div className="space-y-6">
      {/* Events by category — always shown */}
      <CategoryChart events={events} />

      {/* 7-Day Category Trends */}
      {Object.keys(trends).length > 0 && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm">📈</span>
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                7-Day Category Trends
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              {historyDays < 2
                ? "Building trend data — check back tomorrow"
                : `${historyDays} days of data`}
            </span>
          </div>

          {historyDays < 2 ? (
            <div className="text-center py-4">
              <p className="text-slate-500 text-sm mb-1">
                Trend data builds automatically with each visit
              </p>
              <p className="text-xs text-slate-600">
                Come back tomorrow to see your first trend lines
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.values(trends).map((trend) => {
                const colors = getTrendColor(trend.trend)
                return (
                  <div
                    key={trend.category}
                    className="bg-slate-700/50 border border-slate-700 rounded-lg px-3 py-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-300">
                        {trend.category}
                      </span>
                      <span className={`text-xs font-bold ${colors.text}`}>
                        {trend.changePercent > 0 ? "+" : ""}
                        {trend.changePercent}%
                      </span>
                    </div>
                    <div className="flex items-end justify-between gap-2">
                      <div>
                        <span className="text-xl font-black text-slate-100">
                          {trend.currentCount}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">events</span>
                      </div>
                      {trend.history.length >= 2 && (
                        <CategorySparkline trend={trend} className="mb-0.5" />
                      )}
                    </div>
                    <p className={`text-xs mt-1 ${colors.text}`}>
                      {trend.trend === "rising" ? "↑ Increasing"
                       : trend.trend === "falling" ? "↓ Decreasing"
                       : "→ Stable"}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-xs text-slate-700 mt-3">
            Trend data saved locally · Updates on each dashboard visit ·
            Red = more disruptions this week · Green = fewer disruptions
          </p>
        </div>
      )}

      {/* Market data — loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5 animate-pulse min-h-[220px]"
            >
              <div className="h-3 w-32 bg-slate-700 rounded mb-4" />
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((j) => (
                  <div key={j} className="bg-slate-700/50 rounded-lg h-24" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Market data — error state */}
      {error && (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <p className="text-slate-500 text-sm">
            Could not load market data. The World Bank API may be temporarily
            unavailable — try refreshing.
          </p>
        </div>
      )}

      {/* Market data — loaded */}
      {marketData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <CommodityChart
            commodities={marketData.commodities}
            lastUpdated={marketData.lastUpdated}
          />
          <FreightRateCard
            rates={marketData.freight}
            lastUpdated={marketData.lastUpdated}
          />
        </div>
      )}

      {/* Reading these indicators */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
          Reading These Indicators
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-500 leading-relaxed">
          <div>
            <p className="text-slate-300 font-medium mb-1">Commodity Prices</p>
            <p>
              Rising input costs compress margins and may signal supply
              shortages. Watch for spikes that precede freight rate increases
              by 4–8 weeks.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">
              Container Freight Rates
            </p>
            <p>
              Rate surges (▲) indicate port congestion or capacity crunch.
              Falling rates (▼) suggest excess supply or slowing trade volumes.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Crude Oil</p>
            <p>
              Drives air and ocean freight costs. A 10% oil spike typically
              adds 2–3% to total logistics spend within 6–8 weeks.
            </p>
          </div>
          <div>
            <p className="text-slate-300 font-medium mb-1">Data Sources</p>
            <p>
              Commodity prices: World Bank Pink Sheet (monthly). Freight rates:
              static index benchmarks updated periodically. Not financial
              advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
