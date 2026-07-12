"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { Supplier } from "@/lib/profile"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import {
  SupplierHealthEntry,
  SupplierHealthScore,
  calculateCompositeScore,
  getGrade,
} from "@/lib/supplierHealth"

const STORAGE_KEY = "scm_supplier_health"

function loadLocalEntries(): Record<string, SupplierHealthEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveLocalEntries(entries: Record<string, SupplierHealthEntry>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

function rowToEntry(row: {
  supplier_id: string
  supplier_name: string | null
  on_time_delivery_rate: number | null
  quality_score: number | null
  last_shipment_delay_days: number | null
  notes: string | null
  updated_at: string | null
}): SupplierHealthEntry {
  return {
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    onTimeDeliveryRate: Number(row.on_time_delivery_rate ?? 0),
    qualityScore: Number(row.quality_score ?? 0),
    lastShipmentDelayDays: row.last_shipment_delay_days ?? 0,
    notes: row.notes ?? "",
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

function entryToRow(entry: SupplierHealthEntry, userId: string) {
  return {
    user_id: userId,
    supplier_id: entry.supplierId,
    supplier_name: entry.supplierName,
    on_time_delivery_rate: entry.onTimeDeliveryRate,
    quality_score: entry.qualityScore,
    last_shipment_delay_days: entry.lastShipmentDelayDays,
    notes: entry.notes,
    updated_at: entry.updatedAt,
  }
}

function buildScores(
  suppliers: Supplier[],
  entries: Record<string, SupplierHealthEntry>
): SupplierHealthScore[] {
  return suppliers.map(supplier => {
    const entry = entries[supplier.id]

    if (!entry) {
      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        compositeScore: 0,
        grade: "Fair" as const,
        gradeColor: "text-slate-400",
        gradeBg: "bg-slate-800",
        gradeBorder: "border-slate-700",
        onTimeDeliveryRate: 0,
        qualityScore: 0,
        lastShipmentDelayDays: 0,
        notes: "",
        updatedAt: "",
        hasData: false,
      }
    }

    const compositeScore = calculateCompositeScore(entry)
    const gradeInfo = getGrade(compositeScore)

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      compositeScore,
      ...gradeInfo,
      onTimeDeliveryRate: entry.onTimeDeliveryRate,
      qualityScore: entry.qualityScore,
      lastShipmentDelayDays: entry.lastShipmentDelayDays,
      notes: entry.notes,
      updatedAt: entry.updatedAt,
      hasData: true,
    }
  })
}

export function useSupplierHealth(suppliers: Supplier[]) {
  const { user, isLoading: authLoading } = useAuth()
  const [entries, setEntries] = useState<Record<string, SupplierHealthEntry>>({})
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function load() {
      if (user) {
        try {
          const { data, error } = await supabase
            .from("supplier_health")
            .select("*")
            .eq("user_id", user.id)

          if (error) throw error

          // First-login migration: bulk-copy any existing guest data once,
          // then never touch the localStorage key again for this user.
          if ((data?.length ?? 0) === 0) {
            const local = loadLocalEntries()
            const localList = Object.values(local)
            if (localList.length > 0) {
              const rows = localList.map(e => entryToRow(e, user.id))
              const { error: migrateError } = await supabase
                .from("supplier_health")
                .upsert(rows, { onConflict: "user_id,supplier_id" })
              if (!migrateError) {
                localStorage.removeItem(STORAGE_KEY)
                if (!cancelled) setEntries(local)
                if (!cancelled) setIsLoaded(true)
                return
              }
            }
          }

          const loaded: Record<string, SupplierHealthEntry> = {}
          ;(data ?? []).forEach(row => {
            loaded[row.supplier_id] = rowToEntry(row)
          })
          if (!cancelled) setEntries(loaded)
        } catch {
          if (!cancelled) setEntries({})
        }
      } else {
        setEntries(loadLocalEntries())
      }
      if (!cancelled) setIsLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, supabase])

  const saveEntry = useCallback(
    async (entry: SupplierHealthEntry): Promise<boolean> => {
      if (user) {
        try {
          const { error } = await supabase
            .from("supplier_health")
            .upsert(entryToRow(entry, user.id), { onConflict: "user_id,supplier_id" })
          if (error) return false
          setEntries(prev => ({ ...prev, [entry.supplierId]: entry }))
          return true
        } catch {
          return false
        }
      } else {
        const updated = { ...loadLocalEntries(), [entry.supplierId]: entry }
        saveLocalEntries(updated)
        setEntries(updated)
        return true
      }
    },
    [user, supabase]
  )

  const scores = useMemo(() => buildScores(suppliers, entries), [suppliers, entries])

  return { scores, entries, saveEntry, isLoaded }
}
