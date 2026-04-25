"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { PROFILE_STORAGE_KEY } from "@/lib/profile"

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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center">
      <div className="max-w-md w-full mx-4 mt-32 bg-slate-800 rounded-xl border border-slate-700 p-8">
        <div className="text-4xl mb-4">🏭</div>
        <h2 className="text-xl font-bold text-white">Get Personalized Intelligence</h2>
        <p className="text-slate-400 text-sm mt-2">
          Tell us about your supply chain and we&apos;ll show you disruptions that actually
          affect your business — not just global news that may be irrelevant to you.
        </p>

        <div className="flex gap-3 mt-6">
          <Link
            href="/profile"
            className="flex-1 text-center bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            Set Up My Profile →
          </Link>
          <button
            onClick={dismiss}
            className="text-slate-400 hover:text-slate-200 text-sm px-4 py-2.5 rounded-lg border border-slate-600 hover:border-slate-400 transition-colors"
          >
            Skip for now
          </button>
        </div>

        <p className="text-xs text-slate-500 mt-4">
          ⚡ Takes 5 minutes · Stored locally in your browser · No account required
        </p>
      </div>
    </div>
  )
}
