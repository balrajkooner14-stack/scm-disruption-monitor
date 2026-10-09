"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useOnboardingExtras } from "@/hooks/useOnboardingExtras"
import { isDemoMode } from "@/lib/demoMode"
import { EXTRAS_STORAGE_KEY } from "@/lib/onboarding"
import { PROFILE_STORAGE_KEY } from "@/lib/profile"
import { CARRYOVER_DISMISSED_PREFIX, decideCarryOver, type CarryOverDecision } from "@/lib/guestCarryOver"
import { ui } from "@/lib/ui"

// One-time offer to move a guest setup into a newly signed-in account that
// has no profile (v5.1). Shown on /onboarding and the dashboard; only an
// explicit "Bring it over" copies anything.

function readStorage(): {
  guestProfileRaw: string | null
  guestExtrasRaw: string | null
  accountCachesRaw: string[]
} {
  try {
    const caches = Object.keys(localStorage)
      .filter(k => k.startsWith("scm_profile_"))
      .map(k => localStorage.getItem(k))
      .filter((v): v is string => v !== null)
    return {
      guestProfileRaw: localStorage.getItem(PROFILE_STORAGE_KEY),
      guestExtrasRaw: localStorage.getItem(EXTRAS_STORAGE_KEY),
      accountCachesRaw: caches,
    }
  } catch {
    return { guestProfileRaw: null, guestExtrasRaw: null, accountCachesRaw: [] }
  }
}

export default function GuestCarryOverPrompt() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { profile, isLoaded, saveProfile } = useCompanyProfile()
  const { saveExtras } = useOnboardingExtras()
  const [decision, setDecision] = useState<CarryOverDecision>({ kind: "none" })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !isLoaded || isDemoMode()) return
    let dismissed = false
    try {
      dismissed = !!user && localStorage.getItem(`${CARRYOVER_DISMISSED_PREFIX}${user.id}`) === "1"
    } catch {}
    setDecision(
      decideCarryOver({
        signedIn: !!user,
        accountHasProfile: !!profile,
        dismissed,
        ...readStorage(),
      }),
    )
  }, [authLoading, isLoaded, user, profile])

  if (decision.kind !== "prompt" || !user) return null

  const bringOver = async () => {
    setBusy(true)
    setError(null)
    const saved = await saveProfile(decision.profile)
    const extrasSaved = saved && (!decision.extras || (await saveExtras(decision.extras)))
    if (!saved || !extrasSaved) {
      setBusy(false)
      setError("We couldn't bring it over. Your setup is still saved in this browser.")
      return
    }
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
      localStorage.removeItem(EXTRAS_STORAGE_KEY)
    } catch {}
    router.push("/")
    router.refresh()
  }

  const startFresh = () => {
    // Remember the choice for this account; the guest copy stays untouched.
    try {
      localStorage.setItem(`${CARRYOVER_DISMISSED_PREFIX}${user.id}`, "1")
    } catch {}
    setDecision({ kind: "none" })
  }

  const s = decision.profile.suppliers.length
  const p = decision.profile.productLines.length

  return (
    <section
      aria-label="Bring over your setup"
      className="flex flex-col gap-3 rounded-xl border border-line bg-surface px-5 py-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-ink">Bring over the setup you started for {decision.companyName.replace(/\.+$/, "")}?</p>
          <p className="text-sm text-ink-2">
            {s} supplier{s === 1 ? "" : "s"}
            {p > 0 ? ` and ${p} product line${p === 1 ? "" : "s"}` : ""} saved in this browser before you signed in.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={bringOver} disabled={busy} className={`${ui.btnPrimary} py-2.5`}>
            {busy ? "Bringing it over…" : "Bring it over"}
          </button>
          <button type="button" onClick={startFresh} disabled={busy} className={ui.btnGhost}>
            Start fresh
          </button>
        </div>
      </div>
      {error && <p className={ui.errorBox} role="alert">{error}</p>}
    </section>
  )
}
