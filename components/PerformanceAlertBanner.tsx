"use client"

import { usePerformanceAlerts } from "@/hooks/usePerformanceAlerts"
import { ui } from "@/lib/ui"

export default function PerformanceAlertBanner() {
  const { activeAlerts: alerts, dismiss } = usePerformanceAlerts()

  if (alerts.length === 0) return null

  return (
    <div className="space-y-3">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="flex flex-col md:flex-row md:items-center justify-between gap-5 rounded-xl border border-line bg-surface px-5 py-4"
        >
          <div className="min-w-0 space-y-0.5">
            <p className="font-semibold text-ink flex flex-wrap items-center gap-2">
              <span className={`${ui.chip} ${ui.chipWarning}`}>
                {alert.metric === "onTimeDelivery"
                  ? "ON-TIME DELIVERY"
                  : alert.metric === "qualityScore"
                  ? "QUALITY"
                  : "LEAD TIME"}
              </span>
              <span>{alert.supplierName} ({alert.supplierCountry})</span>
            </p>
            <p className="text-sm text-ink-2">{alert.message}</p>
            <p className={ui.meta}>
              Logged {new Date(alert.createdAt).toLocaleDateString()} · Update it in Advisor → Supplier health
            </p>
          </div>

          <button
            onClick={() => dismiss(alert.id)}
            aria-label="Dismiss"
            title="Dismiss this alert"
            className="self-start md:self-center rounded-lg p-2 text-ink-3 transition-colors hover:text-ink flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
          </button>
        </div>
      ))}
    </div>
  )
}
