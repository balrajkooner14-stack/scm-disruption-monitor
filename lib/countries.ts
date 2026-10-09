import type { SupplyRegion } from "./profile"
import { containsTerm } from "./textMatch"

// Country list for the onboarding autocomplete and for spotting a supplier's
// country in a headline. Covers every country in lib/fetchGlobalDisasters.ts's
// region map and components/WorldMap's table, plus Taiwan, Hong Kong and
// Vietnam. Regions follow the event feeds (GDELT, GDACS): Mexico is North
// America there, so it is here too, otherwise a Mexican supplier would never
// region-match a Mexican event. lib/onboarding.ts's deriveTradeLanes treats
// Mexico as qualifying for the Latin America → US lane on its own.

export interface Country {
  name: string
  region: SupplyRegion
  /** Alternate names: accepted when typed AND matched in headlines. */
  aliases?: string[]
  /**
   * Accepted when typed, never matched in headlines, because as a whole term
   * they name something else in the news ("Korea" also hits "North Korea").
   */
  lookupAliases?: string[]
  /** world-atlas topojson name, when it differs from `name` (for map shading). */
  geoName?: string
}

export const COUNTRIES: Country[] = [
  // North America
  { name: "United States", region: "North America", aliases: ["USA", "US", "U.S.", "U.S.A.", "United States of America"], geoName: "United States of America" },
  { name: "Canada", region: "North America" },
  { name: "Mexico", region: "North America" },
  { name: "Cuba", region: "North America" },
  { name: "Guatemala", region: "Latin America" },
  { name: "Honduras", region: "Latin America" },
  { name: "El Salvador", region: "Latin America" },
  { name: "Nicaragua", region: "Latin America" },
  { name: "Costa Rica", region: "Latin America" },
  { name: "Panama", region: "Latin America" },
  { name: "Jamaica", region: "Latin America" },
  { name: "Haiti", region: "Latin America" },
  { name: "Dominican Republic", region: "Latin America", geoName: "Dominican Rep." },
  // Latin America
  { name: "Brazil", region: "Latin America" },
  { name: "Argentina", region: "Latin America" },
  { name: "Chile", region: "Latin America" },
  { name: "Colombia", region: "Latin America" },
  { name: "Peru", region: "Latin America" },
  { name: "Venezuela", region: "Latin America" },
  { name: "Ecuador", region: "Latin America" },
  { name: "Bolivia", region: "Latin America" },
  { name: "Paraguay", region: "Latin America" },
  { name: "Uruguay", region: "Latin America" },
  { name: "Guyana", region: "Latin America" },
  { name: "Suriname", region: "Latin America" },
  // Europe
  { name: "United Kingdom", region: "Europe", aliases: ["UK", "U.K.", "Great Britain", "Britain", "England"] },
  { name: "Germany", region: "Europe" },
  { name: "France", region: "Europe" },
  { name: "Italy", region: "Europe" },
  { name: "Spain", region: "Europe" },
  { name: "Netherlands", region: "Europe", aliases: ["Holland", "The Netherlands"] },
  { name: "Belgium", region: "Europe" },
  { name: "Switzerland", region: "Europe" },
  { name: "Austria", region: "Europe" },
  { name: "Sweden", region: "Europe" },
  { name: "Norway", region: "Europe" },
  { name: "Denmark", region: "Europe" },
  { name: "Finland", region: "Europe" },
  { name: "Iceland", region: "Europe" },
  { name: "Ireland", region: "Europe" },
  { name: "Portugal", region: "Europe" },
  { name: "Poland", region: "Europe" },
  { name: "Czech Republic", region: "Europe", aliases: ["Czechia"], geoName: "Czechia" },
  { name: "Slovakia", region: "Europe" },
  { name: "Slovenia", region: "Europe" },
  { name: "Hungary", region: "Europe" },
  { name: "Romania", region: "Europe" },
  { name: "Bulgaria", region: "Europe" },
  { name: "Greece", region: "Europe" },
  { name: "Croatia", region: "Europe" },
  { name: "Serbia", region: "Europe" },
  { name: "Bosnia and Herzegovina", region: "Europe", aliases: ["Bosnia"], geoName: "Bosnia and Herz." },
  { name: "Estonia", region: "Europe" },
  { name: "Latvia", region: "Europe" },
  { name: "Lithuania", region: "Europe" },
  { name: "Ukraine", region: "Europe" },
  { name: "Belarus", region: "Europe" },
  { name: "Russia", region: "Europe", aliases: ["Russian Federation"] },
  { name: "Georgia", region: "Europe" },
  // Asia Pacific
  { name: "China", region: "Asia Pacific", aliases: ["PRC", "Mainland China", "People's Republic of China"] },
  { name: "Taiwan", region: "Asia Pacific" },
  { name: "Hong Kong", region: "Asia Pacific" },
  { name: "Japan", region: "Asia Pacific" },
  { name: "South Korea", region: "Asia Pacific", aliases: ["Republic of Korea"], lookupAliases: ["Korea"] },
  { name: "India", region: "Asia Pacific" },
  { name: "Vietnam", region: "Asia Pacific", aliases: ["Viet Nam"] },
  { name: "Thailand", region: "Asia Pacific" },
  { name: "Indonesia", region: "Asia Pacific" },
  { name: "Malaysia", region: "Asia Pacific" },
  { name: "Singapore", region: "Asia Pacific" },
  { name: "Philippines", region: "Asia Pacific" },
  { name: "Bangladesh", region: "Asia Pacific" },
  { name: "Pakistan", region: "Asia Pacific" },
  { name: "Sri Lanka", region: "Asia Pacific" },
  { name: "Nepal", region: "Asia Pacific" },
  { name: "Myanmar", region: "Asia Pacific", aliases: ["Burma"] },
  { name: "Cambodia", region: "Asia Pacific" },
  { name: "Laos", region: "Asia Pacific" },
  { name: "Mongolia", region: "Asia Pacific" },
  { name: "Kazakhstan", region: "Asia Pacific" },
  { name: "Afghanistan", region: "Asia Pacific" },
  { name: "Australia", region: "Asia Pacific" },
  { name: "New Zealand", region: "Asia Pacific" },
  { name: "Papua New Guinea", region: "Asia Pacific" },
  { name: "Fiji", region: "Asia Pacific" },
  { name: "New Caledonia", region: "Asia Pacific" },
  { name: "Guam", region: "Asia Pacific" },
  { name: "Northern Mariana Islands", region: "Asia Pacific" },
  // Middle East
  { name: "United Arab Emirates", region: "Middle East", aliases: ["UAE", "U.A.E."] },
  { name: "Saudi Arabia", region: "Middle East" },
  { name: "Israel", region: "Middle East" },
  { name: "Turkey", region: "Middle East", aliases: ["Türkiye", "Turkiye"] },
  { name: "Iran", region: "Middle East" },
  { name: "Iraq", region: "Middle East" },
  { name: "Qatar", region: "Middle East" },
  { name: "Kuwait", region: "Middle East" },
  { name: "Bahrain", region: "Middle East" },
  { name: "Oman", region: "Middle East" },
  { name: "Yemen", region: "Middle East" },
  { name: "Jordan", region: "Middle East" },
  { name: "Lebanon", region: "Middle East" },
  { name: "Syria", region: "Middle East" },
  { name: "Cyprus", region: "Middle East" },
  // Africa
  { name: "Egypt", region: "Africa" },
  { name: "Morocco", region: "Africa" },
  { name: "Algeria", region: "Africa" },
  { name: "Tunisia", region: "Africa" },
  { name: "Libya", region: "Africa" },
  { name: "Nigeria", region: "Africa" },
  { name: "Ghana", region: "Africa" },
  { name: "Senegal", region: "Africa" },
  { name: "Mali", region: "Africa" },
  { name: "Cameroon", region: "Africa" },
  { name: "Ethiopia", region: "Africa" },
  { name: "Kenya", region: "Africa" },
  { name: "Tanzania", region: "Africa" },
  { name: "Uganda", region: "Africa" },
  { name: "Somalia", region: "Africa" },
  { name: "Sudan", region: "Africa" },
  { name: "Angola", region: "Africa" },
  { name: "Mozambique", region: "Africa" },
  { name: "Madagascar", region: "Africa" },
  { name: "Zambia", region: "Africa" },
  { name: "Zimbabwe", region: "Africa" },
  { name: "South Africa", region: "Africa" },
]

const norm = (s: string) => s.trim().toLowerCase()

const BY_NAME = new Map<string, Country>()
for (const c of COUNTRIES) {
  BY_NAME.set(norm(c.name), c)
  for (const a of [...(c.aliases ?? []), ...(c.lookupAliases ?? [])]) BY_NAME.set(norm(a), c)
}

/** The known country for a name or alias (case-insensitive), else null. */
export function findCountry(name: string): Country | null {
  return BY_NAME.get(norm(name)) ?? null
}

/** Region for a known country or alias. Never guesses: unknown names return null. */
export function countryToSupplyRegion(name: string): SupplyRegion | null {
  return findCountry(name)?.region ?? null
}

/** The world-atlas topojson name for a typed country, for map shading. */
export function countryGeoName(name: string): string | null {
  const c = findCountry(name)
  return c ? c.geoName ?? c.name : null
}

/**
 * Up to `limit` countries for the combobox: prefix matches (on the name or
 * any alias) first, then substring matches, each in list order.
 */
export function searchCountries(query: string, limit = 6): Country[] {
  const q = norm(query)
  if (!q) return []
  const prefix: Country[] = []
  const substring: Country[] = []
  for (const c of COUNTRIES) {
    const names = [c.name, ...(c.aliases ?? []), ...(c.lookupAliases ?? [])].map(norm)
    if (names.some(n => n.startsWith(q))) prefix.push(c)
    else if (names.some(n => n.includes(q))) substring.push(c)
  }
  return [...prefix, ...substring].slice(0, limit)
}

/** Every name a headline might use for this country: the name and its aliases (not lookupAliases). */
export function countryTerms(name: string): string[] {
  const c = findCountry(name)
  if (!c) return name.trim() ? [name.trim()] : []
  return [c.name, ...(c.aliases ?? [])]
}

/** True when the text names this country (or an alias) as a whole term. */
export function textMentionsCountry(text: string, country: string): boolean {
  return countryTerms(country).some(term => containsTerm(text, term))
}
