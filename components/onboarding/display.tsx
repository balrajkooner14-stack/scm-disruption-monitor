import type { DisruptionEvent } from "@/lib/types"
import { ui } from "@/lib/ui"

// Small display pieces shared by the onboarding panels.

/** Severity as a word in a chip (First Light rule): 3 Critical, 2 Warning, 1 Monitor. */
export function SeverityChip({ severity }: { severity: DisruptionEvent["severity"] }) {
  const [label, tone] =
    severity === 3 ? ["CRITICAL", ui.chipCritical] : severity === 2 ? ["WARNING", ui.chipWarning] : ["MONITOR", ui.chipMonitor]
  return <span className={`${ui.chip} ${tone}`}>{label}</span>
}

/** "today" for today's events, otherwise "Sep 25". */
export function formatEventDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  if (d.toDateString() === now.toDateString()) return "today"
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/** "{source} · {date}", dropping whichever part is missing. */
export function eventMeta(e: DisruptionEvent, withCategory = false): string {
  return [withCategory ? e.category : null, e.sourceDomain, formatEventDate(e.date)].filter(Boolean).join(" · ")
}

/**
 * A number that crossfades (150 ms opacity) when it changes. Re-keying on
 * the value remounts the span, which replays the fade. Reduced motion turns
 * animations off globally.
 */
export function FadeNumber({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span key={value} className={`animate-[fadeIn_150ms_ease-out] ${className}`}>
      {value}
    </span>
  )
}
