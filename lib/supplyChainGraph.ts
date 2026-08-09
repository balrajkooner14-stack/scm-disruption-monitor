import type { CompanyProfile, SupplyRegion } from "@/lib/profile"
import { STRUCTURAL_RISKS, StructuralRisk } from "@/lib/structuralRisk"

export type GraphNodeType = "tier2-supplier" | "supplier" | "raw-material" | "product-line" | "demand"

export interface GraphNode {
  id: string
  type: GraphNodeType
  label: string
  region?: SupplyRegion
  country?: string
  category?: string // suppliers only — used for structural-risk matching in the simulation
}

export interface GraphEdge {
  from: string
  to: string
}

export interface SupplyChainGraph {
  nodes: Map<string, GraphNode>
  edges: GraphEdge[]
  adjacency: Map<string, string[]>
}

export const DEMAND_NODE_ID = "demand"
export const supplierNodeId = (id: string) => `supplier:${id}`
export const tier2NodeId = (id: string) => `tier2:${id}`
export const materialNodeId = (id: string) => `material:${id}`
export const productNodeId = (id: string) => `product:${id}`

/**
 * Builds the multi-tier dependency graph from data the profile already
 * collects: Supplier.tier2Suppliers -> Supplier -> (ProductLine.rawMaterials
 * vendors ->) RawMaterial -> ProductLine -> a single synthetic demand node.
 * Primary-supplier resolution mirrors inventoryRisk.ts's fallback (explicit
 * primarySupplierId, else highest-share supplier); backup/secondary vendor
 * edges are added only when explicitly set — no fallback, same convention
 * as the rest of the app.
 */
export function buildGraph(profile: CompanyProfile): SupplyChainGraph {
  const nodes = new Map<string, GraphNode>()
  const edges: GraphEdge[] = []
  const addNode = (node: GraphNode) => nodes.set(node.id, node)
  const addEdge = (from: string, to: string) => edges.push({ from, to })

  addNode({ id: DEMAND_NODE_ID, type: "demand", label: "Consumer Demand" })

  for (const supplier of profile.suppliers) {
    const sId = supplierNodeId(supplier.id)
    addNode({
      id: sId,
      type: "supplier",
      label: supplier.name || "Unnamed supplier",
      region: supplier.region,
      country: supplier.country,
      category: supplier.category,
    })
    for (const t2 of supplier.tier2Suppliers ?? []) {
      const tId = tier2NodeId(t2.id)
      addNode({
        id: tId,
        type: "tier2-supplier",
        label: t2.name || "Unnamed sub-supplier",
        region: t2.region,
        country: t2.country,
      })
      addEdge(tId, sId)
    }
  }

  const highestShareSupplier =
    profile.suppliers.length > 0
      ? profile.suppliers.reduce((a, b) => (a.sharePercent > b.sharePercent ? a : b))
      : null

  for (const product of profile.productLines) {
    const pId = productNodeId(product.id)
    addNode({ id: pId, type: "product-line", label: product.name || "Unnamed product" })
    addEdge(pId, DEMAND_NODE_ID)

    const primaryId = product.primarySupplierId ?? highestShareSupplier?.id
    if (primaryId && nodes.has(supplierNodeId(primaryId))) {
      addEdge(supplierNodeId(primaryId), pId)
    }
    if (product.backupSupplierId && nodes.has(supplierNodeId(product.backupSupplierId))) {
      addEdge(supplierNodeId(product.backupSupplierId), pId)
    }

    for (const material of product.rawMaterials ?? []) {
      const mId = materialNodeId(material.id)
      addNode({ id: mId, type: "raw-material", label: material.name || "Unnamed material" })
      addEdge(mId, pId)
      if (material.primaryVendorId && nodes.has(supplierNodeId(material.primaryVendorId))) {
        addEdge(supplierNodeId(material.primaryVendorId), mId)
      }
      if (material.secondaryVendorId && nodes.has(supplierNodeId(material.secondaryVendorId))) {
        addEdge(supplierNodeId(material.secondaryVendorId), mId)
      }
    }
  }

  const adjacency = new Map<string, string[]>()
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? []
    list.push(edge.to)
    adjacency.set(edge.from, list)
  }

  return { nodes, edges, adjacency }
}

export interface TraversalResult {
  reachedNodeIds: string[]
  pathsToProductLines: Record<string, string[]> // product-line node id -> ordered node ids from start to product
}

/** BFS downstream from a disrupted node. Pure, no AI call. */
export function traverseDownstream(graph: SupplyChainGraph, startNodeId: string): TraversalResult {
  const visited = new Set<string>([startNodeId])
  const parent: Record<string, string> = {}
  const queue: string[] = [startNodeId]
  const reached: string[] = []

  while (queue.length > 0) {
    const current = queue.shift() as string
    const neighbors = graph.adjacency.get(current) ?? []
    for (const next of neighbors) {
      if (visited.has(next)) continue
      visited.add(next)
      parent[next] = current
      reached.push(next)
      queue.push(next)
    }
  }

  const pathsToProductLines: Record<string, string[]> = {}
  for (const nodeId of reached) {
    if (graph.nodes.get(nodeId)?.type !== "product-line") continue
    const path: string[] = [nodeId]
    let cur = nodeId
    while (parent[cur] !== undefined) {
      cur = parent[cur]
      path.unshift(cur)
    }
    pathsToProductLines[nodeId] = path
  }

  return { reachedNodeIds: reached, pathsToProductLines }
}

/** Supplier/tier-2 nodes whose region or country matches a free-text query (case-insensitive, substring either direction). */
export function findNodesByRegionOrCountry(graph: SupplyChainGraph, query: string): string[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const matches: string[] = []
  graph.nodes.forEach((node, id) => {
    if (node.type !== "supplier" && node.type !== "tier2-supplier") return
    const region = (node.region ?? "").toLowerCase()
    const country = (node.country ?? "").toLowerCase()
    const regionHit = region.length > 0 && (region.includes(q) || q.includes(region))
    const countryHit = country.length > 0 && (country.includes(q) || q.includes(country))
    if (regionHit || countryHit) matches.push(id)
  })
  return matches
}

/** Human-readable "A → B → C" strings for each reached product-line path. */
export function describePaths(graph: SupplyChainGraph, result: TraversalResult): string[] {
  return Object.values(result.pathsToProductLines).map(path =>
    path.map(id => graph.nodes.get(id)?.label ?? id).join(" → ")
  )
}

/** Convenience for API routes: given disrupted start nodes, get affected product names + readable paths in one call. */
export function summarizeDownstreamImpact(
  graph: SupplyChainGraph,
  startNodeIds: string[]
): { affectedProductLineNames: string[]; pathDescriptions: string[] } {
  const productNames = new Set<string>()
  const paths = new Set<string>()
  for (const startId of startNodeIds) {
    const result = traverseDownstream(graph, startId)
    for (const path of describePaths(graph, result)) {
      paths.add(path)
      const labels = path.split(" → ")
      productNames.add(labels[labels.length - 1])
    }
  }
  return { affectedProductLineNames: Array.from(productNames), pathDescriptions: Array.from(paths) }
}

export interface SpofResult {
  productLineId: string
  productLineName: string
  isSinglePointOfFailure: boolean
  reasons: string[]
}

/**
 * A product line is flagged if it lacks an alternate path to a working
 * supplier: no backupSupplierId for the finished good, or any raw material
 * with a primary vendor but no secondary vendor. Operates directly on the
 * profile (no graph traversal needed) — mirrors inventoryRisk.ts's style of
 * reading CompanyProfile directly.
 */
export function findSinglePointsOfFailure(profile: CompanyProfile): SpofResult[] {
  return profile.productLines.map(product => {
    const reasons: string[] = []
    if (!product.backupSupplierId) {
      reasons.push("No backup supplier assigned for the finished good")
    }
    for (const material of product.rawMaterials ?? []) {
      if (material.primaryVendorId && !material.secondaryVendorId) {
        reasons.push(`Raw material "${material.name || "unnamed"}" has no secondary vendor`)
      }
    }
    return {
      productLineId: product.id,
      productLineName: product.name,
      isSinglePointOfFailure: reasons.length > 0,
      reasons,
    }
  })
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 2))
}

function tokensOverlap(a: string, b: string): boolean {
  const ta = tokenize(a)
  const tb = tokenize(b)
  return Array.from(ta).some(t => tb.has(t))
}

const ACTIVE_DISRUPTION_PROB = 0.4
const STRUCTURAL_SEVERITY_PROB: Record<StructuralRisk["severity"], number> = {
  Critical: 0.45,
  Elevated: 0.2,
  Watch: 0.05,
}
const AMBIENT_BASELINE_PROB = 0.03

function nodeDisruptionProbability(
  node: GraphNode,
  hasDisruptionByRegion: Record<string, boolean>,
  structuralRisks: StructuralRisk[]
): number {
  let probability = AMBIENT_BASELINE_PROB

  if (node.region && hasDisruptionByRegion[node.region]) {
    probability = Math.max(probability, ACTIVE_DISRUPTION_PROB)
  }

  if (node.category) {
    for (const risk of structuralRisks) {
      const matches = risk.affectedCategories?.some(keyword => tokensOverlap(node.category as string, keyword))
      if (matches) {
        probability = Math.max(probability, STRUCTURAL_SEVERITY_PROB[risk.severity])
      }
    }
  }

  return probability
}

export interface ProductDisruptionSimulation {
  productLineId: string
  productLineName: string
  networkDisruptionProbabilityPercent: number
  currentBufferDays: number // inventoryDaysOnHand - reorderPointDays, as stored (not decayed by days-since-update)
  bufferIsTight: boolean
}

/**
 * Monte Carlo "Supply Chain VaR": samples which supplier/tier-2 nodes are
 * disrupted per trial (probability from active region disruptions +
 * structural risk severity), traverses downstream, and reports what
 * fraction of trials touch each product line's supply network. This is
 * deliberately a network-disruption-frequency metric, not a precise
 * stockout-day forecast — the app has no real per-product consumption-rate
 * data (dailyConsumptionRate is a hardcoded 0 elsewhere), so a currentBufferDays
 * qualifier is reported alongside instead of a fabricated stockout date.
 */
export function simulateDisruptionRisk(params: {
  profile: CompanyProfile
  graph: SupplyChainGraph
  hasDisruptionByRegion: Record<string, boolean>
  structuralRisks?: StructuralRisk[]
  trials?: number
}): ProductDisruptionSimulation[] {
  const { profile, graph, hasDisruptionByRegion, structuralRisks = STRUCTURAL_RISKS, trials = 1000 } = params

  const probabilisticNodes = Array.from(graph.nodes.values()).filter(
    n => n.type === "supplier" || n.type === "tier2-supplier"
  )
  const nodeProbabilities = new Map<string, number>()
  for (const node of probabilisticNodes) {
    nodeProbabilities.set(node.id, nodeDisruptionProbability(node, hasDisruptionByRegion, structuralRisks))
  }

  const hitCounts = new Map<string, number>()

  for (let trial = 0; trial < trials; trial++) {
    const downNodeIds = probabilisticNodes
      .map(n => n.id)
      .filter(id => Math.random() < (nodeProbabilities.get(id) ?? 0))
    if (downNodeIds.length === 0) continue

    const hitProductsThisTrial = new Set<string>()
    for (const downId of downNodeIds) {
      const result = traverseDownstream(graph, downId)
      Object.keys(result.pathsToProductLines).forEach(pid => hitProductsThisTrial.add(pid))
    }
    hitProductsThisTrial.forEach(pid => {
      hitCounts.set(pid, (hitCounts.get(pid) ?? 0) + 1)
    })
  }

  return profile.productLines.map(product => {
    const hits = hitCounts.get(productNodeId(product.id)) ?? 0
    const bufferDays = product.inventoryDaysOnHand - product.reorderPointDays
    return {
      productLineId: product.id,
      productLineName: product.name,
      networkDisruptionProbabilityPercent: Math.round((hits / trials) * 100),
      currentBufferDays: bufferDays,
      bufferIsTight: bufferDays <= 0,
    }
  })
}
