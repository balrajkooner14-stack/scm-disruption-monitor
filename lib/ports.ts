import type { DisruptionEvent } from "./types"
import { containsTerm } from "./textMatch"
import { bySeverityThenDate } from "./eventOrder"

// US entry ports offered in onboarding and /profile (spec 6.5). Keywords are
// matched against event titles as whole terms, case-insensitive.

export interface Port {
  id: string
  name: string
  coast: string
  keywords: string[]
}

export const PORTS: Port[] = [
  { id: "la-lb", name: "Los Angeles / Long Beach", coast: "West Coast", keywords: ["los angeles", "long beach", "san pedro"] },
  { id: "oakland", name: "Oakland", coast: "West Coast", keywords: ["oakland"] },
  { id: "seattle-tacoma", name: "Seattle / Tacoma", coast: "West Coast", keywords: ["seattle", "tacoma", "northwest seaport"] },
  { id: "ny-nj", name: "New York / New Jersey", coast: "East Coast", keywords: ["new york", "new jersey", "newark", "port elizabeth"] },
  { id: "savannah", name: "Savannah", coast: "East Coast", keywords: ["savannah"] },
  { id: "charleston", name: "Charleston", coast: "East Coast", keywords: ["charleston"] },
  { id: "houston", name: "Houston", coast: "Gulf", keywords: ["houston"] },
  { id: "laredo", name: "Laredo", coast: "Mexico border", keywords: ["laredo", "mexico border", "u.s.-mexico border", "us-mexico border"] },
]

export const CUSTOM_PORT_PREFIX = "custom:"

export function customPortId(name: string): string {
  return `${CUSTOM_PORT_PREFIX}${name.trim()}`
}

export function isCustomPortId(id: string): boolean {
  return id.startsWith(CUSTOM_PORT_PREFIX)
}

/** Display name for a PORTS id or a "custom:<name>" id. */
export function portName(id: string): string {
  if (isCustomPortId(id)) return id.slice(CUSTOM_PORT_PREFIX.length)
  return PORTS.find(p => p.id === id)?.name ?? id
}

function portKeywords(id: string): string[] {
  if (isCustomPortId(id)) {
    const name = id.slice(CUSTOM_PORT_PREFIX.length).trim().toLowerCase()
    return name ? [name] : []
  }
  return PORTS.find(p => p.id === id)?.keywords ?? []
}

/**
 * Events whose title names each selected port, most severe then newest first.
 * Every requested id gets a key, with an empty array when nothing matches.
 */
export function matchEventsToPorts<E extends DisruptionEvent>(
  events: E[],
  portIds: string[],
): Record<string, E[]> {
  const out: Record<string, E[]> = {}
  for (const id of portIds) {
    const keywords = portKeywords(id)
    const matches = events.filter(e => keywords.some(kw => containsTerm(e.title, kw)))
    out[id] = bySeverityThenDate(matches)
  }
  return out
}
