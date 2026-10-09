// Stock "as of" dates are calendar dates (YYYY-MM-DD, what a date input
// holds), counted in the user's local time. Parsing them with new Date()
// would read them as UTC midnight and shift the day in US time zones (the
// same bug v4.0 hit in LaborCalendarCard), so they're parsed by hand.

export function parseLocalDate(ymd: string): Date | null {
  const m = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/** Whole calendar days from a YYYY-MM-DD date to `now` (local), never negative. */
export function daysSinceLocalDate(ymd: string, now: Date = new Date()): number | null {
  const d = parseLocalDate(ymd)
  if (!d) return null
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - d.getTime()) / 86_400_000))
}
