"use client"

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { DisruptionEvent, DisruptionCategory } from "@/lib/types"

interface CategoryChartProps {
  events: DisruptionEvent[]
}

const CATEGORY_COLORS: Record<DisruptionCategory | "General", string> = {
  Port: "#3b82f6",
  Tariff: "#f59e0b",
  Labor: "#8b5cf6",
  Geopolitical: "#ef4444",
  Weather: "#06b6d4",
  General: "#6b7280",
}

export default function CategoryChart({ events }: CategoryChartProps) {
  const categories: Array<DisruptionCategory | "General"> =
    ["Port", "Tariff", "Labor", "Geopolitical", "Weather", "General"]

  const data = categories.map(cat => ({
    name: cat,
    count: events.filter(e => e.category === cat).length,
    color: CATEGORY_COLORS[cat],
  })).filter(d => d.count > 0)

  if (data.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-4 flex items-center justify-center h-32">
        <p className="text-slate-500 text-sm">No category data available</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">
        Events by Category
      </h2>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={32}>
          <XAxis
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#94a3b8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={20}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              color: "#f1f5f9",
              fontSize: "12px",
            }}
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
