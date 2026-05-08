"use client"
import { useState, useEffect, useMemo } from "react"
import { CompanyProfile, PROFILE_STORAGE_KEY } from "@/lib/profile"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"

export function useCompanyProfile() {
  const { user, isLoading: authLoading } = useAuth()
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  // saveProfile defined before loadProfile — loadProfile calls it for auto-migration
  const saveProfile = async (newProfile: CompanyProfile): Promise<boolean> => {
    const updated = { ...newProfile, updatedAt: new Date().toISOString() }

    if (user) {
      try {
        const { error } = await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            company_name: updated.companyName,
            sector: updated.sector,
            revenue_range: updated.revenueRange,
            primary_markets: updated.primaryMarkets,
            suppliers: updated.suppliers,
            product_lines: updated.productLines,
            pain_points: updated.painPoints,
            transport_modes: updated.transportModes,
            trade_lanes: updated.tradeLanes,
            updated_at: updated.updatedAt,
          })

        if (!error) {
          setProfile(updated)
          localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated))
          return true
        }
        return false
      } catch {
        return false
      }
    } else {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated))
      setProfile(updated)
      return true
    }
  }

  const loadProfile = async () => {
    if (user) {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (data && !error) {
          const loaded: CompanyProfile = {
            companyName: data.company_name ?? "",
            sector: data.sector ?? "Other",
            revenueRange: data.revenue_range ?? "$0–$10M",
            primaryMarkets: data.primary_markets ?? [],
            suppliers: data.suppliers ?? [],
            productLines: data.product_lines ?? [],
            painPoints: data.pain_points ?? [],
            transportModes: data.transport_modes ?? [],
            tradeLanes: data.trade_lanes ?? [],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          }
          setProfile(loaded)
        } else {
          // No Supabase profile yet — auto-migrate from localStorage on first login
          const localRaw = localStorage.getItem(PROFILE_STORAGE_KEY)
          if (localRaw) {
            const localProfile = JSON.parse(localRaw) as CompanyProfile
            await saveProfile(localProfile)
          } else {
            setProfile(null)
          }
        }
      } catch {
        setProfile(null)
      }
    } else {
      try {
        const raw = localStorage.getItem(PROFILE_STORAGE_KEY)
        setProfile(raw ? JSON.parse(raw) : null)
      } catch {
        setProfile(null)
      }
    }
    setIsLoaded(true)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (authLoading) return
    loadProfile()
  }, [user, authLoading])

  const clearProfile = async () => {
    if (user) {
      await supabase.from("profiles").delete().eq("id", user.id)
    }
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    setProfile(null)
  }

  return { profile, saveProfile, clearProfile, isLoaded }
}
