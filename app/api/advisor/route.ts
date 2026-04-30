import { NextRequest, NextResponse } from "next/server"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { callGeminiWithRetry } from "@/lib/gemini"

export const maxDuration = 30

export interface Recommendation {
  id: string
  priority: "CRITICAL" | "HIGH" | "MEDIUM"
  title: string
  problem: string
  action: string
  impact: string
  timeframe: string
  affectedSuppliers: string[]
  confidenceLevel: "High" | "Medium" | "Low"
  relatedEventTitles: string[]
}

export interface AdvisorResponse {
  recommendations: Recommendation[]
  generatedAt: string
  profileName: string
  totalEventsAnalyzed: number
  highRelevanceCount: number
  isStale?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profile, events, healthSummary } = body as {
      profile: CompanyProfile
      events: ScoredEvent[]
      healthSummary?: string
    }

    if (!profile || !events) {
      return NextResponse.json(
        { error: "Missing profile or events" },
        { status: 400 }
      )
    }

    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 503 }
      )
    }

    const cacheKey = `advisor-${profile.updatedAt}-${events[0]?.title?.slice(0, 20) ?? "empty"}`

    const relevantEvents = events
      .filter(e => e.isProfileMatch || e.severity === 3)
      .slice(0, 15)

    const supplierSummary = profile.suppliers
      .map(s =>
        `- ${s.name} (${s.country}, ${s.region}): supplies ${s.category}, ` +
        `${s.sharePercent}% of supply, ${s.leadTimeDays} day lead time`
      )
      .join("\n")

    const productSummary = profile.productLines
      .map(p =>
        `- ${p.name}: ${p.inventoryDaysOnHand} days inventory on hand, ` +
        `reorder at ${p.reorderPointDays} days`
      )
      .join("\n")

    const eventSummary = relevantEvents
      .map(e =>
        `[${e.severity === 3 ? "CRITICAL" : e.severity === 2 ? "WARNING" : "MONITOR"}] ` +
        `${e.category} | ${e.region} | Score: ${e.relevanceScore}/100\n` +
        `Title: ${e.title}\nReason: ${e.relevanceReason}`
      )
      .join("\n\n")

    const prompt = `You are an expert supply chain risk advisor analyzing disruptions for a specific company.

COMPANY PROFILE:
Company: ${profile.companyName}
Sector: ${profile.sector}
Revenue: ${profile.revenueRange}
Primary Markets: ${profile.primaryMarkets.join(", ")}
Top Pain Points: ${profile.painPoints.join(", ")}
Transport Modes: ${profile.transportModes.join(", ")}
Trade Lanes: ${profile.tradeLanes.join(", ")}

THEIR SUPPLIER NETWORK:
${supplierSummary}

THEIR INVENTORY STATUS:
${productSummary}

SUPPLIER PERFORMANCE DATA (from manager's logs):
${healthSummary || "No performance data available."}

CURRENT DISRUPTION EVENTS (filtered for relevance):
${eventSummary || "No highly relevant events detected at this time."}

YOUR TASK:
Generate 3 to 5 specific, actionable recommendations for this company based on
the intersection of their supply chain profile and current disruptions.

CRITICAL RULES:
- Be SPECIFIC to their company — mention their actual suppliers, product lines,
  and percentages by name
- Give CONCRETE actions — not "consider diversifying" but "contact [Supplier Name]
  today to confirm shipment status for your [Product] line"
- Calculate URGENCY from their actual inventory days on hand vs lead times
- If inventory days on hand < lead time days for a supplier region that has
  active disruptions, flag this as CRITICAL
- If a supplier has a health score below 70 AND their region has active disruptions,
  flag this as CRITICAL priority — a weak supplier in a disrupted region is a
  critical compounding risk that must be the highest priority recommendation
- If no highly relevant events exist, still provide 1-2 proactive recommendations
  based on their pain points and general risk management best practices
- Do NOT give generic supply chain advice — every recommendation must reference
  their specific data

Respond ONLY with a valid JSON array of recommendations.
No markdown, no backticks, no preamble. Just the raw JSON array.

Each recommendation must follow this exact structure:
[
  {
    "id": "rec_1",
    "priority": "CRITICAL" | "HIGH" | "MEDIUM",
    "title": "Short action title (max 8 words)",
    "problem": "Specific problem statement referencing their data (1-2 sentences)",
    "action": "Concrete recommended action (2-3 sentences, specific to their company)",
    "impact": "What happens if they act vs don't act (1-2 sentences)",
    "timeframe": "Time-sensitive guidance e.g. 'Act within 24 hours'",
    "affectedSuppliers": ["supplier name if applicable"],
    "confidenceLevel": "High" | "Medium" | "Low",
    "relatedEventTitles": ["event title that triggered this"]
  }
]`

    const { result: text, isStale } = await callGeminiWithRetry({
      cacheKey,
      cacheDurationMs: 30 * 60 * 1000,
      staleCacheDurationMs: 90 * 60 * 1000,
      maxRetries: 3,
      thinkingBudget: 0,
      prompt,
    })

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    const recommendations: Recommendation[] = JSON.parse(cleaned)

    const advisorResponse: AdvisorResponse = {
      recommendations,
      generatedAt: new Date().toISOString(),
      profileName: profile.companyName,
      totalEventsAnalyzed: events.length,
      highRelevanceCount: events.filter(e => e.isProfileMatch).length,
      isStale,
    }

    return NextResponse.json(advisorResponse)
  } catch (error) {
    console.error("Advisor API error:", error)
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    )
  }
}
