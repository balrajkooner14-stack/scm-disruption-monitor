import { NextRequest } from "next/server"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { geminiClient, isRateLimitError } from "@/lib/gemini"
import { buildGraph, findNodesByRegionOrCountry, summarizeDownstreamImpact } from "@/lib/supplyChainGraph"

export const maxDuration = 30

export interface ScenarioInput {
  disruptionType: string
  affectedRegion: string
  durationWeeks: number
  responseAction: string
  customContext?: string
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { scenario, profile, events } = body as {
      scenario: ScenarioInput
      profile: CompanyProfile
      events: ScoredEvent[]
    }

    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return new Response(
        JSON.stringify({ error: "Gemini API key not configured" }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      )
    }

    const relevantEvents = events
      .filter(e =>
        e.region.toLowerCase().includes(scenario.affectedRegion.toLowerCase()) ||
        scenario.affectedRegion.toLowerCase().includes(e.region.toLowerCase())
      )
      .slice(0, 5)
      .map(e => `- ${e.title} (${e.category}, ${e.severity === 3 ? "CRITICAL" : "WARNING"})`)
      .join("\n")

    const inventoryRisk = profile.productLines.map(p => {
      const daysAtRisk = scenario.durationWeeks * 7
      const daysBuffer = p.inventoryDaysOnHand - p.reorderPointDays
      const status =
        daysBuffer < daysAtRisk
          ? "STOCKOUT RISK"
          : daysBuffer < daysAtRisk * 1.5
          ? "TIGHT"
          : "ADEQUATE"
      return (
        `${p.name}: ${p.inventoryDaysOnHand} days on hand, ` +
        `reorder at ${p.reorderPointDays} days — ${status} for ` +
        `${scenario.durationWeeks}-week disruption`
      )
    }).join("\n")

    const affectedSuppliers = profile.suppliers.filter(s =>
      s.region.toLowerCase().includes(scenario.affectedRegion.toLowerCase()) ||
      s.country.toLowerCase().includes(scenario.affectedRegion.toLowerCase())
    )

    const affectedSupplierText = affectedSuppliers.length > 0
      ? affectedSuppliers.map(s =>
        `- ${s.name} (${s.country}): ${s.sharePercent}% of supply, ` +
        `${s.leadTimeDays} day lead time, supplies ${s.category}`
      ).join("\n")
      : "No direct supplier exposure identified in this region."

    // Computed multi-tier dependency impact — traces the actual graph
    // (tier-2 suppliers -> suppliers -> raw materials -> product lines)
    // instead of leaving downstream reasoning entirely to the model.
    const graph = buildGraph(profile)
    const disruptedNodeIds = findNodesByRegionOrCountry(graph, scenario.affectedRegion)
    const { pathDescriptions } = summarizeDownstreamImpact(graph, disruptedNodeIds)
    const computedImpactText = pathDescriptions.length > 0
      ? pathDescriptions.map(p => `- ${p}`).join("\n")
      : "No traced dependency path from this region to a product line — either no supplier/sub-supplier is located there, or the affected node has no downstream assignment in the profile."

    const prompt = `You are an expert supply chain risk analyst performing scenario analysis
for a specific company. Analyze this disruption scenario with precision and provide
a structured impact assessment.

COMPANY: ${profile.companyName} (${profile.sector}, ${profile.revenueRange} revenue)
PAIN POINTS: ${profile.painPoints.join(", ")}

SCENARIO BEING MODELED:
- Disruption Type: ${scenario.disruptionType}
- Affected Region/Area: ${scenario.affectedRegion}
- Duration: ${scenario.durationWeeks} week(s)
- Manager's Planned Response: ${scenario.responseAction}
${scenario.customContext ? `- Additional Context: ${scenario.customContext}` : ""}

AFFECTED SUPPLIERS FROM THEIR NETWORK:
${affectedSupplierText}

COMPUTED DOWNSTREAM IMPACT (traced through their tier-2 supplier / raw-material
dependency graph — treat these as verified facts, not guesses):
${computedImpactText}

INVENTORY POSITION ANALYSIS:
${inventoryRisk}

RELATED CURRENT EVENTS (already happening):
${relevantEvents || "No current events directly matching this region."}

YOUR ANALYSIS MUST COVER EXACTLY THESE 5 SECTIONS IN ORDER:

1. IMMEDIATE IMPACT (Week 1-2)
What happens immediately to this specific company's operations based on
their supplier exposure and inventory position. Be quantitative — reference
actual days, percentages, and supplier names.

2. CASCADING EFFECTS (Week 3 onwards)
How the disruption compounds over time. Use the COMPUTED DOWNSTREAM IMPACT
paths above — they trace real multi-tier dependencies, not assumptions —
to explain exactly which product lines are hit and through which
intermediate supplier or raw material. What downstream effects hit
their product lines, customers, and revenue. Reference their specific
inventory calculations.

3. RESPONSE PLAN ASSESSMENT
Evaluate their planned response ("${scenario.responseAction}").
Is it sufficient? What are the gaps? What would you add?

4. ALTERNATIVE ACTIONS
3 specific alternative or supplementary actions they should consider,
ranked by urgency. Each must be actionable within 48 hours.

5. RECOVERY OUTLOOK
Realistic timeline for recovery assuming they act now. What does
"back to normal" look like and when?

Write in clear, direct prose. No bullet points in sections 1, 2, and 5.
Use bullet points only in sections 3 and 4.
Be specific to their company data — never give generic supply chain advice.
Total response: 400-600 words.`

    // Retry loop with exponential backoff for rate limit errors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let stream: any = null
    let lastError: unknown = null

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        stream = await geminiClient.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 0 },
          },
        })
        break
      } catch (error: unknown) {
        lastError = error
        if (isRateLimitError(error) && attempt < 2) {
          const waitMs = Math.pow(2, attempt + 1) * 1000
          console.log(`[Scenario] Rate limited. Waiting ${waitMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, waitMs))
          continue
        }
        break
      }
    }

    if (!stream) {
      const encoder = new TextEncoder()
      const fallback = isRateLimitError(lastError)
        ? "High demand right now — please wait 15 seconds and try again."
        : "Couldn't run the scenario analysis. Please try again."
      return new Response(encoder.encode(fallback), {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.text ?? ""
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    console.error("Scenario API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to run scenario analysis" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
