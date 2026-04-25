import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"

// Cache recommendations for 10 minutes to avoid repeated API calls
// Key: hash of profile.updatedAt + first event title
const cache = new Map<string, { data: AdvisorResponse; timestamp: number }>()
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

export interface Recommendation {
  id: string
  priority: "CRITICAL" | "HIGH" | "MEDIUM"
  title: string           // Short action title e.g. "Contact Vietnamese suppliers immediately"
  problem: string         // What the specific problem is (1-2 sentences)
  action: string          // The specific recommended action (2-3 sentences, concrete)
  impact: string          // What happens if they act vs. don't act (1-2 sentences)
  timeframe: string       // e.g. "Act within 24 hours", "Review within this week"
  affectedSuppliers: string[]  // supplier names from their profile that are affected
  confidenceLevel: "High" | "Medium" | "Low"
  relatedEventTitles: string[] // titles of events that triggered this recommendation
}

export interface AdvisorResponse {
  recommendations: Recommendation[]
  generatedAt: string
  profileName: string
  totalEventsAnalyzed: number
  highRelevanceCount: number
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profile, events } = body as {
      profile: CompanyProfile
      events: ScoredEvent[]
    }

    if (!profile || !events) {
      return NextResponse.json(
        { error: "Missing profile or events" },
        { status: 400 }
      )
    }

    // Check cache
    const cacheKey = `${profile.updatedAt}-${events[0]?.title || "empty"}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // Build a focused context — only high relevance events to save tokens
    const relevantEvents = events
      .filter(e => e.isProfileMatch || e.severity === 3)
      .slice(0, 15) // cap at 15 events

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    })

    const text = response.text ?? ""

    // Strip any markdown fences if present
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
    }

    // Store in cache
    cache.set(cacheKey, {
      data: advisorResponse,
      timestamp: Date.now(),
    })

    return NextResponse.json(advisorResponse)
  } catch (error) {
    console.error("Advisor API error:", error)
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    )
  }
}
