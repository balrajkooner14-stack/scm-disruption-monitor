// Whole-term matching for onboarding (country names, port names) against
// event headlines. Deliberately stricter than the scorer's leading-boundary
// keyword rule: a place name must not be a prefix or suffix of a longer word
// ("Niger" must not match "Nigeria", "Oman" must not match "woman").
// Punctuation-ending terms like "u.s." still match before a space or comma.

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const cache = new Map<string, RegExp>()

function termRegExp(term: string, caseSensitive: boolean): RegExp {
  const key = `${caseSensitive ? "s" : "i"}:${term}`
  let re = cache.get(key)
  if (!re) {
    re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(term)}(?![A-Za-z0-9])`, caseSensitive ? "" : "i")
    cache.set(key, re)
  }
  return re
}

/**
 * True when `term` appears in `text` as a whole term. Short all-caps
 * abbreviations (US, UK, PRC, UAE) match case-sensitively so the pronoun
 * "us" in a headline never reads as the United States.
 */
export function containsTerm(text: string, term: string): boolean {
  const t = term.trim()
  if (!t) return false
  const isAbbreviation = t.length <= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)
  return termRegExp(t, isAbbreviation).test(text)
}
