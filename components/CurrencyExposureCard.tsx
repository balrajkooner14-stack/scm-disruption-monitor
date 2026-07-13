"use client"

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { currencyCodesForCountries } from "@/lib/currencyMapping"
import type { CommodityResult } from "@/app/api/market-data/route"

interface CurrencyExposureCardProps {
  currencies: CommodityResult[]
  lastUpdated: string
}

export default function CurrencyExposureCard({ currencies, lastUpdated }: CurrencyExposureCardProps) {
  const { profile, isLoaded } = useCompanyProfile()

  if (!isLoaded) return null
  if (!profile || profile.suppliers.length === 0) return null

  const relevantCodes = currencyCodesForCountries(profile.suppliers.map(s => s.country))
  const relevant = currencies.filter(c => relevantCodes.has(c.id.replace("=X", "")))

  if (relevant.length === 0) return null

  const date = new Date(lastUpdated).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">💱</span>
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Currency Exposure
          </h2>
        </div>
        <span className="text-xs text-slate-600">Yahoo Finance · {date}</span>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Rates for currencies used by your supplier countries — swings here change your landed cost even when nothing else does.
      </p>

      <div className="grid grid-cols-2 gap-3">
        {relevant.map((c) => {
          const latest = c.data[c.data.length - 1]?.value ?? 0

          return (
            <div
              key={c.id}
              className="rounded-lg p-3 border bg-slate-900/60 border-slate-700"
            >
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs text-slate-400 font-medium">{c.name}</p>
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                    c.change > 0
                      ? "text-red-400 bg-red-900/30"
                      : c.change < 0
                        ? "text-green-400 bg-green-900/30"
                        : "text-slate-400 bg-slate-700/30"
                  }`}
                >
                  {c.change > 0 ? "▲" : c.change < 0 ? "▼" : "—"}{" "}
                  {Math.abs(c.change).toFixed(1)}%
                </span>
              </div>

              <p className="text-xl font-bold text-white mb-2">
                {latest.toFixed(2)}
                <span className="text-xs text-slate-500 font-normal ml-1">{c.unit}</span>
              </p>

              {c.data.length > 1 && (
                <ResponsiveContainer width="100%" height={48}>
                  <LineChart data={c.data}>
                    <YAxis domain={["auto", "auto"]} hide />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        border: "1px solid #334155",
                        borderRadius: "6px",
                        color: "#f1f5f9",
                        fontSize: "11px",
                      }}
                      formatter={(val) =>
                        typeof val === "number"
                          ? [val.toFixed(2), c.name]
                          : [String(val ?? ""), c.name]
                      }
                      labelFormatter={(label) => String(label ?? "")}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#a78bfa"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
