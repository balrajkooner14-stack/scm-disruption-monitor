"use client"

import { useState, useEffect } from "react"
import CategoryChart from "@/components/CategoryChart"
import CommodityChart from "@/components/CommodityChart"
import FreightRateCard from "@/components/FreightRateCard"
import type { MarketData } from "@/app/api/market-data/route"
import type { ScoredEvent } from "@/lib/scoreEvents"

interface AnalyticsTabProps {
  events: ScoredEvent[]
}

export default function AnalyticsTab({ events }: AnalyticsTabProps) {
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
