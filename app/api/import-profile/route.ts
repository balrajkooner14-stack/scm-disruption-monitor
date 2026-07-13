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
  // Raw $ figures — populated instead of inventoryDaysOnHand when the file
  // expresses inventory as dollar value + usage rather than a days number.
  // inventoryDaysOnHand is computed from these deterministically after
  // Gemini responds (see lib/importCalculations.ts).
  onHandValue?: number
  usageValue?: number
  usageWindowDays?: number
  confidence: "high" | "medium" | "low"
  notes?: string
}

export interface UnmappedDataEntry {
  sheetOrSection: string
  detectedDimension: string
  detectedMetrics: string[]
  reason: string
}

export interface ImportResult {
  detectedType: "suppliers" | "inventory" | "mixed" | "unknown"
  companyName?: string
  suppliers: ImportedSupplier[]
  productLines: ImportedProductLine[]
  unmappedData: UnmappedDataEntry[]
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

UNIVERSAL EXCLUSION RULE (applies everywhere below):
Skip any row whose primary label/dimension value is "Grand Total",
"Total", "Subtotal", "Sum", or similar case-insensitive variants.
These are spreadsheet aggregation artifacts, not real suppliers,
products, customers, factories, or regions — never extract them as
if they were a real entity.

DIMENSION CLASSIFICATION — DO THIS FIRST, before applying any rule below:
For each sheet/section, find the column that uniquely labels each row
(usually the first column, or whichever has a distinct, non-numeric
value per row). The HEADER of that column is your primary signal for
what the rows represent — trust it over any other pattern-matching,
including the presence of dollar-value metrics:
- Header like "Supplier", "Vendor", "Company", "Partner" → supplier data
- Header like "Product", "SKU", "Item", "Part", "Model", "Line" → product data
- Header like "Customer", "Client", "Account" → customer data — NOT
  supplier or product, even if dollar inventory metrics are present
- Header like "Factory", "Site", "Plant", "Facility", "Location",
  "Cost Center" → facility data — NOT supplier or product, even if
  dollar inventory metrics are present
- Header like "Region", "Territory", "Segment", "Sales Region" where
  the row VALUES don't match real country/geography names → an
  internal planning/business dimension, not geography — do not guess
  what it means, and do NOT treat it as product or supplier data
Only apply the SUPPLIER or PRODUCT LINE extraction rules below if the
dimension column header itself genuinely indicates suppliers or
products. Dollar-value inventory metrics (On Hand $, Usage $, etc.)
being present is NOT by itself sufficient to classify rows as product
line data — customers, factories, and other things also get tracked
with dollar inventory positions. The metrics tell you WHAT is being
measured; the dimension column header tells you WHO/WHAT it's being
measured about — and that second thing is what determines supplier
vs. product vs. unmapped. When genuinely unsure, prefer unmappedData
over guessing.

SUPPLIER EXTRACTION RULES:
- Supplier name: "vendor", "supplier", "company", "partner", "name"
- Country: "country", "origin", "location", "source", country codes
- What they supply: "category", "type", "product", "material",
  "component", "description", "goods", "item"
- Share %: "share", "%", "percent", "allocation", "split", "portion"
  If no share % column exists, leave sharePercent as 0 — do not
  calculate or guess a distribution yourself. Note in ambiguities
  that share % was not found; it will be filled in deterministically
  after extraction.
- Lead time: "lead time", "LT", "days", "delivery days", "transit"
  If in weeks, multiply by 7
  If missing, estimate: North America=14d, Europe=21d,
  Asia Pacific=35d, Middle East=28d

PRODUCT LINE EXTRACTION RULES:
- Product name: "product", "SKU", "item", "line", "part", "model"
- Days on hand — TWO possible forms, check for both:
  (a) Direct days figure: "DOH", "days on hand", "inventory days",
      "stock days". If given as units+daily rate: divide units by
      daily rate. Put the result in inventoryDaysOnHand.
  (b) Dollar-value form: a column like "On Hand $", "Inventory $",
      "On-hand value" (a dollar stock position) paired with a usage/
      consumption dollar column like "Usage $", "Monthly usage",
      "Consumption $", "3mo Usage $" — ONLY when the sheet already
      passed the DIMENSION CLASSIFICATION check above as product
      data. If the dimension is a customer, factory, or other
      non-product identifier, this $-value pattern belongs in
      unmappedData instead, even though the columns look identical.
      When you find this pattern on genuine product rows, do NOT
      calculate days yourself — instead set inventoryDaysOnHand
      to 0 and populate onHandValue (the $ figure) and usageValue (the
      $ figure) plus usageWindowDays: the number of days the usage
      column covers, inferred from its name (e.g. "3mo Usage $" → 90,
      "6mo Usage $" → 180, "Monthly usage" or a plain "Usage $" with
      no stated window → 30 as a reasonable default). These raw
      figures will be converted to a days-on-hand number
      deterministically after extraction.
  A single product row should use EITHER form (a) or (b), never both.
- Reorder point: "reorder", "ROP", "safety stock", "min stock"
  If missing, use 30% of days on hand as default
- Primary supplier name: look for columns like "primary supplier",
  "supplier", "vendor", "source", "supplied by", "manufacturer".
  Extract the exact supplier name string as it appears in the file —
  this will be matched against the extracted supplier names to create
  the link. Only include this if you can confidently identify which
  supplier provides this specific product.

UNMAPPED DATA DETECTION:
Not every sheet or section will contain supplier or product data, and
that's fine — do not force a match. For each sheet/section whose
dimension column header, per the DIMENSION CLASSIFICATION step above,
does not genuinely indicate suppliers or products (e.g. it indicates
customers, factories, sites, or an unclear internal business
dimension), do not extract any suppliers or products from it — this
applies even when the sheet contains dollar-value metrics that look
like the inventory pattern described above. Instead add one entry to
unmappedData describing what you actually found:
- sheetOrSection: the sheet name or a short label for the section
- detectedDimension: what the rows ARE organized by instead (e.g.
  "Customer", "Factory", "Sales Region", "Cost Center") — the column
  that looks like it identifies each row
- detectedMetrics: the names of numeric/dollar columns present
- reason: one plain-language sentence explaining why this doesn't map
  to a supplier or product profile (e.g. "Rows represent customers,
  not suppliers or products, so this doesn't fit the current profile
  fields.")
This applies per-sheet/section — a single file can produce both real
suppliers/products from one sheet AND an unmappedData entry from
another sheet that doesn't fit.

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
      "onHandValue": null,
      "usageValue": null,
      "usageWindowDays": null,
      "confidence": "high" | "medium" | "low",
      "notes": null
    }
  ],
  "unmappedData": [
    {
      "sheetOrSection": "string",
      "detectedDimension": "string",
      "detectedMetrics": ["array of column names"],
      "reason": "string"
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
    importResult.unmappedData = importResult.unmappedData ?? []
    return NextResponse.json(importResult)

  } catch (error) {
    console.error("Import profile error:", error)
    return NextResponse.json(
      { error: "Failed to interpret file data" },
      { status: 500 }
    )
  }
}
