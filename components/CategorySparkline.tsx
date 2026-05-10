"use client"

import { CategoryTrend, getTrendColor } from "@/lib/categoryTrends"

interface CategorySparklineProps {
  trend: CategoryTrend
  className?: string
}

export default function CategorySparkline({
  trend,
  className = "",
}: CategorySparklineProps) {
  if (trend.history.length < 2) return null

  const { stroke } = getTrendColor(trend.trend)

  return (
    <svg
      width="36"
      height="14"
      viewBox="0 0 36 14"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={trend.sparklinePoints}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}
