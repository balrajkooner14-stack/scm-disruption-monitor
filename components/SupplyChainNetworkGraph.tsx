"use client"

import { useMemo, useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ScoredEvent } from "@/lib/scoreEvents"
import {
  buildGraph,
  traverseDownstream,
  describePaths,
  simulateDisruptionRisk,
  GraphNode,
  GraphNodeType,
} from "@/lib/supplyChainGraph"
import { COLOR } from "@/lib/brand"
import { ui } from "@/lib/ui"

interface SupplyChainNetworkGraphProps {
  events: ScoredEvent[]
}

const COLUMN_ORDER: GraphNodeType[] = ["tier2-supplier", "supplier", "raw-material", "product-line", "demand"]
const COLUMN_LABELS: Record<GraphNodeType, string> = {
  "tier2-supplier": "Tier-2 suppliers",
  supplier: "Suppliers",
  "raw-material": "Raw materials",
  "product-line": "Product lines",
  demand: "Demand",
}
const COL_WIDTH = 210
const ROW_HEIGHT = 56
const NODE_W = 168
const NODE_H = 38

export default function SupplyChainNetworkGraph({ events }: SupplyChainNetworkGraphProps) {
  const { profile, isLoaded } = useCompanyProfile()
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const hasDisruptionByRegion = useMemo(() => {
    const map: Record<string, boolean> = {}
    events.filter(e => e.severity >= 2).forEach(e => {
      if (e.region) map[e.region] = true
    })
    return map
  }, [events])

  const graph = useMemo(() => (profile ? buildGraph(profile) : null), [profile])

  const layout = useMemo(() => {
    if (!graph) return null
    const byType = new Map<GraphNodeType, GraphNode[]>()
    graph.nodes.forEach(node => {
      const list = byType.get(node.type) ?? []
      list.push(node)
      byType.set(node.type, list)
    })
    const activeColumns = COLUMN_ORDER.filter(t => (byType.get(t)?.length ?? 0) > 0)
    const positions = new Map<string, { x: number; y: number }>()
    let maxRows = 1
    activeColumns.forEach((type, colIndex) => {
      const list = (byType.get(type) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label))
      maxRows = Math.max(maxRows, list.length)
      list.forEach((node, i) => {
        positions.set(node.id, { x: colIndex * COL_WIDTH + COL_WIDTH / 2, y: (i + 1) * ROW_HEIGHT })
      })
    })
    return {
      positions,
      width: activeColumns.length * COL_WIDTH,
      height: (maxRows + 1) * ROW_HEIGHT,
      activeColumns,
    }
  }, [graph])

  const selection = useMemo(() => {
    if (!graph || !selectedNodeId) return null
    const result = traverseDownstream(graph, selectedNodeId)
    const visited = new Set([selectedNodeId, ...result.reachedNodeIds])
    return { result, visited, paths: describePaths(graph, result) }
  }, [graph, selectedNodeId])

  const simulation = useMemo(() => {
    if (!profile || !graph) return []
    return simulateDisruptionRisk({ profile, graph, hasDisruptionByRegion })
  }, [profile, graph, hasDisruptionByRegion])

  if (!isLoaded || !profile || !graph || !layout) return null
  if (profile.suppliers.length === 0 || profile.productLines.length === 0) return null

  // Display order only: highest exposure first.
  const sortedSimulation = simulation
    .slice()
    .sort((a, b) => b.networkDisruptionProbabilityPercent - a.networkDisruptionProbabilityPercent)

  return (
    <>
      <section className={`${ui.card} p-7 flex flex-col gap-5`}>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-x-10 gap-y-3">
          <div className="space-y-1.5">
            <h1 className={ui.h1}>Supply chain network</h1>
            <p className={ui.body}>
              Click a supplier to trace what it would take down. Outlined in ember: in a region
              with an active disruption.
            </p>
          </div>
          <div className="flex gap-4 text-xs text-ink-2 flex-shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] border-2 border-ember" aria-hidden="true" />
              Disrupted region
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-3.5 rounded-[3px] bg-ink" aria-hidden="true" />
              Selected path
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <svg
            width={layout.width}
            height={layout.height}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="min-w-full"
            role="img"
            aria-label="Supply chain dependency diagram"
          >
            <defs>
              <marker id="scg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR.lineStrong} />
              </marker>
              <marker id="scg-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill={COLOR.ink} />
              </marker>
            </defs>

            {layout.activeColumns.map((type, i) => (
              <text
                key={type}
                x={i * COL_WIDTH + COL_WIDTH / 2}
                y={16}
                textAnchor="middle"
                fill={COLOR.ink3}
                fontSize={12}
                letterSpacing={1.4}
              >
                {COLUMN_LABELS[type].toUpperCase()}
              </text>
            ))}

            {graph.edges.map((edge, i) => {
              const from = layout.positions.get(edge.from)
              const to = layout.positions.get(edge.to)
              if (!from || !to) return null
              const inCascade = !!selection && selection.visited.has(edge.from) && selection.visited.has(edge.to)
              return (
                <line
                  key={i}
                  x1={from.x + NODE_W / 2}
                  y1={from.y}
                  x2={to.x - NODE_W / 2}
                  y2={to.y}
                  stroke={inCascade ? COLOR.ink : COLOR.lineStrong}
                  strokeWidth={inCascade ? 2.5 : 1.5}
                  opacity={selection && !inCascade ? 0.25 : 1}
                  markerEnd={inCascade ? "url(#scg-arrow-active)" : "url(#scg-arrow)"}
                />
              )
            })}

            {Array.from(graph.nodes.values()).map(node => {
              const pos = layout.positions.get(node.id)
              if (!pos) return null
              const isSelectable = node.type === "supplier" || node.type === "tier2-supplier"
              const isDisrupted = !!node.region && !!hasDisruptionByRegion[node.region]
              const isSelected = node.id === selectedNodeId
              const inCascade = !!selection && selection.visited.has(node.id) && !isSelected
              const dimmed = !!selection && !selection.visited.has(node.id)
              const isDemand = node.type === "demand"

              const dark = inCascade || isSelected
              const fill = isDemand ? COLOR.paperSunk : dark ? COLOR.ink : COLOR.surface
              const stroke = isDemand ? "none" : isDisrupted ? COLOR.ember : dark ? COLOR.ink : COLOR.line
              const strokeWidth = isDisrupted ? 2 : 1.5

              return (
                <g
                  key={node.id}
                  onClick={() => isSelectable && setSelectedNodeId(prev => (prev === node.id ? null : node.id))}
                  className={isSelectable ? "cursor-pointer" : ""}
                  opacity={dimmed ? 0.35 : 1}
                >
                  <title>{node.label}</title>
                  <rect
                    x={pos.x - NODE_W / 2}
                    y={pos.y - NODE_H / 2}
                    width={NODE_W}
                    height={NODE_H}
                    rx={8}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                  />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={dark ? 600 : 400}
                    fill={dark && !isDemand ? COLOR.onInk : COLOR.ink}
                    className="pointer-events-none select-none"
                  >
                    {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {selection && (
          <div className={`${ui.cardInner} px-5 text-[15px] leading-relaxed text-ink-2`}>
            <p className="font-semibold text-ink">
              If {graph.nodes.get(selectedNodeId as string)?.label} goes down:
            </p>
            {selection.paths.length > 0 ? (
              selection.paths.map((p, i) => <p key={i}>{p}</p>)
            ) : (
              <p>No product line currently depends on this node.</p>
            )}
          </div>
        )}
      </section>

      {sortedSimulation.length > 0 && (
        <section className={`${ui.card} p-7 flex flex-col gap-4`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-x-10 gap-y-1">
            <h2 className={ui.h2}>Simulated disruption risk</h2>
            <p className={`${ui.meta} max-w-2xl md:text-right`}>
              Monte Carlo, 1,000 trials — probability a product&apos;s supply network sees at least one
              disrupted node, given active regional disruptions and known structural risk severity.
              This measures network exposure frequency, not a precise stockout date — the app has no
              per-product consumption-rate data to forecast that.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr_180px] items-center gap-x-5 gap-y-3.5 text-[15px]">
            {sortedSimulation.map(s => (
              <div key={s.productLineId} className="contents">
                <span className="font-semibold text-ink">{s.productLineName}</span>
                <div className="h-2.5 rounded-full bg-paper-sunk overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full ${s.bufferIsTight ? "bg-ember" : "bg-heat-3"}`}
                    style={{ width: `${s.networkDisruptionProbabilityPercent}%` }}
                  />
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-ink tabular-nums">
                    {s.networkDisruptionProbabilityPercent}% exposure
                  </span>
                  {s.bufferIsTight && <span className="text-xs text-ember">buffer already tight</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
