"use client"

import { usePerformanceAlerts } from "@/hooks/usePerformanceAlerts"

export default function PerformanceAlertBanner() {
  const { activeAlerts: alerts, dismiss } = usePerformanceAlerts()

  if (alerts.length === 0) return null

  return (
    <div className="space-y-2 mb-4">
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="flex items-start gap-3 bg-amber-950 border border-amber-700 rounded-xl px-4 py-3"
        >
          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center mt-0.5">
            <span className="text-white text-xs font-bold">!</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-300 mb-0.5">
              {alert.metric === "onTimeDelivery"
                ? "On-Time Delivery Alert"
                : alert.metric === "qualityScore"
                ? "Quality Score Alert"
                : "Lead Time Alert"}
              {" "}— {alert.supplierName} ({alert.supplierCountry})
            </p>
            <p className="text-xs text-amber-400 leading-relaxed">
              {alert.message}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Logged {new Date(alert.createdAt).toLocaleDateString()} ·{" "}
              Go to Advisor tab → Supplier Health Scorecard to update
            </p>
          </div>

          <button
            onClick={() => dismiss(alert.id)}
            className="flex-shrink-0 text-amber-600 hover:text-amber-400 text-lg leading-none transition-colors px-1"
            title="Dismiss this alert"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
