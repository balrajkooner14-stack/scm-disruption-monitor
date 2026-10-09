"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { EMPTY_EXTRAS, EXTRAS_STORAGE_KEY, type OnboardingExtras } from "@/lib/onboarding"

// OnboardingExtras storage, same pattern as useCompanyProfile: Supabase
// (profiles.onboarding) when signed in, localStorage (scm_onboarding) for
// guests. The column lives on the profiles row, so a profile must be saved
// before the extras: saveExtras() returns false when no row exists yet.

function loadLocal(): OnboardingExtras | null {
  try {
    const raw = localStorage.getItem(EXTRAS_STORAGE_KEY)
    return raw ? ({ ...EMPTY_EXTRAS, ...JSON.parse(raw) } as OnboardingExtras) : null
  } catch {
    return null
  }
}

function saveLocal(extras: OnboardingExtras): boolean {
  try {
    localStorage.setItem(EXTRAS_STORAGE_KEY, JSON.stringify(extras))
    return true
  } catch {
    return false
  }
}

const isEmpty = (v: unknown) => !v || (typeof v === "object" && Object.keys(v as object).length === 0)

export function useOnboardingExtras() {
  const { user, isLoading: authLoading } = useAuth()
  const supabase = useMemo(() => createClient(), [])
  // null = nothing stored yet (existing users from before v5.1).
  const [extras, setExtras] = useState<OnboardingExtras | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const extrasRef = useRef<OnboardingExtras | null>(null)
  extrasRef.current = extras

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    const load = async () => {
      if (!user) {
        const local = loadLocal()
        if (!cancelled) setExtras(local)
      } else {
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select("onboarding")
            .eq("id", user.id)
            .maybeSingle()
          let loaded: OnboardingExtras | null =
            !error && data && !isEmpty(data.onboarding)
              ? ({ ...EMPTY_EXTRAS, ...(data.onboarding as object) } as OnboardingExtras)
              : null

          // First sign-in after guest onboarding: copy scm_onboarding into the
          // row once, then drop the local copy. Only when the row exists and
          // its column is still empty, so account data is never overwritten.
          if (!error && data && !loaded) {
            const local = loadLocal()
            if (local) {
              const { error: migrateError } = await supabase
                .from("profiles")
                .update({ onboarding: local })
                .eq("id", user.id)
              if (!migrateError) {
                loaded = local
                try { localStorage.removeItem(EXTRAS_STORAGE_KEY) } catch {}
              }
            }
          }
          if (!cancelled) setExtras(loaded)
        } catch {
          if (!cancelled) setExtras(null)
        }
      }
      if (!cancelled) setIsLoaded(true)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, supabase])

  /** Merge `partial` into the stored extras and persist. */
  const saveExtras = useCallback(
    async (partial: Partial<OnboardingExtras>): Promise<boolean> => {
      const next: OnboardingExtras = { ...EMPTY_EXTRAS, ...(extrasRef.current ?? {}), ...partial, version: 1 }
      if (!user) {
        const ok = saveLocal(next)
        if (ok) setExtras(next)
        return ok
      }
      try {
        const { data, error } = await supabase
          .from("profiles")
          .update({ onboarding: next })
          .eq("id", user.id)
          .select("id")
        if (error || !data || data.length === 0) return false
        setExtras(next)
        return true
      } catch {
        return false
      }
    },
    [user, supabase],
  )

  return { extras, saveExtras, isLoaded }
}
