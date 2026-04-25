export type IndustrySector =
  | "Automotive"
  | "Electronics"
  | "Pharmaceuticals"
  | "Retail"
  | "Food & Beverage"
  | "Apparel"
  | "Aerospace"
  | "Industrial"
  | "Other"

export type SupplyRegion =
  | "Asia Pacific"
  | "Europe"
  | "North America"
  | "Latin America"
  | "Middle East"
  | "Africa"

export type TransportMode =
  | "Ocean Freight"
  | "Air Freight"
  | "Truck"
  | "Rail"

export type PainPoint =
  | "Tariff exposure"
  | "Port congestion"
  | "Supplier concentration risk"
  | "Raw material price volatility"
  | "Labor disruptions"
  | "Demand forecasting accuracy"
  | "Lead time variability"

export type TradeLane =
  | "Asia-Pacific to US West Coast"
  | "Asia-Pacific to US East Coast"
  | "Asia-Pacific to Europe"
  | "Europe to US"
  | "Intra-Asia"
  | "Latin America to US"
  | "Middle East to Europe"
  | "Other"

export interface Supplier {
  id: string           // uuid - generate with crypto.randomUUID()
  name: string
  country: string
  region: SupplyRegion
  category: string     // what they supply e.g. "Semiconductors", "Raw steel"
  sharePercent: number // 0-100, what % of supply this supplier represents
  leadTimeDays: number // days from order to receipt
}

export interface ProductLine {
  id: string
  name: string
  inventoryDaysOnHand: number
  reorderPointDays: number  // trigger reorder when inventory hits this
}

export interface CompanyProfile {
  companyName: string
  sector: IndustrySector
  revenueRange: "$0–$10M" | "$10M–$100M" | "$100M–$1B" | "$1B+"
  primaryMarkets: SupplyRegion[]
  suppliers: Supplier[]        // max 10
  productLines: ProductLine[]  // max 5
  painPoints: PainPoint[]      // max 3
  transportModes: TransportMode[]
  tradeLanes: TradeLane[]
  createdAt: string            // ISO date string
  updatedAt: string            // ISO date string
}

export const PROFILE_STORAGE_KEY = "scm_company_profile"
