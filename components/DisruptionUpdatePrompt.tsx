"use client"

import { useState, useEffect } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { SupplyRegion } from "@/lib/profile"
import Link from "next/link"
import { ui } from "@/lib/ui"

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
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 rounded-xl border border-line bg-surface px-5 py-4">
      <div className="min-w-0 space-y-0.5">
        <p className="font-semibold text-ink">
          {newEventCount} new disruption{newEventCount > 1 ? "s" : ""} in your supplier regions since your last visit
        </p>
        {affectedSuppliers.length > 0 && (
          <p className="text-sm text-ink-2">
            Potentially affected: {affectedSuppliers.join(", ")}
          </p>
        )}
        <p className="text-sm text-ink-2">
          Have lead times or delivery schedules changed? Current data keeps your risk scores accurate.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Link href="/profile" className={ui.btnSecondary}>
          Update supplier data
        </Link>
        <button
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("switchTab", { detail: "advisor" })
            )
            handleDismiss()
          }}
          className={ui.btnGhost}
        >
          Review recommendations
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss"
          title="Dismiss for today"
          className="rounded-lg p-2 text-ink-3 transition-colors hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
