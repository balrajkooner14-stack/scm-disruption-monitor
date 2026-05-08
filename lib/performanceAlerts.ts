export interface PerformanceAlert {
  id: string
  supplierId: string
  supplierName: string
  supplierCountry: string
  metric: "onTimeDelivery" | "qualityScore" | "leadTime"
  previousValue: number
  currentValue: number
  threshold: number
  direction: "below"
  message: string
  createdAt: string
  dismissed: boolean
  dismissedAt?: string
}

const STORAGE_KEY = "scm_performance_alerts"
const DEFAULT_OTD_THRESHOLD = 85
const DEFAULT_QUALITY_THRESHOLD = 75

export function loadAlerts(): PerformanceAlert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export function saveAlerts(alerts: PerformanceAlert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  } catch {}
}

export function dismissAlert(alertId: string): void {
  const alerts = loadAlerts()
  const updated = alerts.map(a =>
    a.id === alertId
      ? { ...a, dismissed: true, dismissedAt: new Date().toISOString() }
      : a
  )
  saveAlerts(updated)
}

export function getActiveAlerts(): PerformanceAlert[] {
  return loadAlerts().filter(a => !a.dismissed)
}

export function checkAndCreateAlerts(
  supplierId: string,
  supplierName: string,
  supplierCountry: string,
  previousOTD: number | null,
  currentOTD: number,
  previousQuality: number | null,
  currentQuality: number,
  otdThreshold: number = DEFAULT_OTD_THRESHOLD,
  qualityThreshold: number = DEFAULT_QUALITY_THRESHOLD
): PerformanceAlert[] {
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
    const existing = loadAlerts()
    const existingIds = new Set(existing.map(a => a.id))
    const toAdd = newAlerts.filter(a => !existingIds.has(a.id))
    if (toAdd.length > 0) {
      saveAlerts([...toAdd, ...existing])
    }
  }

  return newAlerts
}
