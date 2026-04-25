import { NextResponse } from "next/server"
import { GoogleGenAI } from "@google/genai"
import { CompanyProfile } from "@/lib/profile"

// Module-level cache — persists between requests in the same serverless instance
// Key: "generic" or profile company name, value: cached bullets + timestamp
const cache = new Map<string, { summary: string[]; timestamp: number }>()
const CACHE_DURATION_MS = 10 * 60 * 1000 // 10 minutes

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const headlines: string[] = body.headlines ?? []
    const profile: CompanyProfile | null = body.profile ?? null

    const cacheKey = profile ? `profile:${profile.companyName}:${profile.updatedAt}` : "generic"

    // Return cached result if still fresh
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return NextResponse.json({ summary: cached.summary, cached: true })
    }

    // Check API key exists and is not the placeholder
    if (
      !process.env.GEMINI_API_KEY ||
      process.env.GEMINI_API_KEY === "your_gemini_api_key_here"
    ) {
      return NextResponse.json(
        { summary: [], error: "Gemini API key not configured" },
        { status: 503 }
      )
    }

    if (headlines.length === 0) {
      return NextResponse.json(
        { summary: [], error: "No headlines provided" },
        { status: 400 }
      )
    }

    // Initialize Gemini client with the correct 2026 SDK
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // Build the prompt — personalized if profile exists
    let prompt: string

    if (profile) {
      const supplierRegions = Array.from(new Set(profile.suppliers.map(s => s.country))).join(", ")
      prompt = `You are a supply chain risk analyst generating a personalized daily brief for ${profile.companyName}, a ${profile.sector} company.

Their supplier network spans: ${supplierRegions}
Their key concerns: ${profile.painPoints.join(", ")}

Based on today's ${headlines.length} disruption headlines, generate exactly 3 bullet points that are SPECIFIC to this company's situation.
Each bullet must directly relate to their supplier regions or pain points.
Start each bullet with a specific risk or opportunity, not a generic observation.
Keep each bullet to 1-2 sentences. Start each bullet with •. Plain text only, no markdown.

Headlines:
${headlines.join("\n")}`
    } else {
      prompt = `You are a concise supply chain risk analyst. Be direct and professional.

Based on these supply chain disruption headlines from the last 24 hours, provide exactly 3 bullet points summarizing the key risk themes. Start each bullet with •. Each bullet is one sentence only.

Headlines:
${headlines.join("\n")}`
    }

    // Call Gemini 2.5 Flash — free tier, fast, high quality
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    })

    // Extract text from response
    const responseText = response.text ?? ""

    // Parse bullet points from the response
    const bullets = responseText
      .split("\n")
      .map((line: string) => line.trim())
      .filter((line: string) =>
        line.startsWith("•") ||
        line.startsWith("-") ||
        /^\d\./.test(line)
      )
      .map((line: string) => line.replace(/^[•\-\d\.]\s*/, "").trim())
      .filter((line: string) => line.length > 0)
      .slice(0, 3)

    // If Gemini returned text but no bullets were parsed, try splitting by sentence
    const finalBullets = bullets.length > 0
      ? bullets
      : responseText
          .split(".")
          .map((s: string) => s.trim())
          .filter((s: string) => s.length > 20)
          .slice(0, 3)

    // Update cache
    cache.set(cacheKey, { summary: finalBullets, timestamp: Date.now() })

    return NextResponse.json({ summary: finalBullets })

  } catch (error) {
    console.error("[API/analyze] Gemini error:", error)
    return NextResponse.json(
      { summary: [], error: "Analysis failed" },
      { status: 500 }
    )
  }
}
