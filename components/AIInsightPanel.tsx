"use client"

import { useEffect, useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"

interface AIInsightPanelProps {
  headlines: string[]
  onSummaryLoaded?: (points: string[]) => void
  onStatusChange?: (status: "live" | "cached" | "error") => void
}

type Status = "loading" | "success" | "error"

export default function AIInsightPanel({ headlines, onSummaryLoaded, onStatusChange }: AIInsightPanelProps) {
  const [summary, setSummary] = useState<string[]>([])
  const [status, setStatus] = useState<Status>("loading")
  const [isStale, setIsStale] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()

  useEffect(() => {
    if (!isLoaded) return

    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headlines, profile }),
        })

        if (!res.ok) {
          setStatus("error")
          onStatusChange?.("error")
          return
        }

        const data = await res.json()

        if (data.summary && data.summary.length > 0) {
          setSummary(data.summary)
          setIsStale(!!data.isStale)
          setStatus("success")
          onSummaryLoaded?.(data.summary)
          onStatusChange?.(data.isStale ? "cached" : "live")
        } else {
          setStatus("error")
          onStatusChange?.("error")
        }
      } catch {
        setStatus("error")
        onStatusChange?.("error")
      }
    }

    if (headlines.length > 0) {
      fetchSummary()
    } else {
      setStatus("error")
      onStatusChange?.("error")
    }
  // Re-fetch when profile loads — profile changes the prompt
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, profile?.updatedAt])

  if (status === "loading") {
    return (
      <div className="bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-400 rounded-r-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">⚡</span>
          <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            AI Risk Summary
          </span>
        </div>
        <p className="text-sm text-blue-600 dark:text-blue-400 mb-3">
          🤖 Analyzing global disruption signals with Gemini...
        </p>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-4 bg-blue-200 dark:bg-slate-600 rounded animate-pulse"
              style={{ width: `${70 + i * 10}%` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="bg-gray-50 dark:bg-slate-800 border-l-4 border-gray-300 rounded-r-lg p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          AI analysis unavailable — add your free Gemini API key at{" "}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            aistudio.google.com
          </a>
        </p>
      </div>
    )
  }

  return (
    <div className="bg-blue-50 dark:bg-slate-800 border-l-4 border-blue-400 rounded-r-lg p-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-lg">⚡</span>
        <span className="text-sm font-semibold text-blue-800 dark:text-blue-300">
          AI Risk Summary
        </span>
        {profile && (
          <span className="text-xs text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">
            Personalized for {profile.companyName}
          </span>
        )}
      </div>
      <ul className="space-y-2">
        {summary.map((point, i) => (
          <li key={i} className="flex gap-2 text-sm text-blue-900 dark:text-blue-200">
            <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
      {isStale && (
        <p className="text-xs text-slate-600 mt-2 italic">
          ↻ Showing cached data — live analysis will refresh shortly
        </p>
      )}
      <p className="text-xs text-gray-400 mt-3 text-right">
        Powered by Gemini 2.5 Flash · Refreshes every 15 min
      </p>
    </div>
  )
}
