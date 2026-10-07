"use client"

import { CategoryTrend, getTrendColor } from "@/lib/categoryTrends"

interface CategorySparklineProps {
  trend: CategoryTrend
  className?: string
  /** Rendered size. Points are computed on a 36×14 grid and scaled. */
  width?: number
  height?: number
}

export default function CategorySparkline({
  trend,
  className = "",
  width = 36,
  height = 14,
}: CategorySparklineProps) {
  if (trend.history.length < 2) return null

  const { stroke } = getTrendColor(trend.trend)

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 36 14"
      preserveAspectRatio="none"
      className={`flex-shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polyline
        points={trend.sparklinePoints}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
