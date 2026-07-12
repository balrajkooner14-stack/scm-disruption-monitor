"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { LeadTimeEntry, LeadTimeHistory } from "@/lib/leadTimeHistory"

const STORAGE_KEY = "scm_lead_time_history"
const MAX_ENTRIES_PER_SUPPLIER = 12

function loadLocalHistory(): LeadTimeHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveLocalHistory(history: LeadTimeHistory): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {}
}

function rowToEntry(row: {
  supplier_id: string
  supplier_name: string | null
  lead_time_days: number
  recorded_at: string | null
}): LeadTimeEntry {
  return {
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    leadTimeDays: row.lead_time_days,
    recordedAt: row.recorded_at ?? new Date().toISOString(),
  }
}

function entryToRow(entry: LeadTimeEntry, userId: string) {
  return {
    user_id: userId,
    supplier_id: entry.supplierId,
    supplier_name: entry.supplierName,
    lead_time_days: entry.leadTimeDays,
    recorded_at: entry.recordedAt,
  }
}

function capHistory(history: LeadTimeHistory): LeadTimeHistory {
  const capped: LeadTimeHistory = {}
  Object.entries(history).forEach(([supplierId, entries]) => {
    capped[supplierId] = entries.slice(-MAX_ENTRIES_PER_SUPPLIER)
  })
  return capped
}

export function useLeadTimeHistory() {
  const { user, isLoading: authLoading } = useAuth()
  const [history, setHistory] = useState<LeadTimeHistory>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function load() {
      if (user) {
        try {
          const { data, error } = await supabase
            .from("lead_time_history")
            .select("*")
            .eq("user_id", user.id)
            .order("recorded_at", { ascending: true })

          if (error) throw error

          // First-login migration: bulk-copy any existing guest data once.
          if ((data?.length ?? 0) === 0) {
            const local = loadLocalHistory()
            const allLocalEntries = Object.values(local).flat()
            if (allLocalEntries.length > 0) {
              const rows = allLocalEntries.map(e => entryToRow(e, user.id))
              const { error: migrateError } = await supabase
                .from("lead_time_history")
                .insert(rows)
              if (!migrateError) {
                localStorage.removeItem(STORAGE_KEY)
                if (!cancelled) setHistory(capHistory(local))
                if (!cancelled) setIsLoaded(true)
                return
              }
            }
          }

          const grouped: LeadTimeHistory = {}
          ;(data ?? []).forEach(row => {
            const entry = rowToEntry(row)
            if (!grouped[entry.supplierId]) grouped[entry.supplierId] = []
            grouped[entry.supplierId].push(entry)
          })
          if (!cancelled) setHistory(capHistory(grouped))
        } catch {
          if (!cancelled) setHistory({})
        }
      } else {
        setHistory(loadLocalHistory())
      }
      if (!cancelled) setIsLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, supabase])

  const recordEntry = useCallback(
    async (
      supplierId: string,
      supplierName: string,
      leadTimeDays: number
    ): Promise<LeadTimeEntry[]> => {
      const existing = history[supplierId] ?? []
      const today = new Date().toISOString().split("T")[0]
      const lastEntry = existing[existing.length - 1]
      if (lastEntry) {
        const lastDate = lastEntry.recordedAt.split("T")[0]
        if (lastDate === today && lastEntry.leadTimeDays === leadTimeDays) {
          return existing
        }
      }

      const newEntry: LeadTimeEntry = {
        supplierId,
        supplierName,
        leadTimeDays,
        recordedAt: new Date().toISOString(),
      }

      if (user) {
        try {
          const { error } = await supabase
            .from("lead_time_history")
            .insert(entryToRow(newEntry, user.id))
          if (error) return existing
        } catch {
          return existing
        }
      }

      const updatedSupplierHistory = [...existing, newEntry].slice(-MAX_ENTRIES_PER_SUPPLIER)
      setHistory(prev => {
        const updated = { ...prev, [supplierId]: updatedSupplierHistory }
        if (!user) saveLocalHistory(updated)
        return updated
      })
      return updatedSupplierHistory
    },
    [user, supabase, history]
  )

  return { history, recordEntry, isLoaded }
}
