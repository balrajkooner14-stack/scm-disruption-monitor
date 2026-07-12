"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { PerformanceAlert } from "@/lib/performanceAlerts"

const STORAGE_KEY = "scm_performance_alerts"
const DEFAULT_OTD_THRESHOLD = 85
const DEFAULT_QUALITY_THRESHOLD = 75

function loadLocalAlerts(): PerformanceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveLocalAlerts(alerts: PerformanceAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  } catch {}
}

function rowToAlert(row: {
  id: string
  supplier_id: string
  supplier_name: string | null
  supplier_country: string | null
  metric: string | null
  previous_value: number | null
  current_value: number | null
  threshold: number | null
  message: string | null
  created_at: string | null
  dismissed: boolean | null
  dismissed_at: string | null
}): PerformanceAlert {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    supplierName: row.supplier_name ?? "",
    supplierCountry: row.supplier_country ?? "",
    metric: (row.metric ?? "onTimeDelivery") as PerformanceAlert["metric"],
    previousValue: Number(row.previous_value ?? 0),
    currentValue: Number(row.current_value ?? 0),
    threshold: Number(row.threshold ?? 0),
    direction: "below",
    message: row.message ?? "",
    createdAt: row.created_at ?? new Date().toISOString(),
    dismissed: row.dismissed ?? false,
    dismissedAt: row.dismissed_at ?? undefined,
  }
}

function alertToRow(alert: PerformanceAlert, userId: string) {
  return {
    id: alert.id,
    user_id: userId,
    supplier_id: alert.supplierId,
    supplier_name: alert.supplierName,
    supplier_country: alert.supplierCountry,
    metric: alert.metric,
    previous_value: alert.previousValue,
    current_value: alert.currentValue,
    threshold: alert.threshold,
    direction: alert.direction,
    message: alert.message,
    created_at: alert.createdAt,
    dismissed: alert.dismissed,
    dismissed_at: alert.dismissedAt ?? null,
  }
}

export function usePerformanceAlerts() {
  const { user, isLoading: authLoading } = useAuth()
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const load = useCallback(async () => {
    if (user) {
      try {
        const { data, error } = await supabase
          .from("performance_alerts")
          .select("*")
          .eq("user_id", user.id)

        if (error) throw error

        // First-login migration: bulk-copy any existing guest data once.
        if ((data?.length ?? 0) === 0) {
          const local = loadLocalAlerts()
          if (local.length > 0) {
            const rows = local.map(a => alertToRow(a, user.id))
            const { error: migrateError } = await supabase
              .from("performance_alerts")
              .upsert(rows, { onConflict: "id" })
            if (!migrateError) {
              localStorage.removeItem(STORAGE_KEY)
              setAlerts(local)
              setIsLoaded(true)
              return
            }
          }
        }

        setAlerts((data ?? []).map(rowToAlert))
      } catch {
        setAlerts([])
      }
    } else {
      // Functional form: defers the localStorage read to when React actually
      // applies this update, so it doesn't race ahead of an in-flight write
      // queued just before it (e.g. persistAlerts dispatching this same event).
      setAlerts(() => loadLocalAlerts())
    }
    setIsLoaded(true)
  }, [user, supabase])

  useEffect(() => {
    if (authLoading) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user])

  useEffect(() => {
    window.addEventListener("performanceAlertCreated", load)
    return () => window.removeEventListener("performanceAlertCreated", load)
  }, [load])

  const persistAlerts = useCallback(
    async (newAlerts: PerformanceAlert[]): Promise<void> => {
      if (newAlerts.length === 0) return
      if (user) {
        try {
          const rows = newAlerts.map(a => alertToRow(a, user.id))
          const { error } = await supabase
            .from("performance_alerts")
            .upsert(rows, { onConflict: "id" })
          if (error) return
        } catch {
          return
        }
        setAlerts(prev => [...newAlerts, ...prev])
      } else {
        setAlerts(prev => {
          const merged = [...newAlerts, ...prev]
          saveLocalAlerts(merged)
          return merged
        })
      }
      window.dispatchEvent(new Event("performanceAlertCreated"))
    },
    [user, supabase]
  )

  const dismiss = useCallback(
    async (alertId: string): Promise<void> => {
      const dismissedAt = new Date().toISOString()
      if (user) {
        try {
          const { error } = await supabase
            .from("performance_alerts")
            .update({ dismissed: true, dismissed_at: dismissedAt })
            .eq("id", alertId)
            .eq("user_id", user.id)
          if (error) return
        } catch {
          return
        }
      }
      setAlerts(prev => {
        const updated = prev.map(a =>
          a.id === alertId ? { ...a, dismissed: true, dismissedAt } : a
        )
        if (!user) saveLocalAlerts(updated)
        return updated
      })
    },
    [user, supabase]
  )

  const checkAndCreate = useCallback(
    async (
      supplierId: string,
      supplierName: string,
      supplierCountry: string,
      previousOTD: number | null,
      currentOTD: number,
      previousQuality: number | null,
      currentQuality: number,
      otdThreshold: number = DEFAULT_OTD_THRESHOLD,
      qualityThreshold: number = DEFAULT_QUALITY_THRESHOLD
    ): Promise<PerformanceAlert[]> => {
      const newAlerts: PerformanceAlert[] = []
      const today = new Date().toISOString().split("T")[0]

      if (currentOTD < otdThreshold) {
        const wasPreviouslyOk = previousOTD === null || previousOTD >= otdThreshold
        if (wasPreviouslyOk) {
          newAlerts.push({
            id: `${supplierId}-otd-${today}`,
            supplierId,
            supplierName,
            supplierCountry,
            metric: "onTimeDelivery",
            previousValue: previousOTD ?? currentOTD,
            currentValue: currentOTD,
            threshold: otdThreshold,
            direction: "below",
            message: `${supplierName} on-time delivery dropped to ${currentOTD}% — below your ${otdThreshold}% threshold. Contact this supplier to understand delays and request a corrective action plan.`,
            createdAt: new Date().toISOString(),
            dismissed: false,
          })
        }
      }

      if (currentQuality < qualityThreshold) {
        const wasPreviouslyOk = previousQuality === null || previousQuality >= qualityThreshold
        if (wasPreviouslyOk) {
          newAlerts.push({
            id: `${supplierId}-quality-${today}`,
            supplierId,
            supplierName,
            supplierCountry,
            metric: "qualityScore",
            previousValue: previousQuality ?? currentQuality,
            currentValue: currentQuality,
            threshold: qualityThreshold,
            direction: "below",
            message: `${supplierName} quality score dropped to ${currentQuality}% — below your ${qualityThreshold}% threshold. Review recent shipments and issue a formal quality improvement request.`,
            createdAt: new Date().toISOString(),
            dismissed: false,
          })
        }
      }

      if (newAlerts.length > 0) {
        const existingIds = new Set(alerts.map(a => a.id))
        const toAdd = newAlerts.filter(a => !existingIds.has(a.id))
        if (toAdd.length > 0) {
          await persistAlerts(toAdd)
        }
      }

      return newAlerts
    },
    [alerts, persistAlerts]
  )

  const activeAlerts = useMemo(() => alerts.filter(a => !a.dismissed), [alerts])

  return { alerts, activeAlerts, isLoaded, dismiss, checkAndCreate, persistAlerts }
}
