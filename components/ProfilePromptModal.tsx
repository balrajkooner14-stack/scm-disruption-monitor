"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { enterDemoMode, isDemoMode } from "@/lib/demoMode"
import { ui } from "@/lib/ui"

const SESSION_KEY = "profileModalDismissed"

export default function ProfilePromptModal() {
  // Whether a profile exists comes from the hook, not the guest localStorage
  // key: signed-in profiles live in Supabase, and since v5.1 a leftover guest
  // copy can sit in that key for an account that has no profile yet.
  const { profile, isLoaded } = useCompanyProfile()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(!!sessionStorage.getItem(SESSION_KEY) || isDemoMode())
    } catch {
      // storage unavailable — don't show
    }
  }, [])

  function dismiss() {
    try {
      sessionStorage.setItem(SESSION_KEY, "true")
    } catch {
      // ignore
    }
    setDismissed(true)
  }

  if (!isLoaded || profile || dismissed) return null

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-start justify-center px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-prompt-title"
        className="max-w-md w-full mt-32 bg-paper-raised border border-line rounded-xl shadow-xl p-7 space-y-4"
      >
        <Logo />
        <h2 id="profile-prompt-title" className={ui.h2}>Make this dashboard yours</h2>
        <p className={ui.body}>
          Tell us about your supply chain and we&apos;ll show you disruptions that actually
          affect your business — not just global news that may be irrelevant to you.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href="/onboarding" className={ui.btnAccent}>
            Set up in 4 minutes
          </Link>
          <button
            type="button"
            onClick={() => {
              enterDemoMode()
              window.location.assign("/")
            }}
            className={ui.btnGhost}
          >
            Look around a sample company
          </button>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink-3">No account required to try it.</p>
          <button type="button" onClick={dismiss} className={`${ui.btnGhost} text-xs`}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
