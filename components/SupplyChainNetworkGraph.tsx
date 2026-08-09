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

interface SupplyChainNetworkGraphProps {
  events: ScoredEvent[]
}

const COLUMN_ORDER: GraphNodeType[] = ["tier2-supplier", "supplier", "raw-material", "product-line", "demand"]
const COLUMN_LABELS: Record<GraphNodeType, string> = {
  "tier2-supplier": "Tier-2 Suppliers",
  supplier: "Suppliers",
  "raw-material": "Raw Materials",
  "product-line": "Product Lines",
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

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">🕸️</span>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Supply Chain Network
        </h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Click any supplier or sub-supplier to see what it would take down downstream —
        {" "}<span className="text-red-400">red</span> nodes are in a region with an active disruption right now.
      </p>

      <div className="overflow-x-auto">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="min-w-full"
        >
          <defs>
            <marker id="scg-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" />
            </marker>
            <marker id="scg-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
            </marker>
          </defs>

          {layout.activeColumns.map((type, i) => (
            <text
              key={type}
              x={i * COL_WIDTH + COL_WIDTH / 2}
              y={16}
              textAnchor="middle"
              className="fill-slate-500"
              fontSize={10}
              letterSpacing={0.5}
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
                stroke={inCascade ? "#f59e0b" : "#475569"}
                strokeWidth={inCascade ? 2 : 1.25}
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

            let fill = "#1e293b"
            let stroke = "#475569"
            if (isDisrupted) { fill = "#450a0a"; stroke = "#dc2626" }
            if (inCascade) { fill = "#451a03"; stroke = "#f59e0b" }
            if (isSelected) { stroke = "#3b82f6" }

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
                  rx={6}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 2.5 : 1.25}
                />
                <text
                  x={pos.x}
                  y={pos.y + 4}
                  textAnchor="middle"
                  fontSize={11}
                  className="fill-slate-200 pointer-events-none select-none"
                >
                  {node.label.length > 22 ? `${node.label.slice(0, 21)}…` : node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {selection && (
        <div className="mt-3 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
          <p className="text-xs text-amber-300 font-medium mb-1">
            If {graph.nodes.get(selectedNodeId as string)?.label} is disrupted:
          </p>
          {selection.paths.length > 0 ? (
            selection.paths.map((p, i) => (
              <p key={i} className="text-xs text-amber-500/80">{p}</p>
            ))
          ) : (
            <p className="text-xs text-amber-500/80">No product line currently depends on this node.</p>
          )}
        </div>
      )}

      {simulation.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
            Simulated Disruption Risk
          </p>
          <p className="text-xs text-slate-600 mb-3">
            Monte Carlo, 1,000 trials — probability a product&apos;s supply network sees at least one
            disrupted node, given active regional disruptions and known structural risk severity.
            This measures network exposure frequency, not a precise stockout date — the app has no
            per-product consumption-rate data to forecast that.
          </p>
          <div className="space-y-1.5">
            {simulation.map(s => {
              const color =
                s.networkDisruptionProbabilityPercent >= 50
                  ? "text-red-400"
                  : s.networkDisruptionProbabilityPercent >= 20
                  ? "text-amber-400"
                  : "text-green-400"
              return (
                <div key={s.productLineId} className="flex items-center justify-between text-xs bg-slate-900/40 border border-slate-700 rounded-lg px-3 py-2">
                  <span className="text-slate-300">{s.productLineName}</span>
                  <span className="flex items-center gap-2">
                    {s.bufferIsTight && <span className="text-amber-500">buffer already tight ·</span>}
                    <span className={`font-bold ${color}`}>{s.networkDisruptionProbabilityPercent}% network exposure</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
