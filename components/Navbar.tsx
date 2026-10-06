"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useAuth } from "@/hooks/useAuth"
import Logo from "@/components/ui/Logo"
import { ui } from "@/lib/ui"

const AI_STATUS = {
  live: { dot: "bg-moss", label: "AI live" },
  cached: { dot: "bg-[#C4973B]", label: "AI cached" },
  error: { dot: "bg-ember", label: "AI recovering" },
} as const

export default function Navbar() {
  // null until mounted: the page is prerendered, so a server-side clock
  // would never match the client's and cause a hydration mismatch.
  const [now, setNow] = useState<Date | null>(null)
  const [aiStatus, setAiStatus] = useState<"live" | "cached" | "error">("live")
  const { profile, isLoaded } = useCompanyProfile()
  const { user, signOut } = useAuth()

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      setAiStatus((e as CustomEvent<"live" | "cached" | "error">).detail)
    }
    window.addEventListener("ai-status-change", handler)
    return () => window.removeEventListener("ai-status-change", handler)
  }, [])

  // "Tue, Oct 6 · 4:10 PM"
  const clockStr = now
    ? `${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
    : ""

  const status = AI_STATUS[aiStatus]

  return (
    <nav className="sticky top-0 z-50 h-[72px] bg-paper-raised border-b border-line">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left: logo + profile */}
        <div className="flex items-center gap-5 min-w-0">
          <Link href="/" className="flex-shrink-0" aria-label="Home">
            <Logo />
          </Link>
          <div className="h-6 w-px bg-line flex-shrink-0" aria-hidden="true" />
          {isLoaded && (
            profile ? (
              <Link href="/profile" className={`${ui.btnSecondary} max-w-xs overflow-hidden`}>
                <span className="truncate">{profile.companyName}</span>
              </Link>
            ) : (
              <Link href="/profile" className={ui.btnSecondary.replace("text-ink", "text-ember")}>
                Set up your profile
              </Link>
            )
          )}
        </div>

        {/* Right: AI status, clock, auth */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <span className="flex items-center gap-2 text-[13px] text-ink-2">
            <span className={`h-2 w-2 rounded-full ${status.dot}`} aria-hidden="true" />
            {status.label}
          </span>

          <span className="hidden sm:block text-[13px] text-ink-3 tabular-nums">
            {clockStr}
          </span>

          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <span className="text-[13px] text-ink-3">{user.email?.split("@")[0]}</span>
              <button onClick={signOut} className={ui.btnGhost}>
                Sign out
              </button>
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2">
              <Link href="/login" className={ui.btnSecondary}>
                Sign in
              </Link>
              <Link href="/signup" className={ui.btnPrimary}>
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
