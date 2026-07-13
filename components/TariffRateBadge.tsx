"use client"

import { useState, useEffect } from "react"
import type { TariffRateResult } from "@/app/api/tariff-lookup/route"

interface TariffRateBadgeProps {
  hsCode: string
}

export default function TariffRateBadge({ hsCode }: TariffRateBadgeProps) {
  const [result, setResult] = useState<TariffRateResult | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(false)

    fetch(`/api/tariff-lookup?hsCode=${encodeURIComponent(hsCode)}`)
      .then(res => res.json())
      .then(data => {
        if (cancelled) return
        setResult(data.results?.[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [hsCode])

  if (isLoading) {
    return <p className="text-xs text-slate-600 mt-1">Looking up duty rate…</p>
  }

  if (error || !result) {
    return <p className="text-xs text-slate-600 mt-1">Duty rate unavailable for HTS {hsCode}</p>
  }

  return (
    <p className="text-xs text-slate-400 mt-1">
      Est. duty rate:{" "}
      <span className="text-slate-200 font-medium">{result.generalRate}</span>
      {" "}(general rate, HTS {result.htsNumber})
      {result.specialRate && (
        <span className="text-slate-500"> · special program: {result.specialRate}</span>
      )}
    </p>
  )
}
