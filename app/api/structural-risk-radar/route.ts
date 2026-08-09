import { NextRequest, NextResponse } from "next/server"
import { CompanyProfile } from "@/lib/profile"
import { callGeminiWithRetry, GroundingSource } from "@/lib/gemini"

export interface RadarFinding {
  name: string
  riskType: "Chokepoint" | "Single-Source Material" | "Capacity Concentration"
  description: string
  relevanceToProfile: string
}

export interface StructuralRiskRadarResponse {
  findings: RadarFinding[]
  sources: GroundingSource[]
  generatedAt: string
  isStale?: boolean
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { profile } = body as { profile: CompanyProfile }

    if (!profile) {
      return NextResponse.json({ error: "Missing profile" }, { status: 400 })
    }

    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return NextResponse.json({ error: "Gemini API key not configured" }, { status: 503 })
    }

    const categories = Array.from(
      new Set(profile.suppliers.map(s => s.category.trim()).filter(Boolean))
    )
    const rawMaterialNames = Array.from(
      new Set(
        profile.productLines
          .flatMap(p => (p.rawMaterials ?? []).map(m => m.name.trim()))
          .filter(Boolean)
      )
    )

    if (categories.length === 0) {
      const empty: StructuralRiskRadarResponse = {
        findings: [],
        sources: [],
        generatedAt: new Date().toISOString(),
      }
      return NextResponse.json(empty)
    }

    const cacheKey = `radar-${profile.updatedAt}-${categories.slice().sort().join("|")}`

    const prompt = `You are a supply chain risk analyst with live Google Search access.

A company sources the following categories of goods from suppliers, and may
depend on the raw materials listed below. Search for CURRENT, SPECIFIC
structural supply chain risks relevant to these inputs — chokepoints,
single-source material dependencies, or capacity concentration among a small
number of producers. Do NOT report generic, transient news (a single strike,
a weather event, a tariff announcement) — those are already tracked
separately by this platform's live news feed. Only report a standing
structural exposure you can attribute to a real source you found via search.

SUPPLIER CATEGORIES: ${categories.join(", ")}
${rawMaterialNames.length > 0 ? `RAW MATERIALS USED: ${rawMaterialNames.join(", ")}` : ""}
COMPANY SECTOR: ${profile.sector}
TRADE LANES: ${profile.tradeLanes.join(", ") || "Not specified"}

Respond with a JSON array of at most 4 findings. Each finding:
{
  "name": "Short name of the risk (e.g. a specific company, chokepoint, or material)",
  "riskType": "Chokepoint" | "Single-Source Material" | "Capacity Concentration",
  "description": "2-3 sentences with specific facts/figures from what you found via search",
  "relevanceToProfile": "One sentence on why this specifically matters to a company sourcing ${categories.join(", ")}"
}

If you cannot find anything current and well-sourced, respond with an empty
array: []. Do not invent findings — an empty array is a valid and expected
response when search doesn't turn up anything specific and current.

Respond ONLY with the raw JSON array. No markdown, no backticks, no preamble.`

    const { result: text, sources, isStale } = await callGeminiWithRetry({
      cacheKey,
      cacheDurationMs: 24 * 60 * 60 * 1000,
      staleCacheDurationMs: 7 * 24 * 60 * 60 * 1000,
      maxRetries: 3,
      thinkingBudget: 0,
      enableGoogleSearch: true,
      prompt,
    })

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    let findings: RadarFinding[] = []
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed)) findings = parsed
    } catch {
      // Malformed output — treat as no findings rather than erroring the whole card
      findings = []
    }

    const response: StructuralRiskRadarResponse = {
      findings: findings.slice(0, 4),
      sources: sources.slice(0, 6),
      generatedAt: new Date().toISOString(),
      isStale,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error("Structural risk radar API error:", error)
    return NextResponse.json(
      { error: "Failed to generate structural risk radar" },
      { status: 500 }
    )
  }
}
