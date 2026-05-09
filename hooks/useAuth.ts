"use client"
import { useState, useEffect, useMemo } from "react"
import { User, Session } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase"

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    const SCM_STORAGE_KEYS = [
      "scm_company_profile",
      "scm_supplier_health",
      "scm_inventory_log",
      "scm_disruption_history",
      "scm_active_tab",
      "scm_performance_alerts",
      "scm_lead_time_history",
      "scm_last_visit",
      "scm_prompt_dismissed",
    ]
    SCM_STORAGE_KEYS.forEach(key => {
      try { localStorage.removeItem(key) } catch {}
    })
  }

  return { user, session, isLoading, signOut }
}
