"use client"

import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis } from "recharts"
import { COLOR } from "@/lib/brand"
import type { CommodityResult } from "@/app/api/market-data/route"

/** "+2.6%", "−7.0%" (U+2212), "0.0%". */
export function formatSignedPercent(value: number): string {
  const abs = Math.abs(value).toFixed(1)
  if (Number(abs) === 0) return "0.0%"
  return `${value > 0 ? "+" : "−"}${abs}%`
}

/** Up → ember-deep, down → sea-deep, flat → ink-3. */
export function changeClass(value: number): string {
  if (Number(Math.abs(value).toFixed(1)) === 0) return "text-ink-3"
  return value > 0 ? "text-ember-deep" : "text-sea-deep"
}

export const TOOLTIP_STYLE = {
  backgroundColor: COLOR.surface,
  border: `1px solid ${COLOR.line}`,
  borderRadius: 8,
  color: COLOR.ink,
  fontSize: 12,
}

/** One row of the commodity / currency lists: name · sparkline · latest · change. */
export default function MarketRow({ item, highlight }: { item: CommodityResult; highlight?: string }) {
  const latest = item.data[item.data.length - 1]?.value ?? 0
  return (
    <div className="grid grid-cols-[1fr_120px_110px_70px] items-center py-3.5 border-t border-line-soft">
      <div className="flex flex-col min-w-0">
        <span className="text-[15px] font-semibold text-ink truncate">{item.name}</span>
        {highlight && <span className="text-xs text-ember">{highlight}</span>}
      </div>
      <div className="h-7">
        {item.data.length > 1 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={item.data}>
              <YAxis domain={["auto", "auto"]} hide />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(val) =>
                  typeof val === "number"
                    ? [val.toFixed(2), item.name]
                    : [String(val ?? ""), item.name]
                }
                labelFormatter={(label) => String(label ?? "")}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={COLOR.ink}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, fill: COLOR.ink }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      <span className="font-serif text-xl text-right tabular-nums text-ink">
        {latest.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={`text-[13px] text-right tabular-nums ${changeClass(item.change)}`}>
        {formatSignedPercent(item.change)}
      </span>
    </div>
  )
}
