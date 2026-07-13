// Deterministic name-matching against the US Treasury OFAC SDN list.
// Matches by NAME ONLY — the primary SDN.CSV has no country/address column
// (that lives in a separate file requiring a join by entity ID, out of
// scope for this pass). This is a screening aid, not a legal determination
// — every match must be presented as "possible, verify manually," never
// as a definitive claim.

const STOPWORDS = new Set([
  "the", "inc", "llc", "ltd", "co", "corp", "corporation", "company",
  "group", "limited", "of", "and", "holdings", "international", "intl",
])

function tokenize(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))
  )
}

export interface SanctionsMatch {
  supplierId: string
  supplierName: string
  matchedName: string
  matchStrength: "high" | "medium"
}

/**
 * Compares a supplier name's meaningful tokens against an SDN entry name's
 * tokens. "high" = every meaningful supplier token appears in the SDN name
 * (or vice versa) — the supplier name is essentially contained in the SDN
 * entry or covers it entirely. "medium" = at least 2 meaningful tokens
 * overlap, but neither name fully contains the other's tokens.
 */
function compareNames(supplierTokens: Set<string>, sdnTokens: Set<string>): "high" | "medium" | null {
  if (supplierTokens.size === 0 || sdnTokens.size === 0) return null

  const overlap = Array.from(supplierTokens).filter(t => sdnTokens.has(t))
  if (overlap.length === 0) return null

  const supplierCovered = overlap.length === supplierTokens.size
  const sdnCovered = overlap.length === sdnTokens.size

  if (supplierCovered || sdnCovered) return "high"
  if (overlap.length >= 2) return "medium"
  return null
}

export function screenSupplierNames(
  suppliers: { id: string; name: string }[],
  sdnEntityNames: string[]
): SanctionsMatch[] {
  const matches: SanctionsMatch[] = []
  const sdnTokenized = sdnEntityNames.map(name => ({ name, tokens: tokenize(name) }))

  for (const supplier of suppliers) {
    const supplierTokens = tokenize(supplier.name)
    if (supplierTokens.size === 0) continue

    let best: { name: string; strength: "high" | "medium" } | null = null
    for (const { name, tokens } of sdnTokenized) {
      const strength = compareNames(supplierTokens, tokens)
      if (!strength) continue
      if (!best || (strength === "high" && best.strength === "medium")) {
        best = { name, strength }
      }
      if (best.strength === "high") break
    }

    if (best) {
      matches.push({
        supplierId: supplier.id,
        supplierName: supplier.name,
        matchedName: best.name,
        matchStrength: best.strength,
      })
    }
  }

  return matches
}
