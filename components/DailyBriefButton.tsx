"use client"

import { useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { generateDailyBrief, BriefData } from "@/lib/generateBrief"
import { ui } from "@/lib/ui"

interface DailyBriefButtonProps {
  events: ScoredEvent[]
  aiSummaryPoints?: string[]
  recommendations?: BriefData["recommendations"]
  commodityPrices?: BriefData["commodityPrices"]
  concentrationRisk?: BriefData["concentrationRisk"]
  historyEntries?: BriefData["historyEntries"]
  inventoryRecommendations?: BriefData["inventoryRecommendations"]
}

export default function DailyBriefButton({
  events,
  aiSummaryPoints = [],
  recommendations = [],
  commodityPrices = [],
  concentrationRisk,
  historyEntries,
  inventoryRecommendations,
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
        inventoryRecommendations,
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
      aria-live="polite"
      className={`${ui.btnPrimary} disabled:cursor-not-allowed`}
    >
      {isGenerating ? "Preparing…" : justDownloaded ? "✓ Downloaded" : "Export daily brief"}
    </button>
  )
}
