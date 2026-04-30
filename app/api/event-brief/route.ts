import { NextRequest, NextResponse } from "next/server"
import { ScoredEvent } from "@/lib/scoreEvents"
import { CompanyProfile } from "@/lib/profile"
import { callGeminiWithRetry } from "@/lib/gemini"

export const maxDuration = 30

export interface EventBriefResponse {
  brief: string
  impact: string
  recommendation: string
}

export async function POST(req: NextRequest) {
  try {
    const { event, profile } = (await req.json()) as {
      event: ScoredEvent
      profile: CompanyProfile | null
    }

    const profileContext = profile
      ? `The user works at ${profile.companyName}, a ${profile.sector} company with suppliers in: ${profile.suppliers.map((s) => `${s.country} (${s.sharePercent}% of supply)`).join(", ")}. Their key concerns: ${profile.painPoints.join(", ")}.`
      : "No company profile available — provide general supply chain context."

    const prompt = `You are a supply chain risk analyst. A supply chain manager is reading this news event in their risk dashboard:

TITLE: ${event.title}
CATEGORY: ${event.category}
REGION: ${event.region}
SEVERITY: ${event.severity === 3 ? "CRITICAL" : event.severity === 2 ? "WARNING" : "MONITOR"}
RELEVANCE TO USER: ${event.relevanceReason || "General supply chain relevance"}

USER CONTEXT:
${profileContext}

Generate a supply chain intelligence brief for this event.
Be specific — not "this could affect supply chains" but HOW and WHO.
Reference the user's company context when relevant.

Respond ONLY with valid JSON matching this exact structure:
{
  "brief": "2-3 sentences explaining what this event means for supply chains specifically. What is disrupted, where, and what downstream effects follow.",
  "impact": "High" or "Medium" or "Low",
  "recommendation": "One specific action sentence starting with a verb e.g. Contact suppliers in [region] to confirm..."
}

No markdown. No backticks. Raw JSON only.`

    const { result: text } = await callGeminiWithRetry({
      cacheKey: `brief-${event.url}-${profile?.updatedAt ?? "noprofile"}`,
      cacheDurationMs: 20 * 60 * 1000,
      staleCacheDurationMs: 60 * 60 * 1000,
      maxRetries: 2,
      thinkingBudget: 0,
      prompt,
    })

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    const brief: EventBriefResponse = JSON.parse(cleaned)

    return NextResponse.json(brief)
  } catch (error) {
    console.error("Event brief error:", error)
    return NextResponse.json(
      {
        brief: "Unable to generate brief for this event.",
        impact: "Unknown",
        recommendation: "Review the source article for details.",
      },
      { status: 200 },
    )
  }
}
