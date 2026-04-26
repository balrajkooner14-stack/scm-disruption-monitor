import jsPDF from "jspdf"
import { CompanyProfile } from "@/lib/profile"
import { ScoredEvent } from "@/lib/scoreEvents"

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
  }>
  commodityPrices: Array<{
    name: string
    currentValue: number
    unit: string
    changePercent: number
    trend: "up" | "down" | "flat"
  }>
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
      color = [30, 30, 30] as [number, number, number],
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

  const addDivider = (
    yPos: number,
    color: [number, number, number] = [200, 200, 200],
  ): number => {
    setDraw(color)
    doc.setLineWidth(0.3)
    doc.line(margin, yPos, pageWidth - margin, yPos)
    return yPos + 4
  }

  const checkPageBreak = (yPos: number, neededSpace = 20): number => {
    if (yPos + neededSpace > pageHeight - margin) {
      doc.addPage()
      return margin
    }
    return yPos
  }

  const addSectionHeader = (
    title: string,
    yPos: number,
    bgColor: [number, number, number] = [15, 23, 42],
  ): number => {
    setFill(bgColor)
    doc.rect(margin, yPos - 4, contentWidth, 8, "F")
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.setTextColor(255, 255, 255)
    doc.text(title.toUpperCase(), margin + 3, yPos + 1)
    return yPos + 8
  }

  // ── Page 1 Header ──────────────────────────────────────

  setFill([15, 23, 42])
  doc.rect(0, 0, pageWidth, 35, "F")

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(255, 255, 255)
  doc.text("SCM Disruption Monitor", margin, 15)

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  setColor([148, 163, 184])
  doc.text("Daily Supply Chain Intelligence Brief", margin, 22)

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  doc.setFontSize(9)
  setColor([148, 163, 184])
  doc.text(today, pageWidth - margin, 15, { align: "right" })

  if (data.profile) {
    setColor([34, 211, 238])
    doc.text(
      `Personalized for ${data.profile.companyName}`,
      pageWidth - margin,
      22,
      { align: "right" },
    )
  }

  y = 45

  // ── Executive Summary ──────────────────────────────────

  y = addSectionHeader("Executive Summary — AI Risk Assessment", y)
  y += 2

  if (data.aiSummaryPoints.length > 0) {
    for (const point of data.aiSummaryPoints) {
      y = checkPageBreak(y, 15)
      setFill([59, 130, 246])
      doc.circle(margin + 2, y - 1, 1, "F")
      y = addText(point, margin + 6, y, {
        fontSize: 10,
        maxWidth: contentWidth - 6,
      })
      y += 2
    }
  } else {
    y = addText("AI summary not available for this brief.", margin, y, {
      color: [100, 116, 139],
    })
  }

  y += 4
  y = addDivider(y)

  // ── KPI Snapshot ───────────────────────────────────────

  y = checkPageBreak(y, 25)
  y = addSectionHeader("Situation Snapshot", y)
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
    { label: "ACTIVE EVENTS", value: String(data.events.length), color: [59, 130, 246] },
    {
      label: "CRITICAL",
      value: String(criticalCount),
      color: criticalCount > 0 ? [239, 68, 68] : [100, 116, 139],
    },
    {
      label: data.profile ? "AFFECTING YOUR NETWORK" : "WARNINGS",
      value: String(data.profile ? profileMatchCount : warningCount),
      color: [245, 158, 11],
    },
  ]

  for (let i = 0; i < kpiBoxes.length; i++) {
    const kpi = kpiBoxes[i]
    const x = margin + i * (kpiWidth + 4)
    setFill([248, 250, 252])
    setDraw(kpi.color)
    doc.setLineWidth(0.5)
    doc.rect(x, y, kpiWidth, 16, "FD")
    setFill(kpi.color)
    doc.rect(x, y, kpiWidth, 2, "F")
    doc.setFontSize(16)
    doc.setFont("helvetica", "bold")
    setColor(kpi.color)
    doc.text(kpi.value, x + kpiWidth / 2, y + 10, { align: "center" })
    doc.setFontSize(7)
    doc.setFont("helvetica", "normal")
    setColor([100, 116, 139])
    doc.text(kpi.label, x + kpiWidth / 2, y + 14, { align: "center" })
  }

  y += 22
  y = addDivider(y)

  // ── AI Advisor Recommendations ─────────────────────────

  if (data.recommendations.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader("AI Advisor — Recommended Actions", y)
    y += 4

    for (const rec of data.recommendations.slice(0, 4)) {
      y = checkPageBreak(y, 25)

      const priorityColor: [number, number, number] =
        rec.priority === "CRITICAL"
          ? [239, 68, 68]
          : rec.priority === "HIGH"
            ? [245, 158, 11]
            : [100, 116, 139]

      setFill(priorityColor)
      doc.rect(margin, y, 2, 18, "F")

      doc.setFontSize(7)
      doc.setFont("helvetica", "bold")
      setColor(priorityColor)
      doc.text(rec.priority, margin + 5, y + 4)

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor([100, 116, 139])
      doc.text(rec.timeframe, margin + 30, y + 4)

      doc.setFontSize(10)
      doc.setFont("helvetica", "bold")
      setColor([30, 30, 30])
      doc.text(rec.title, margin + 5, y + 9)

      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      setColor([71, 85, 105])
      const actionLines = doc.splitTextToSize(rec.action, contentWidth - 8) as string[]
      doc.text(actionLines, margin + 5, y + 14)

      y += 14 + actionLines.length * 4 + 4
    }

    y = addDivider(y)
  }

  // ── Top Events ─────────────────────────────────────────

  const topEvents = data.events.filter((e) => e.severity >= 2).slice(0, 8)

  if (topEvents.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader(
      data.profile
        ? "Top Events — Filtered for Your Supply Chain"
        : "Top Events — Critical & Warning",
      y,
    )
    y += 4

    for (const event of topEvents) {
      y = checkPageBreak(y, 16)

      const sevColor: [number, number, number] =
        event.severity === 3 ? [239, 68, 68] : [245, 158, 11]
      const sevLabel = event.severity === 3 ? "CRITICAL" : "WARNING"

      setFill(sevColor)
      doc.roundedRect(margin, y - 3, 18, 5, 1, 1, "F")
      doc.setFontSize(6)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(255, 255, 255)
      doc.text(sevLabel, margin + 9, y + 0.5, { align: "center" })

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor([100, 116, 139])
      doc.text(`${event.category} · ${event.region}`, margin + 21, y)

      if (event.isProfileMatch) {
        setFill([34, 211, 238])
        doc.roundedRect(margin + 68, y - 3, 20, 5, 1, 1, "F")
        doc.setFontSize(6)
        doc.setFont("helvetica", "bold")
        setColor([15, 23, 42])
        doc.text("RELEVANT", margin + 78, y + 0.5, { align: "center" })
      }

      y += 5

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      setColor([30, 30, 30])
      const titleLines = doc.splitTextToSize(event.title, contentWidth - 4) as string[]
      doc.text(titleLines, margin + 2, y)
      y += titleLines.length * 4

      doc.setFontSize(7)
      doc.setFont("helvetica", "normal")
      setColor([148, 163, 184])
      doc.text(event.sourceDomain || "Source unavailable", margin + 2, y)
      y += 6
    }

    y = addDivider(y)
  }

  // ── Commodity Snapshot ─────────────────────────────────

  if (data.commodityPrices.length > 0) {
    y = checkPageBreak(y, 30)
    y = addSectionHeader("Market Snapshot — Commodity Prices", y)
    y += 4

    for (const commodity of data.commodityPrices) {
      y = checkPageBreak(y, 10)

      const trendArrow =
        commodity.trend === "up" ? "▲" : commodity.trend === "down" ? "▼" : "→"
      const trendColor: [number, number, number] =
        commodity.trend === "up"
          ? [239, 68, 68]
          : commodity.trend === "down"
            ? [34, 197, 94]
            : [100, 116, 139]

      doc.setFontSize(9)
      doc.setFont("helvetica", "bold")
      setColor([30, 30, 30])
      doc.text(commodity.name, margin + 2, y)

      doc.setFont("helvetica", "normal")
      setColor([71, 85, 105])
      doc.text(
        `${commodity.currentValue.toLocaleString()} ${commodity.unit}`,
        margin + 50,
        y,
      )

      doc.setFont("helvetica", "bold")
      setColor(trendColor)
      doc.text(
        `${trendArrow} ${Math.abs(commodity.changePercent).toFixed(1)}%`,
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
    setColor([148, 163, 184])
    doc.text(
      `SCM Disruption Monitor · Data: GDELT Project · AI: Google Gemini 2.5 Flash · Generated ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" },
    )
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    })
  }

  return doc
}
