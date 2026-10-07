import jsPDF from "jspdf"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"
import { BRAND } from "@/lib/brand"

export interface BriefData {
  profile: CompanyProfile | null
  events: ScoredEvent[]
  aiSummaryPoints: string[]
  recommendations: Array<{
    title: string
    priority: string
    problem: string
    action: string
    timeframe: string
    affectedSuppliers?: string[]
  }>
  commodityPrices: Array<{
    name: string
    currentValue: number
    unit: string
    changePercent: number
    trend: "up" | "down" | "flat"
  }>
  costEstimates?: Array<{
    supplierName: string
    revenueAtRiskLow: number
    revenueAtRiskHigh: number
    mitigationCost: number
    mitigationAction: string
  }>
  concentrationRisk?: {
    hhi: number
    label: string
    largestCountry: string
    largestCountryShare: number
  }
  historyEntries?: Array<{
    date: string
    title: string
    severityLabel: string
    category: string
    isProfileMatch: boolean
  }>
  inventoryRecommendations?: Array<{
    productName: string
    riskLevel: string
    daysRemaining: number
    recommendedOrderDays: number
    urgencyLabel: string
    supplierName: string
    leadTimeDays: number
  }>
}

// First Light palette (RGB). jsPDF's built-in fonts only: "times" for
// headings and big numbers, "helvetica" for body. Built-in fonts are
// WinAnsi-encoded, so arrows (→ ▲ ▼) can't be drawn — use words and signs.
type RGB = [number, number, number]
const PDF = {
  ink: [27, 35, 48] as RGB,
  paper: [244, 239, 230] as RGB,
  paperRaised: [251, 248, 242] as RGB,
  line: [221, 213, 198] as RGB,
  secondary: [62, 73, 85] as RGB,
  caption: [90, 100, 112] as RGB,
  bandSecondary: [201, 194, 181] as RGB,
  dawn: [224, 160, 119] as RGB,
  ember: [176, 74, 34] as RGB,
  ochre: [110, 75, 12] as RGB,
  ochreTint: [243, 230, 200] as RGB,
  sea: [51, 80, 92] as RGB,
  moss: [63, 107, 76] as RGB,
}

const PT = 0.3528 // 1pt in mm

function formatPDFCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`
  return `$${amount.toLocaleString()}`
}

export function generateDailyBrief(data: BriefData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentWidth = pageWidth - margin * 2
  let y = margin

  // ── Helpers ────────────────────────────────────────────

  const setFill = (c: [number, number, number]) =>
    doc.setFillColor(c[0], c[1], c[2])
  const setDraw = (c: [number, number, number]) =>
    doc.setDrawColor(c[0], c[1], c[2])
  const setColor = (c: [number, number, number]) =>
    doc.setTextColor(c[0], c[1], c[2])

  const addText = (
    text: string,
    x: number,
    yPos: number,
    opts: {
      fontSize?: number
      fontStyle?: "normal" | "bold" | "italic"
      color?: [number, number, number]
      align?: "left" | "center" | "right"
      maxWidth?: number
    } = {},
  ): number => {
    const {
      fontSize = 10,
      fontStyle = "normal",
      color = PDF.ink,
      align = "left",
      maxWidth = contentWidth,
    } = opts
    doc.setFontSize(fontSize)
    doc.setFont("helvetica", fontStyle)
    setColor(color)
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    doc.text(lines, x, yPos, { align })
    return yPos + lines.length * (fontSize * 0.45)
  }

  // Section spacer. Each section title now carries its own rule, so a second
  // line here would double up.
  const addDivider = (yPos: number): number => yPos + 4

  const checkPageBreak = (yPos: number, neededSpace = 20): number => {
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage()
      return margin
    }
    return yPos
  }

  // Section title in Times 14pt ink with a thin rule beneath — no filled bars.
  const addSectionHeader = (title: string, yPos: number): number => {
    doc.setFontSize(14)
    doc.setFont("times", "normal")
    setColor(PDF.ink)
    doc.text(title, margin, yPos + 1)
    setDraw(PDF.line)
    doc.setLineWidth(0.3 * PT)
    doc.line(margin, yPos + 3, pageWidth - margin, yPos + 3)
    return yPos + 8
  }

  // ── Page 1 Header ──────────────────────────────────────

  const bandHeight = 35
  setFill(PDF.ink)
  doc.rect(0, 0, pageWidth, bandHeight, "F")

  // Logo mark (~8mm wide): half sun on the horizon with one arc of glow.
  // Draw order: dawn outline -> ember disc -> cover lower half -> horizon.
  const sunR = 2.6
  const sunCx = margin + sunR * 1.5
  const horizonY = 15
  setDraw(PDF.dawn)
  doc.setLineWidth(0.3 * PT)
  doc.circle(sunCx, horizonY, sunR * 1.5, "S")
  setFill(PDF.ember)
  doc.circle(sunCx, horizonY, sunR, "F")
  setFill(PDF.ink)
  doc.rect(sunCx - sunR * 1.5 - 1, horizonY, sunR * 3 + 2, sunR * 1.5 + 1, "F")
  setDraw(PDF.paper)
  doc.setLineWidth(0.6 * PT)
  doc.line(sunCx - sunR - 1.5, horizonY, sunCx + sunR + 1.5, horizonY)

  doc.setFontSize(20)
  doc.setFont("times", "normal")
  setColor(PDF.paper)
  doc.text(BRAND.name, margin + sunR * 3 + 3, horizonY)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  setColor(PDF.bandSecondary)
  doc.text("Daily supply chain intelligence brief", margin, 24)

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  doc.setFontSize(9)
  setColor(PDF.bandSecondary)
  doc.text(today, pageWidth - margin, 15, { align: "right" })

  if (data.profile) {
    setColor(PDF.dawn)
    doc.text(
      `Personalized for ${data.profile.companyName}`,
      pageWidth - margin,
      22,
      { align: "right" },
    )
  }

  y = 45

  // ── Executive Summary ──────────────────────────────────

  y = addSectionHeader("Executive summary — AI risk assessment", y)
  y += 2

  if (data.aiSummaryPoints.length > 0) {
    for (const point of data.aiSummaryPoints) {
      y = checkPageBreak(y, 15)
      setFill(PDF.ember)
      doc.circle(margin + 2, y - 1, 0.8, "F")
      y = addText(point, margin + 6, y, {
        fontSize: 10,
        maxWidth: contentWidth - 6,
      })
      y += 2
    }
  } else {
    y = addText("AI summary not available for this brief.", margin, y, {
      color: PDF.caption,
    })
  }

  y += 4
  y = addDivider(y)

  // ── KPI Snapshot ───────────────────────────────────────

  y = checkPageBreak(y, 25)
  y = addSectionHeader("Situation snapshot", y)
  y += 4

  const criticalCount = data.events.filter((e) => e.severity === 3).length
  const warningCount = data.events.filter((e) => e.severity === 2).length
  const profileMatchCount = data.events.filter((e) => e.isProfileMatch).length

  const kpiWidth = (contentWidth - 8) / 3
  const kpiBoxes: Array<{
    label: string
    value: string
    color: [number, number, number]
  }> = [
    { label: "ACTIVE EVENTS", value: String(data.events.length), color: PDF.ink },
    {
      label: "CRITICAL",
      value: String(criticalCount),
      color: criticalCount > 0 ? PDF.ember : PDF.ink,
    },
    {
      label: data.profile ? "AFFECTING YOUR NETWORK" : "WARNINGS",
      value: String(data.profile ? profileMatchCount : warningCount),
      color: PDF.ink,
    },
  ]

  for (let i = 0; i < kpiBoxes.length; i++) {
    const kpi = kpiBoxes[i]
    const x = margin + i * (kpiWidth + 4)
    setFill(PDF.paperRaised)
    setDraw(PDF.line)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, y, kpiWidth, 16, 1.5, 1.5, "FD")
    doc.setFontSize(18)
    doc.setFont("times", "normal")
    setColor(kpi.color)
    doc.text(kpi.value, x + kpiWidth / 2, y + 9.5, { align: "center" })
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    setColor(PDF.caption)
    doc.text(kpi.label, x + kpiWidth / 2, y + 14, { align: "center" })
  }

  y += 22

  if (data.concentrationRisk) {
    const { concentrationRisk } = data
    y = checkPageBreak(y, 12)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    setColor(PDF.ink)
    doc.text("Network concentration:", margin + 2, y)
    doc.setFont("helvetica", "normal")
    const hhiColor: [number, number, number] =
      concentrationRisk.hhi > 5000
        ? PDF.ember
        : concentrationRisk.hhi > 2500
        ? PDF.ochre
        : concentrationRisk.hhi > 1500
        ? PDF.secondary
        : PDF.moss
    setColor(hhiColor)
    doc.text(
      `HHI ${concentrationRisk.hhi.toLocaleString()} — ${concentrationRisk.label} ` +
        `(Largest: ${concentrationRisk.largestCountry} ${concentrationRisk.largestCountryShare}%)`,
      margin + 45,
      y
    )
    y += 8
  }

  y = addDivider(y)

  // ── Inventory Action Required ──────────────────────────

  if (data.inventoryRecommendations && data.inventoryRecommendations.length > 0) {
    y = checkPageBreak(y, 25)
    y = addSectionHeader("Inventory action required", y)
    y += 4

    data.inventoryRecommendations.forEach(item => {
      y = checkPageBreak(y, 12)

      const urgencyColor: [number, number, number] =
        item.urgencyLabel === "Order Today"
          ? PDF.ember
          : item.urgencyLabel === "Order This Week"
          ? PDF.ochre
          : PDF.secondary

      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      setColor(urgencyColor)
      doc.text(`[${item.urgencyLabel.toUpperCase()}]`, margin + 2, y)

      doc.setFont("helvetica", "bold")
      setColor(PDF.ink)
      doc.text(item.productName, margin + 35, y)

      doc.setFont("helvetica", "normal")
      setColor(PDF.secondary)
      doc.text(
        `${item.daysRemaining}d remaining · order ${item.recommendedOrderDays}d supply from ${item.supplierName}`,
        margin + 4,
        y + 5
      )
      y += 11
    })

    y = addDivider(y)
  }

  // ── AI Advisor Recommendations ─────────────────────────

  if (data.recommendations.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader("AI advisor — recommended actions", y)
    y += 4

    for (const rec of data.recommendations.slice(0, 4)) {
      y = checkPageBreak(y, 25)

      const priorityColor: [number, number, number] =
        rec.priority === "CRITICAL"
          ? PDF.ember
          : rec.priority === "HIGH"
            ? PDF.ochre
            : PDF.sea
      // Same labels as the app: MEDIUM reads "MONITOR".
      const priorityLabel = rec.priority === "MEDIUM" ? "MONITOR" : rec.priority

      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      setColor(priorityColor)
      doc.text(priorityLabel, margin, y + 4)

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor(PDF.caption)
      doc.text(rec.timeframe, margin + 25, y + 4)

      doc.setFontSize(12)
      doc.setFont("times", "normal")
      setColor(PDF.ink)
      doc.text(rec.title, margin, y + 9.5)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      setColor(PDF.secondary)
      const actionLines = doc.splitTextToSize(rec.action, contentWidth - 3) as string[]
      doc.text(actionLines, margin, y + 14)

      y += 14 + actionLines.length * 4 + 2

      const costMatch = data.costEstimates?.find(
        c => c.supplierName === rec.affectedSuppliers?.[0]
      )
      if (costMatch) {
        y = checkPageBreak(y, 10)
        doc.setFontSize(8)
        doc.setFont("helvetica", "bold")
        setColor(PDF.ochre)
        doc.text(
          `Financial impact: ${formatPDFCurrency(costMatch.revenueAtRiskLow)}–${formatPDFCurrency(costMatch.revenueAtRiskHigh)} at risk · ` +
          `${formatPDFCurrency(costMatch.mitigationCost)} mitigation (${costMatch.mitigationAction})`,
          margin,
          y
        )
        y += 5
      }

      y += 2
    }

    y = addDivider(y)
  }

  // ── Top Events ─────────────────────────────────────────

  const topEvents = data.events.filter((e) => e.severity >= 2).slice(0, 8)

  if (topEvents.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader(
      data.profile
        ? "Top events — filtered for your supply chain"
        : "Top events — critical and warning",
      y,
    )
    y += 4

    for (const event of topEvents) {
      y = checkPageBreak(y, 16)

      // Critical: white on ember. Warning: ochre on ochre tint (as in the app).
      const isCritical = event.severity === 3
      const sevLabel = isCritical ? "CRITICAL" : "WARNING"

      setFill(isCritical ? PDF.ember : PDF.ochreTint)
      doc.roundedRect(margin, y - 3, 18, 5, 2.5, 2.5, "F")
      doc.setFontSize(6)
      doc.setFont("helvetica", "bold")
      if (isCritical) doc.setTextColor(255, 255, 255)
      else setColor(PDF.ochre)
      doc.text(sevLabel, margin + 9, y + 0.5, { align: "center" })

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor(PDF.caption)
      doc.text(`${event.category} · ${event.region}`, margin + 21, y)

      if (event.isProfileMatch) {
        doc.setFontSize(6)
        doc.setFont("helvetica", "bold")
        setColor(PDF.ember)
        doc.text("YOUR NETWORK", margin + 70, y)
      }

      y += 5

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      setColor(PDF.ink)
      const titleLines = doc.splitTextToSize(event.title, contentWidth - 4) as string[]
      doc.text(titleLines, margin + 2, y)
      y += titleLines.length * 4

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor(PDF.caption)
      doc.text(event.sourceDomain || "Source unavailable", margin + 2, y)
      y += 6
    }

    y = addDivider(y)
  }

  // ── Historical Context ─────────────────────────────────

  const todayIso = new Date().toISOString().split("T")[0]
  const historicalEntries = (data.historyEntries ?? [])
    .filter(e => e.date < todayIso)
    .slice(0, 5)

  if (historicalEntries.length > 0) {
    y = checkPageBreak(y, 20)
    y = addSectionHeader("Historical context — recent past events", y)
    y += 4

    historicalEntries.forEach(entry => {
      y = checkPageBreak(y, 8)
      const sevColor: [number, number, number] =
        entry.severityLabel === "CRITICAL" ? PDF.ember : PDF.ochre
      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      setColor(sevColor)
      doc.text(`[${entry.severityLabel}]`, margin + 2, y)
      doc.setFont("helvetica", "normal")
      setColor(PDF.caption)
      doc.text(`${entry.date} · ${entry.category}`, margin + 22, y)
      y += 4
      doc.setFontSize(8)
      setColor(PDF.ink)
      const titleLines = doc.splitTextToSize(entry.title, contentWidth - 6) as string[]
      doc.text(titleLines, margin + 4, y)
      y += titleLines.length * 3.5 + 3
    })

    y = addDivider(y)
  }

  // ── Commodity Snapshot ─────────────────────────────────

  if (data.commodityPrices.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader("Market snapshot — commodity prices", y)
    y += 4

    for (const commodity of data.commodityPrices) {
      y = checkPageBreak(y, 10)

      // Signed percent instead of arrows (built-in PDF fonts lack them).
      const sign =
        commodity.trend === "up" ? "+" : commodity.trend === "down" ? "-" : ""
      const trendColor: [number, number, number] =
        commodity.trend === "up"
          ? PDF.ember
          : commodity.trend === "down"
            ? PDF.sea
            : PDF.caption

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      setColor(PDF.ink)
      doc.text(commodity.name, margin + 2, y)

      doc.setFont("helvetica", "normal")
      setColor(PDF.secondary)
      doc.text(
        `${commodity.currentValue.toLocaleString()} ${commodity.unit}`,
        margin + 50,
        y,
      )

      doc.setFont("helvetica", "bold")
      setColor(trendColor)
      doc.text(
        `${sign}${Math.abs(commodity.changePercent).toFixed(1)}%`,
        margin + 110,
        y,
      )

      y += 6
    }

    y += 2
    y = addDivider(y)
  }

  // ── Footer on all pages ────────────────────────────────

  const totalPages = (doc as jsPDF & { getNumberOfPages(): number }).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    setColor(PDF.caption)
    doc.text(
      `${BRAND.name} · News data from the GDELT Project, GDACS and NOAA · AI analysis by Google Gemini · Generated ${new Date().toLocaleDateString()}`,
      margin,
      pageHeight - 8,
    )
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    })
  }

  return doc
}
