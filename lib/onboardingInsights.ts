import type { DisruptionEvent } from "./types"

// Pure functions behind every live right-hand panel in sign-up and onboarding
// (spec section 7). They only select and arrange real events; event text is
// always used verbatim and nothing here invents copy about an event.

function dateMs(event: DisruptionEvent): number {
  const t = new Date(event.date).getTime()
  return Number.isNaN(t) ? 0 : t
}

/** Severity desc, then newest first. Returns a new array. */
export function bySeverityThenDate(events: DisruptionEvent[]): DisruptionEvent[] {
  return [...events].sort((a, b) => b.severity - a.severity || dateMs(b) - dateMs(a))
}

/**
 * The sign-in panel's headline tiles: the highest-severity events with
 * distinct categories, topped up with the next most severe events when
 * fewer than `count` categories are present.
 */
export function pickHeadlineEvents(events: DisruptionEvent[], count = 3): DisruptionEvent[] {
  const sorted = bySeverityThenDate(events)
  const picked: DisruptionEvent[] = []
  const seenCategories = new Set<string>()
  for (const e of sorted) {
    if (picked.length >= count) break
    if (seenCategories.has(e.category)) continue
    seenCategories.add(e.category)
    picked.push(e)
  }
  for (const e of sorted) {
    if (picked.length >= count) break
    if (!picked.includes(e)) picked.push(e)
  }
  return picked
}
