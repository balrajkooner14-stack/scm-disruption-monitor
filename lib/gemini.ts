import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

export interface GroundingSource {
  title: string
  uri: string
}

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<{ result: string; sources: GroundingSource[] }>>()

// Persistent cache that survives across requests in the same serverless instance
const persistentCache = new Map<string, {
  result: string
  sources: GroundingSource[]
  timestamp: number
  isStale: boolean
}>()

export interface GeminiCallOptions {
  model?: string
  cacheKey: string
  cacheDurationMs: number
  staleCacheDurationMs?: number
  thinkingBudget?: number
  maxRetries?: number
  prompt: string
  /**
   * Enables Gemini's live Google Search grounding tool (tools: [{ googleSearch: {} }],
   * verified against the installed @google/genai SDK's Tool.googleSearch field — a
   * general web search on this turned up a newer, unrelated "Interactions API" with
   * different syntax that does NOT match what's installed here). The Gemini API
   * rejects combining search tools with other tool types in one request, which isn't
   * a problem for this app since every route gets structured JSON via prompt
   * instructions only, never a schema/function-calling tool.
   */
  enableGoogleSearch?: boolean
}

export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const e = error as { status?: unknown; message?: unknown }
  if (e.status === 429) return true
  if (typeof e.message !== "string") return false
  return (
    e.message.includes("429") ||
    e.message.includes("quota") ||
    e.message.includes("RESOURCE_EXHAUSTED") ||
    e.message.includes("rate")
  )
}

export async function callGeminiWithRetry(
  options: GeminiCallOptions
): Promise<{ result: string; sources: GroundingSource[]; fromCache: boolean; isStale: boolean }> {
  const {
    model = "gemini-2.5-flash",
    cacheKey,
    cacheDurationMs,
    staleCacheDurationMs = cacheDurationMs * 2,
    thinkingBudget = 0,
    maxRetries = 3,
    prompt,
    enableGoogleSearch = false,
  } = options

  const now = Date.now()

  // Return fresh cache immediately
  const cached = persistentCache.get(cacheKey)
  if (cached && now - cached.timestamp < cacheDurationMs) {
    return { result: cached.result, sources: cached.sources, fromCache: true, isStale: false }
  }

  // Deduplicate concurrent identical requests
  const existingRequest = inFlightRequests.get(cacheKey)
  if (existingRequest) {
    try {
      const { result, sources } = await existingRequest
      return { result, sources, fromCache: true, isStale: false }
    } catch {
      // If in-flight request failed, fall through to try ourselves
    }
  }

  const requestPromise = makeGeminiCallWithRetry(
    ai, model, prompt, thinkingBudget, maxRetries, cacheKey, enableGoogleSearch
  )

  inFlightRequests.set(cacheKey, requestPromise)

  try {
    const { result, sources } = await requestPromise

    persistentCache.set(cacheKey, {
      result,
      sources,
      timestamp: now,
      isStale: false,
    })

    inFlightRequests.delete(cacheKey)
    return { result, sources, fromCache: false, isStale: false }

  } catch (error) {
    inFlightRequests.delete(cacheKey)

    // Serve stale cache on failure
    if (cached && now - cached.timestamp < staleCacheDurationMs) {
      console.log(`[Gemini] Rate limited — serving stale cache for ${cacheKey}`)
      return { result: cached.result, sources: cached.sources, fromCache: true, isStale: true }
    }

    throw error
  }
}

async function makeGeminiCallWithRetry(
  aiClient: GoogleGenAI,
  model: string,
  prompt: string,
  thinkingBudget: number,
  maxRetries: number,
  cacheKey: string,
  enableGoogleSearch: boolean
): Promise<{ result: string; sources: GroundingSource[] }> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await aiClient.models.generateContent({
        model,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingBudget },
          ...(enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      })

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []
      const sources: GroundingSource[] = chunks
        .map(c => c.web)
        .filter((w): w is { title?: string; uri?: string } => !!w?.uri)
        .map(w => ({ title: w.title ?? w.uri!, uri: w.uri! }))

      return { result: response.text ?? "", sources }

    } catch (error: unknown) {
      lastError = error as Error

      if (isRateLimitError(error) && attempt < maxRetries - 1) {
        const waitMs = Math.pow(2, attempt + 1) * 1000
        console.log(
          `[Gemini] Rate limited on ${cacheKey}. ` +
          `Attempt ${attempt + 1}/${maxRetries}. ` +
          `Waiting ${waitMs}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, waitMs))
        continue
      }

      console.error(
        `[Gemini] Error on ${cacheKey} attempt ${attempt + 1}:`,
        (error as Error)?.message
      )
      break
    }
  }

  throw lastError ?? new Error("Gemini call failed after retries")
}

// Exported for streaming routes that cannot use the standard retry wrapper
export { ai as geminiClient }
