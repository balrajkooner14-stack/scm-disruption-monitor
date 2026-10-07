"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PROFILE_STORAGE_KEY } from "@/lib/profile"
import Logo from "@/components/ui/Logo"
import { ui } from "@/lib/ui"

const SESSION_KEY = "profileModalDismissed"

export default function ProfilePromptModal() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(SESSION_KEY)
      const hasProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (!dismissed && !hasProfile) {
        setVisible(true)
      }
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
    setVisible(false)
  }

  if (!visible) return null

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

        <div className="flex items-center gap-3 pt-1">
          <Link href="/profile" className={ui.btnAccent}>
            Set up your profile
          </Link>
          <button onClick={dismiss} className={ui.btnGhost}>
            Not now
          </button>
        </div>

        <p className="text-xs text-ink-3">
          Takes 5 minutes · Stored locally in your browser · No account required
        </p>
      </div>
    </div>
  )
}
