// Deterministic post-processing for imported spreadsheet data.
// Gemini extracts raw numbers and structure; these pure functions do the
// arithmetic, since LLM math across many rows is unreliable.

export function computeDaysOnHand(
  onHandValue: number,
  usageValue: number,
  usageWindowDays: number
): number {
  if (usageValue <= 0 || usageWindowDays <= 0) return 0
  const dailyRate = usageValue / usageWindowDays
  if (dailyRate <= 0) return 0
  return Math.round(onHandValue / dailyRate)
}

export function distributeShareEvenly(count: number): number {
  if (count <= 0) return 0
  return Math.round((100 / count) * 100) / 100
}
