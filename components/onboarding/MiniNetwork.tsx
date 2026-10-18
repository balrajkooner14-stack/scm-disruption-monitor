import { COLOR } from "@/lib/brand"

// "Your supply chain, drawn" (spec 6.6): suppliers on the left, product lines
// on the right, one cubic edge per product → its supplier. Suppliers with an
// active event get an ember outline; the product the insight picked is filled.

const MAX_SUPPLIERS = 6
const MAX_PRODUCTS = 5
const ROW = 70
const NODE_H = 44
const TOP = 10
const SUP_X = 10
const SUP_W = 190
const PROD_X = 360
const PROD_W = 200
const WIDTH = 584

export interface MiniNetworkSupplier {
  id: string
  name: string
  active: boolean
}

export interface MiniNetworkProduct {
  id: string
  name: string
  supplierId?: string
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

export default function MiniNetwork({
  suppliers,
  products,
  highlightProductId,
}: {
  suppliers: MiniNetworkSupplier[]
  products: MiniNetworkProduct[]
  highlightProductId?: string | null
}) {
  const sups = suppliers.slice(0, MAX_SUPPLIERS)
  const prods = products.slice(0, MAX_PRODUCTS)
  const rows = Math.max(sups.length, prods.length, 1)
  const height = TOP * 2 + (rows - 1) * ROW + NODE_H
  const supY = (i: number) => TOP + i * ROW
  const prodY = (i: number) => TOP + i * ROW
  const usedSuppliers = new Set(prods.map(p => p.supplierId).filter(Boolean))

  const edges = prods
    .map((p, pi) => {
      const si = sups.findIndex(s => s.id === p.supplierId)
      return si < 0 ? null : { p, pi, si }
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    // Draw the highlighted edge last so it sits on top.
    .sort((a, b) => Number(a.p.id === highlightProductId) - Number(b.p.id === highlightProductId))

  const linked = prods
    .map(p => {
      const s = sups.find(x => x.id === p.supplierId)
      return s ? `${p.name} from ${s.name}` : `${p.name} (no supplier)`
    })
    .join("; ")
  const label = prods.length
    ? `Network: ${linked}.${highlightProductId ? ` Highlighted: ${prods.find(p => p.id === highlightProductId)?.name ?? ""}.` : ""}`
    : `Network: ${sups.length} supplier${sups.length === 1 ? "" : "s"}, no product lines yet.`

  return (
    <svg viewBox={`0 0 ${WIDTH} ${height}`} width="100%" role="img" aria-label={label} className="max-w-[584px]">
      {edges.map(({ p, pi, si }) => {
        const y1 = supY(si) + NODE_H / 2
        const y2 = prodY(pi) + NODE_H / 2
        const x1 = SUP_X + SUP_W
        const on = p.id === highlightProductId
        return (
          <path
            key={`e-${p.id}`}
            d={`M${x1} ${y1} C${x1 + 60} ${y1} ${PROD_X - 60} ${y2} ${PROD_X} ${y2}`}
            stroke={on ? COLOR.ink : COLOR.lineStrong}
            strokeWidth={on ? 2.5 : 1.5}
            fill="none"
          />
        )
      })}

      {sups.map((s, i) => {
        const orphan = !usedSuppliers.has(s.id)
        return (
          <g key={`s-${s.id}`}>
            <title>{s.name}{s.active ? " · active event naming its country" : ""}</title>
            <rect
              x={SUP_X}
              y={supY(i)}
              width={SUP_W}
              height={NODE_H}
              rx={8}
              fill={COLOR.surface}
              stroke={s.active ? COLOR.ember : COLOR.line}
              strokeWidth={s.active ? 2 : 1.5}
              strokeDasharray={orphan ? "4 4" : undefined}
            />
            {orphan ? (
              // Two lines so the supplier's name isn't cut off by the note.
              <text fontFamily="var(--font-public-sans), sans-serif" fill={COLOR.ink3}>
                <tspan x={SUP_X + 16} y={supY(i) + 19} fontSize="13" fontWeight={s.active ? 600 : 400}>
                  {clip(s.name, 23)}
                </tspan>
                <tspan x={SUP_X + 16} y={supY(i) + 35} fontSize="12">(no product yet)</tspan>
              </text>
            ) : (
              <text
                x={SUP_X + 16}
                y={supY(i) + 27}
                fontFamily="var(--font-public-sans), sans-serif"
                fontSize="14"
                fontWeight={s.active ? 600 : 400}
                fill={COLOR.ink}
              >
                {clip(s.name, 22)}
              </text>
            )}
          </g>
        )
      })}

      {prods.map((p, i) => {
        const on = p.id === highlightProductId
        return (
          <g key={`p-${p.id}`}>
            <title>{p.name}</title>
            <rect
              x={PROD_X}
              y={prodY(i)}
              width={PROD_W}
              height={NODE_H}
              rx={8}
              fill={on ? COLOR.ink : COLOR.surface}
              stroke={on ? COLOR.ink : COLOR.line}
              strokeWidth={1.5}
            />
            <text
              x={PROD_X + 16}
              y={prodY(i) + 27}
              fontFamily="var(--font-public-sans), sans-serif"
              fontSize="14"
              fontWeight={on ? 600 : 400}
              fill={on ? COLOR.paper : COLOR.ink}
            >
              {clip(p.name, 23)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
