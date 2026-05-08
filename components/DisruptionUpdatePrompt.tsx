"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { SupplyRegion } from "@/lib/profile"
import Link from "next/link"

interface DisruptionUpdatePromptProps {
  events: ScoredEvent[]
}

const LAST_VISIT_KEY = "scm_last_visit"
const PROMPT_DISMISSED_KEY = "scm_prompt_dismissed"

export default function DisruptionUpdatePrompt({
  events,
}: DisruptionUpdatePromptProps) {
  const { profile } = useCompanyProfile()
  const [showPrompt, setShowPrompt] = useState(false)
  const [affectedSuppliers, setAffectedSuppliers] = useState<string[]>([])
  const [newEventCount, setNewEventCount] = useState(0)

  useEffect(() => {
    if (!profile || events.length === 0) return

    try {
      const lastVisitRaw = localStorage.getItem(LAST_VISIT_KEY)
      const lastVisit = lastVisitRaw ? new Date(lastVisitRaw) : null

      const today = new Date().toISOString().split("T")[0]
      const dismissedKey = `${PROMPT_DISMISSED_KEY}-${today}`
      const alreadyDismissed = localStorage.getItem(dismissedKey) === "true"

      if (alreadyDismissed) return

      const supplierRegions = profile.suppliers.map(s => s.region as string)
      const supplierCountries = Array.from(
        new Set(profile.suppliers.map(s => s.country.toLowerCase()))
      )

      const newCriticalEvents = events.filter(e => {
        if (e.severity < 2) return false
        const matchesRegion = supplierRegions.includes(e.region as string)
        const matchesCountry =
          supplierCountries.length > 0 &&
          supplierCountries.some(c => e.title.toLowerCase().includes(c))
        if (!matchesRegion && !matchesCountry) return false
        if (!lastVisit) return true
        try {
          return new Date(e.date) > lastVisit
        } catch {
          return true
        }
      })

      if (newCriticalEvents.length > 0) {
        const affected = profile.suppliers
          .filter(s =>
            newCriticalEvents.some(e => e.region === (s.region as SupplyRegion))
          )
          .map(s => s.name)

        setNewEventCount(newCriticalEvents.length)
        setAffectedSuppliers(Array.from(new Set(affected)))
        setShowPrompt(true)
      }

      localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, events.length])

  const handleDismiss = () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      localStorage.setItem(`${PROMPT_DISMISSED_KEY}-${today}`, "true")
    } catch {}
    setShowPrompt(false)
  }

  if (!showPrompt || !profile) return null

  return (
    <div className="flex items-start gap-3 bg-blue-950 border border-blue-700 rounded-xl px-4 py-3 mb-4">
      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-0.5">
        <span className="text-white text-xs">🔔</span>
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-blue-300 mb-0.5">
          {newEventCount} new disruption{newEventCount > 1 ? "s" : ""} in your supplier regions since your last visit
        </p>
        {affectedSuppliers.length > 0 && (
          <p className="text-xs text-blue-400 mb-1">
            Potentially affected: {affectedSuppliers.join(", ")}
          </p>
        )}
        <p className="text-xs text-blue-500 leading-relaxed">
          Have your lead times or delivery schedules changed? Keeping your data
          current ensures accurate risk calculations.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <Link
            href="/profile"
            className="text-xs text-blue-300 hover:text-blue-200 font-medium underline transition-colors"
          >
            Update supplier data →
          </Link>
          <button
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent("switchTab", { detail: "advisor" })
              )
              handleDismiss()
            }}
            className="text-xs text-blue-500 hover:text-blue-300 transition-colors"
          >
            Review AI recommendations
          </button>
        </div>
      </div>

      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-blue-600 hover:text-blue-400 text-lg leading-none transition-colors px-1"
        title="Dismiss for today"
      >
        ×
      </button>
    </div>
  )
}
