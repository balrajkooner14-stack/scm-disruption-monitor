import { NextRequest, NextResponse } from "next/server"
import { CompanyProfile, Supplier } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { callGeminiWithRetry } from "@/lib/gemini"

export const maxDuration = 30

export interface CostEstimate {
  revenueAtRiskLow: number
  revenueAtRiskHigh: number
  mitigationCost: number
  netRiskReduction: number
  mitigationAction: string
  estimatedDurationDays: number
  confidenceLevel: "High" | "Medium" | "Low"
  assumptions: string
  urgencyDays: number
}

export interface CostEstimateResponse {
  estimate: CostEstimate
  supplierName: string
  eventTitle: string
  generatedAt: string
}

export async function POST(req: NextRequest) {
  try {
    const { profile, event, supplier } = (await req.json()) as {
      profile: CompanyProfile
      event: ScoredEvent
      supplier: Supplier
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

    const revenueEstimates: Record<string, number> = {
      "$0–$10M": 5_000_000,
      "$10M–$100M": 50_000_000,
      "$100M–$1B": 500_000_000,
      "$1B+": 2_000_000_000,
    }
    const estimatedAnnualRevenue =
      revenueEstimates[profile.revenueRange] ?? 50_000_000

    const supplierRevenueShare =
      (supplier.sharePercent / 100) * estimatedAnnualRevenue

    const prompt = `You are a supply chain financial risk analyst. Calculate the financial impact of this specific disruption on this specific company.

COMPANY: ${profile.companyName}
SECTOR: ${profile.sector}
ESTIMATED ANNUAL REVENUE: $${estimatedAnnualRevenue.toLocaleString()}
REVENUE RANGE: ${profile.revenueRange}

AFFECTED SUPPLIER:
- Name: ${supplier.name}
- Country: ${supplier.country}
- Region: ${supplier.region}
- What they supply: ${supplier.category}
- Share of total supply: ${supplier.sharePercent}%
- Lead time: ${supplier.leadTimeDays} days
- Estimated annual revenue dependent on this supplier: $${supplierRevenueShare.toLocaleString()}

DISRUPTION EVENT:
- Title: ${event.title}
- Category: ${event.category}
- Severity: ${event.severity === 3 ? "CRITICAL" : "WARNING"}
- Region: ${event.region}

CALCULATE:
1. Revenue at risk (low and high range in USD) — based on disruption duration likelihood for this type of event in this region, and supplier share
2. Most practical mitigation action for this specific disruption type and supplier category
3. Estimated cost of that mitigation in USD
4. Net risk reduction (revenue at risk low end minus mitigation cost)
5. Estimated disruption duration in days
6. Confidence level in your estimate (High/Medium/Low)
7. Key assumptions you made
8. How many days the manager has before costs escalate significantly

Be realistic and specific. Use industry benchmarks for:
- Port strikes typically last 3-14 days
- Air freight premium over ocean: typically 4-6x more expensive
- Tariff impacts: typically affect margin not revenue directly
- Supply shortages: typically cause 15-30% production slowdown

Respond ONLY with valid JSON. No markdown, no backticks.

{
  "revenueAtRiskLow": <number in USD>,
  "revenueAtRiskHigh": <number in USD>,
  "mitigationCost": <number in USD>,
  "netRiskReduction": <number in USD>,
  "mitigationAction": "<specific action e.g. Air freight from alternate port>",
  "estimatedDurationDays": <number>,
  "confidenceLevel": "<High|Medium|Low>",
  "assumptions": "<2-3 key assumptions as a single sentence>",
  "urgencyDays": <number of days before cost escalates>
}`

    const { result: text } = await callGeminiWithRetry({
      cacheKey: `cost-${supplier.id}-${(event.url ?? "").slice(0, 30)}`,
      cacheDurationMs: 60 * 60 * 1000,
      staleCacheDurationMs: 4 * 60 * 60 * 1000,
      maxRetries: 3,
      thinkingBudget: 0,
      prompt,
    })

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    const estimate: CostEstimate = JSON.parse(cleaned)

    const result: CostEstimateResponse = {
      estimate,
      supplierName: supplier.name,
      eventTitle: event.title,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Cost estimate error:", error)
    return NextResponse.json(
      { error: "Failed to generate cost estimate" },
      { status: 500 }
    )
  }
}
