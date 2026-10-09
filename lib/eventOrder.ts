import type { DisruptionEvent } from "./types"

// Shared ordering for onboarding panels: most severe first, then newest.
// Its own module so lib/ports.ts and lib/onboardingInsights.ts can both use it
// without importing each other.

function dateMs(event: DisruptionEvent): number {
  const t = new Date(event.date).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Severity desc, then newest first. Returns a new array. */
export function bySeverityThenDate<E extends DisruptionEvent>(events: E[]): E[] {
  return [...events].sort((a, b) => b.severity - a.severity || dateMs(b) - dateMs(a))
}

/** Newer-first comparison on ISO dates, for tie-breaks elsewhere. */
export function compareDateDesc(a: DisruptionEvent, b: DisruptionEvent): number {
  return dateMs(b) - dateMs(a)
}
