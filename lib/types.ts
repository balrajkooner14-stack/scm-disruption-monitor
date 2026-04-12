export type DisruptionCategory =
  "Port" | "Tariff" | "Labor" | "Geopolitical" | "Weather" | "General"

export type SeverityLevel = 1 | 2 | 3

export type Region =
  "North America" | "Europe" | "Asia Pacific" |
  "Middle East" | "Latin America" | "Africa" | "Unknown"

export interface DisruptionEvent {
  id: string
  title: string
  url: string
  date: string
  sourceDomain: string
  sourceCountry: string
  category: DisruptionCategory
  severity: SeverityLevel
  region: Region
}
