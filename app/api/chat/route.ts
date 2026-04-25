import { GoogleGenAI } from "@google/genai"
import { NextRequest } from "next/server"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, profile, events } = body as {
      messages: { role: "user" | "assistant"; content: string }[]
      profile: CompanyProfile | null
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

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    // Build system context
    const topEvents = events
      .slice(0, 20)
      .map(e =>
        `[${e.severity === 3 ? "CRITICAL" : e.severity === 2 ? "WARNING" : "MONITOR"}] ` +
        `${e.category} | ${e.region} | Relevance: ${e.relevanceScore}/100\n` +
        `${e.title}`
      )
      .join("\n")

    const profileContext = profile
      ? `
COMPANY PROFILE:
Company: ${profile.companyName}
Sector: ${profile.sector}
Suppliers: ${profile.suppliers.map(s => `${s.name} (${s.country}, ${s.sharePercent}% of supply)`).join(", ")}
Product Lines: ${profile.productLines.map(p => `${p.name} (${p.inventoryDaysOnHand} days inventory)`).join(", ")}
Pain Points: ${profile.painPoints.join(", ")}
Trade Lanes: ${profile.tradeLanes.join(", ")}
`
      : "No company profile configured — provide general supply chain analysis."

    const systemPrompt = `You are an expert supply chain risk analyst assistant embedded in a real-time
supply chain disruption monitoring dashboard. You have access to live disruption data
and the user's company profile.

${profileContext}

CURRENT LIVE DISRUPTION FEED (${events.length} events):
${topEvents}

YOUR ROLE:
- Answer questions about current disruptions and how they affect the user's specific supply chain
- Provide concrete, actionable recommendations — not generic advice
- Reference specific suppliers, inventory levels, and events by name when relevant
- Be concise but thorough — 2-4 paragraphs maximum per response
- If asked about something not in the feed, say so clearly
- Always ground your answers in the actual data shown above
- When making recommendations, calculate urgency from inventory days vs lead times

Respond in plain text. No markdown headers. No bullet lists unless
specifically helpful. Write like a knowledgeable colleague, not a report.`

    // Build conversation history for Gemini
    // Gemini uses "user" and "model" roles; history is all messages except the last
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      history,
      config: {
        systemInstruction: systemPrompt,
      },
    })

    const stream = await chat.sendMessageStream({
      message: lastMessage.content,
    })

    // Return a streaming text response
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
    console.error("Chat API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process chat message" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
