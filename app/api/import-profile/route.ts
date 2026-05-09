import { callGeminiWithRetry } from "@/lib/gemini"
import { NextRequest, NextResponse } from "next/server"

export interface ImportedSupplier {
  name: string
  country: string
  region: string
  category: string
  sharePercent: number
  leadTimeDays: number
  confidence: "high" | "medium" | "low"
  notes?: string
}

export interface ImportedProductLine {
  name: string
  inventoryDaysOnHand: number
  reorderPointDays: number
  confidence: "high" | "medium" | "low"
  notes?: string
}

export interface ImportResult {
  detectedType: "suppliers" | "inventory" | "mixed" | "unknown"
  companyName?: string
  suppliers: ImportedSupplier[]
  productLines: ImportedProductLine[]
  missingFields: string[]
  ambiguities: string[]
  rawColumnNames: string[]
  confidence: "high" | "medium" | "low"
  message: string
}

export async function POST(req: NextRequest) {
  try {
    const { extractedData, fileName } = await req.json()

    if (!extractedData) {
      return NextResponse.json({ error: "No data provided" }, { status: 400 })
    }

    const prompt = `You are an expert supply chain data analyst.
A supply chain manager has uploaded a file named "${fileName}"
containing their company's supply chain data.

Here is the extracted table data in JSON format:
${extractedData}

Your task is to intelligently interpret this data and map it
to a supply chain profile. Column names may be abbreviated,
in different languages, or use company-specific terminology.

MAPPING RULES:
- Supplier name: look for columns like "supplier", "vendor",
  "company", "name", "partner", "manufacturer"
- Country: look for "country", "location", "origin", "source",
  "nation", "geo", or country codes (US, CN, DE, etc.)
- What they supply: look for "category", "type", "product",
  "material", "component", "item", "description", "goods"
- Share percentage: look for "share", "%", "percent",
  "allocation", "split", "portion", "weight"
- Lead time: look for "lead", "days", "LT", "lead time",
  "delivery days", "transit", "cycle time"
- Product name: look for "product", "SKU", "item", "line",
  "part", "model", "description"
- Inventory days on hand: look for "DOH", "days on hand",
  "inventory", "stock", "on hand", "current stock"
- Reorder point: look for "reorder", "ROP", "safety stock",
  "min stock", "trigger", "order point"

REGION MAPPING (map countries to these exact regions):
- "North America": US, USA, Canada, Mexico, CA, MX
- "Europe": UK, Germany, France, Italy, Spain, Netherlands,
  Poland, Sweden, Switzerland, DE, GB, FR, IT, ES, NL
- "Asia Pacific": China, Japan, South Korea, India, Vietnam,
  Thailand, Indonesia, Singapore, Taiwan, CN, JP, KR, IN, VN
- "Middle East": UAE, Saudi Arabia, Iran, Israel, Turkey, AE, SA
- "Latin America": Brazil, Argentina, Colombia, Chile, BR, AR
- "Africa": Nigeria, South Africa, Kenya, Morocco, NG, ZA

IMPORTANT RULES:
- If share percentages don't add to ~100%, normalize them
- If lead time is in weeks, convert to days (multiply by 7)
- If lead time is missing, estimate based on region:
  North America: 14 days, Europe: 21 days, Asia Pacific: 35 days,
  Middle East: 28 days
- Cap suppliers at 10 maximum
- Cap product lines at 5 maximum
- If you cannot determine a value, use sensible defaults
- Always explain ambiguities clearly

Respond ONLY with valid JSON matching this exact structure.
No markdown, no backticks, no explanation outside the JSON:

{
  "detectedType": "suppliers",
  "companyName": null,
  "suppliers": [
    {
      "name": "string",
      "country": "string",
      "region": "North America",
      "category": "string",
      "sharePercent": 0,
      "leadTimeDays": 0,
      "confidence": "high",
      "notes": null
    }
  ],
  "productLines": [],
  "missingFields": [],
  "ambiguities": [],
  "rawColumnNames": [],
  "confidence": "high",
  "message": "string"
}`

    const { result } = await callGeminiWithRetry({
      cacheKey: `import-${fileName}-${extractedData.slice(0, 50)}`,
      cacheDurationMs: 5 * 60 * 1000,
      staleCacheDurationMs: 10 * 60 * 1000,
      thinkingBudget: 0,
      maxRetries: 2,
      prompt,
    })

    const cleaned = result
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim()

    const importResult: ImportResult = JSON.parse(cleaned)
    return NextResponse.json(importResult)

  } catch (error) {
    console.error("Import profile error:", error)
    return NextResponse.json(
      { error: "Failed to interpret file data" },
      { status: 500 }
    )
  }
}
