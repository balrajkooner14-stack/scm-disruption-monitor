import { DisruptionEvent } from "@/lib/types"
import { CompanyProfile } from "@/lib/profile"

export interface ScoredEvent extends DisruptionEvent {
  relevanceScore: number      // 0–100
  relevanceReason: string     // short human-readable explanation
  isProfileMatch: boolean     // true if score >= 40
}

export function scoreEventsForProfile(
  events: DisruptionEvent[],
  profile: CompanyProfile
): ScoredEvent[] {
  return events
    .map(event => scoreEvent(event, profile))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
}

function scoreEvent(
  event: DisruptionEvent,
  profile: CompanyProfile
): ScoredEvent {
  let score = 0
  const reasons: string[] = []

  // ── Region match (up to 40 points) ──────────────────────
  // Check if event region matches any of the user's supplier regions
  const supplierRegions = profile.suppliers.map(s => s.region)
  if (supplierRegions.includes(event.region as never)) {
    // Weight by how much supply comes from that region
    const regionSuppliers = profile.suppliers.filter(
      s => s.region === event.region
    )
    const regionShare = regionSuppliers.reduce(
      (sum, s) => sum + s.sharePercent, 0
    )
    const regionPoints = Math.min(40, Math.round(regionShare * 0.5))
    score += regionPoints
    reasons.push(`${regionShare}% of your supply comes from this region`)
  }

  // Also check if event region matches primary markets
  if (profile.primaryMarkets.includes(event.region as never)) {
    score += 10
    reasons.push("Affects one of your primary sales markets")
  }

  // ── Category match to pain points (up to 25 points) ─────
  const categoryPainPointMap: Record<string, string[]> = {
    Port: ["Port congestion", "Lead time variability"],
    Tariff: ["Tariff exposure", "Raw material price volatility"],
    Labor: ["Labor disruptions", "Supplier concentration risk"],
    Geopolitical: [
      "Supplier concentration risk",
      "Tariff exposure",
    ],
    Weather: ["Lead time variability", "Port congestion"],
    General: [],
  }

  const matchingPainPoints = (
    categoryPainPointMap[event.category] || []
  ).filter(pp => profile.painPoints.includes(pp as never))

  if (matchingPainPoints.length > 0) {
    score += matchingPainPoints.length * 12
    reasons.push(
      `Relates to your concern: ${matchingPainPoints[0]}`
    )
  }

  // ── Severity boost (up to 20 points) ────────────────────
  const severityPoints = event.severity === 3 ? 20 :
    event.severity === 2 ? 10 : 0
  score += severityPoints
  if (event.severity === 3) reasons.push("Critical severity event")

  // ── Supplier country direct match (up to 15 points) ─────
  // Check if event title or url mentions any of the user's
  // supplier countries directly
  const supplierCountries = profile.suppliers.map(
    s => s.country.toLowerCase()
  )
  const eventText = (event.title + " " + event.url).toLowerCase()
  const matchedCountry = supplierCountries.find(c =>
    eventText.includes(c)
  )
  if (matchedCountry) {
    score += 15
    reasons.push(
      `Mentions ${profile.suppliers.find(
        s => s.country.toLowerCase() === matchedCountry
      )?.country} where you have a supplier`
    )
  }

  // ── Trade lane match (up to 10 points) ──────────────────
  const laneKeywords: Record<string, string[]> = {
    "Asia-Pacific to US West Coast": [
      "los angeles", "long beach", "seattle", "tacoma",
      "transpacific", "asia pacific"
    ],
    "Asia-Pacific to US East Coast": [
      "savannah", "charleston", "new york", "baltimore",
      "east coast"
    ],
    "Asia-Pacific to Europe": [
      "rotterdam", "hamburg", "antwerp", "felixstowe",
      "suez", "red sea"
    ],
    "Europe to US": ["transatlantic", "europe", "rotterdam"],
    "Middle East to Europe": [
      "suez", "red sea", "hormuz", "persian gulf"
    ],
    "Latin America to US": ["panama", "caribbean", "gulf"],
  }

  for (const lane of profile.tradeLanes) {
    const keywords = laneKeywords[lane] || []
    if (keywords.some(kw => eventText.includes(kw))) {
      score += 10
      reasons.push(`Affects your ${lane} trade lane`)
      break
    }
  }

  // ── Inventory urgency boost ──────────────────────────────
  // If any product line has low inventory (< 15 days) and
  // this is a critical or warning event in a supplier region,
  // boost the score
  const lowInventoryProducts = profile.productLines.filter(
    p => p.inventoryDaysOnHand < 15
  )
  if (
    lowInventoryProducts.length > 0 &&
    event.severity >= 2 &&
    supplierRegions.includes(event.region as never)
  ) {
    score += 10
    reasons.push(
      `Low inventory alert: ${lowInventoryProducts[0].name} has ` +
      `only ${lowInventoryProducts[0].inventoryDaysOnHand} days on hand`
    )
  }

  // Cap score at 100
  score = Math.min(100, score)

  const relevanceReason =
    reasons.length > 0
      ? reasons[0]
      : "General supply chain relevance"

  return {
    ...event,
    relevanceScore: score,
    relevanceReason,
    isProfileMatch: score >= 40,
  }
}
