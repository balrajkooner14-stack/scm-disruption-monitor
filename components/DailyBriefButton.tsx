"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { generateDailyBrief, BriefData } from "@/lib/generateBrief"

interface DailyBriefButtonProps {
  events: ScoredEvent[]
  aiSummaryPoints?: string[]
  recommendations?: BriefData["recommendations"]
  commodityPrices?: BriefData["commodityPrices"]
  concentrationRisk?: BriefData["concentrationRisk"]
  historyEntries?: BriefData["historyEntries"]
}

export default function DailyBriefButton({
  events,
  aiSummaryPoints = [],
  recommendations = [],
  commodityPrices = [],
  concentrationRisk,
  historyEntries,
}: DailyBriefButtonProps) {
  const { profile } = useCompanyProfile()
  const [isGenerating, setIsGenerating] = useState(false)
  const [justDownloaded, setJustDownloaded] = useState(false)

  const handleGenerate = async () => {
    if (isGenerating) return
    setIsGenerating(true)

    try {
      // Small yield so loading state renders before synchronous PDF work
      await new Promise((resolve) => setTimeout(resolve, 100))

      const briefData: BriefData = {
        profile,
        events,
        aiSummaryPoints,
        recommendations,
        commodityPrices,
        concentrationRisk,
        historyEntries,
      }

      const doc = generateDailyBrief(briefData)

      const dateStr = new Date().toISOString().split("T")[0]
      const companySlug =
        profile?.companyName.toLowerCase().replace(/\s+/g, "-") ?? "global"
      const filename = `scm-brief-${companySlug}-${dateStr}.pdf`

      doc.save(filename)

      setJustDownloaded(true)
      setTimeout(() => setJustDownloaded(false), 3000)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <button
      onClick={handleGenerate}
      disabled={isGenerating}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm
        font-medium transition-all duration-150 border
        ${
          justDownloaded
            ? "bg-green-900 border-green-700 text-green-300"
            : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white"
        }
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {isGenerating ? (
        <>
          <span className="animate-spin text-base">↻</span>
          Generating PDF...
        </>
      ) : justDownloaded ? (
        <>
          <span>✅</span>
          Downloaded!
        </>
      ) : (
        <>
          <span>📄</span>
          Export Daily Brief
        </>
      )}
    </button>
  )
}
