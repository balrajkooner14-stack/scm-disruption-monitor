"use client"

import { useEffect, useState } from "react"
import { exitDemoMode, isDemoMode } from "@/lib/demoMode"
import { ui } from "@/lib/ui"

// Top of the dashboard while exploring the sample company (spec 4.7).

export default function DemoBanner() {
  // Read after mount: sessionStorage doesn't exist during prerender.
  const [demo, setDemo] = useState(false)
  useEffect(() => {
    setDemo(isDemoMode())
  }, [])

  if (!demo) return null

  return (
    <section
      aria-label="Sample company"
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface px-5 py-3"
    >
      <p className="text-sm text-ink">
        You&apos;re exploring a sample company, Meridian Electronics. Nothing here is saved.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            exitDemoMode()
            window.location.assign("/onboarding")
          }}
          className={ui.btnPrimary}
        >
          Set up my company
        </button>
        <button
          type="button"
          onClick={() => {
            exitDemoMode()
            window.location.assign("/")
          }}
          className={ui.btnGhost}
        >
          Exit sample
        </button>
      </div>
    </section>
  )
}
