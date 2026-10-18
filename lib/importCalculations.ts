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

/**
 * Whole-number percentages that sum to exactly 100, proportional to
 * `weights`, by the largest-remainder method: floor every share, then hand
 * the leftover points to the largest remainders, earlier entries first on a
 * tie. [1, 1, 1] → [34, 33, 33].
 */
export function largestRemainderShares(weights: number[]): number[] {
  const total = weights.reduce((t, w) => t + Math.max(0, w), 0)
  if (weights.length === 0 || total <= 0) return weights.map(() => 0)
  const exact = weights.map(w => (Math.max(0, w) / total) * 100)
  const shares = exact.map(Math.floor)
  let leftover = 100 - shares.reduce((t, n) => t + n, 0)
  const order = exact
    .map((x, i) => ({ i, rem: x - Math.floor(x) }))
    .sort((a, b) => b.rem - a.rem || a.i - b.i)
  for (const { i } of order) {
    if (leftover <= 0) break
    shares[i] += 1
    leftover -= 1
  }
  return shares
}

/** An even split across `count` suppliers in whole numbers: 3 → [34, 33, 33]. */
export function wholeNumberShares(count: number): number[] {
  return count > 0 ? largestRemainderShares(new Array(count).fill(1)) : []
}

/**
 * Loose name match between a product's "primary supplier" cell and the
 * imported supplier names: either contains the other, or the first words
 * agree ("Foxconn" ↔ "Foxconn Assembly"). Returns the matched index or -1.
 */
export function matchSupplierByName(target: string, names: string[]): number {
  const t = target.trim().toLowerCase()
  if (!t) return -1
  return names.findIndex(name => {
    const n = name.trim().toLowerCase()
    return !!n && (n.includes(t) || t.includes(n) || n.split(" ")[0] === t.split(" ")[0])
  })
}
