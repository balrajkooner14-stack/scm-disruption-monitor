"use client"
import { useState, useEffect } from "react"
import { CompanyProfile, PROFILE_STORAGE_KEY } from "@/lib/profile"

export function useCompanyProfile() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (stored) {
        setProfile(JSON.parse(stored))
      }
    } catch (e) {
      console.error("Failed to load profile:", e)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  const saveProfile = (newProfile: CompanyProfile) => {
    try {
      const updated = {
        ...newProfile,
        updatedAt: new Date().toISOString(),
      }
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updated))
      setProfile(updated)
      return true
    } catch (e) {
      console.error("Failed to save profile:", e)
      return false
    }
  }

  const clearProfile = () => {
    try {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
      setProfile(null)
    } catch (e) {
      console.error("Failed to clear profile:", e)
    }
  }

  return { profile, saveProfile, clearProfile, isLoaded }
}
