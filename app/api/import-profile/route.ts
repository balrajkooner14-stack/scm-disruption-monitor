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
  primarySupplierName?: string
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
containing their company's supply chain data across multiple sheets.

Here is the extracted data from ALL sheets:
${extractedData}

IMPORTANT: This file may have MULTIPLE SHEETS. Each sheet may
contain different types of data:
- A "Supplier" or "Vendor" sheet → extract supplier information
- An "Inventory" or "Stock" sheet → extract product line data
- A "PO History" or "Purchase Orders" sheet → calculate on-time
  delivery rates per supplier from Order/Delivery date columns
- A "Products" sheet → extract product lines

YOUR TASK: Extract ALL useful supply chain data from ALL sheets.

SUPPLIER EXTRACTION RULES:
- Supplier name: "vendor", "supplier", "company", "partner", "name"
- Country: "country", "origin", "location", "source", country codes
- What they supply: "category", "type", "product", "material",
  "component", "description", "goods", "item"
- Share %: "share", "%", "percent", "allocation", "split", "portion"
  If no share % exists, distribute evenly across all suppliers
- Lead time: "lead time", "LT", "days", "delivery days", "transit"
  If in weeks, multiply by 7
  If missing, estimate: North America=14d, Europe=21d,
  Asia Pacific=35d, Middle East=28d

PRODUCT LINE EXTRACTION RULES:
- Product name: "product", "SKU", "item", "line", "part", "model"
- Days on hand: "DOH", "days on hand", "inventory days", "stock days"
  If given as units+daily rate: divide units by daily rate
- Reorder point: "reorder", "ROP", "safety stock", "min stock"
  If missing, use 30% of days on hand as default
- Primary supplier name: look for columns like "primary supplier",
  "supplier", "vendor", "source", "supplied by", "manufacturer".
  Extract the exact supplier name string as it appears in the file —
  this will be matched against the extracted supplier names to create
  the link. Only include this if you can confidently identify which
  supplier provides this specific product.

PO HISTORY EXTRACTION (if a PO/orders sheet exists):
- Calculate on-time delivery rate per supplier:
  Count rows where actual delivery <= expected delivery
  Divide by total rows for that supplier × 100
- Report these rates in the ambiguities field as:
  "On-time delivery rates from PO history: [Supplier]: X%"
- This helps the manager set up their health scorecard

REGION MAPPING (map to exactly one of these):
"North America": US, USA, United States, Canada, Mexico
"Europe": UK, Germany, France, Italy, Spain, Netherlands,
  Poland, Sweden, Switzerland, Belgium, DE, GB, FR, IT
"Asia Pacific": China, Japan, South Korea, India, Vietnam,
  Thailand, Indonesia, Singapore, Taiwan, Bangladesh, CN, JP, KR
"Middle East": UAE, Saudi Arabia, Israel, Turkey, Iran, AE, SA
"Latin America": Brazil, Argentina, Colombia, Chile, Peru
"Africa": Nigeria, South Africa, Kenya, Morocco, Egypt

Respond ONLY with valid JSON — no markdown, no backticks:

{
  "detectedType": "suppliers" | "inventory" | "mixed" | "unknown",
  "companyName": null,
  "suppliers": [
    {
      "name": "string",
      "country": "string",
      "region": "North America" | "Europe" | "Asia Pacific" | "Middle East" | "Latin America" | "Africa",
      "category": "string",
      "sharePercent": 0,
      "leadTimeDays": 0,
      "confidence": "high" | "medium" | "low",
      "notes": null
    }
  ],
  "productLines": [
    {
      "name": "string",
      "inventoryDaysOnHand": 0,
      "reorderPointDays": 0,
      "primarySupplierName": "string or null",
      "confidence": "high" | "medium" | "low",
      "notes": null
    }
  ],
  "missingFields": ["array of field names not found"],
  "ambiguities": ["array including on-time delivery rates if calculated from PO history"],
  "rawColumnNames": ["all column names found across all sheets"],
  "confidence": "high" | "medium" | "low",
  "message": "Brief summary of what was extracted from which sheets"
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
