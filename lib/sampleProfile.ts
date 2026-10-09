import type { CompanyProfile } from "./profile"
import { deriveTradeLanes, localISODate, type OnboardingExtras } from "./onboarding"

// "Meridian Electronics Co.", the sample company for demo mode (spec 4.7).
// Built at call time: createdAt/updatedAt and every inventoryAsOf are today,
// so the sample never shows decayed "0 days" stock.

const S = {
  tsmc: "sample-tsmc",
  foxconn: "sample-foxconn",
  samsung: "sample-samsung-sdi",
  bosch: "sample-bosch",
  flex: "sample-flex",
}
const P = {
  hub: "sample-smart-home-hub",
  ev: "sample-ev-charging-module",
  iot: "sample-industrial-iot-sensor",
  power: "sample-portable-power-bank",
}

const SAMPLE_PORTS = ["la-lb", "laredo"]

export function buildSampleProfile(now: Date = new Date()): CompanyProfile {
  const iso = now.toISOString()
  const profile: CompanyProfile = {
    companyName: "Meridian Electronics Co.",
    headquartersCountry: "United States",
    sector: "Electronics",
    revenueRange: "$100M–$1B",
    primaryMarkets: ["North America"],
    suppliers: [
      { id: S.tsmc, name: "TSMC Semiconductor", country: "Taiwan", region: "Asia Pacific", category: "Semiconductors", sharePercent: 35, leadTimeDays: 45 },
      { id: S.foxconn, name: "Foxconn Assembly", country: "China", region: "Asia Pacific", category: "Contract assembly", sharePercent: 25, leadTimeDays: 21 },
      { id: S.samsung, name: "Samsung SDI", country: "South Korea", region: "Asia Pacific", category: "Batteries", sharePercent: 20, leadTimeDays: 30 },
      { id: S.bosch, name: "Bosch Components", country: "Germany", region: "Europe", category: "Sensors", sharePercent: 12, leadTimeDays: 25 },
      { id: S.flex, name: "Flex Ltd", country: "Mexico", region: "North America", category: "PCB assembly", sharePercent: 8, leadTimeDays: 20 },
    ],
    productLines: [
      { id: P.hub, name: "Smart Home Hub", inventoryDaysOnHand: 25, reorderPointDays: 20, primarySupplierId: S.foxconn },
      { id: P.ev, name: "EV Charging Module", inventoryDaysOnHand: 18, reorderPointDays: 25, primarySupplierId: S.tsmc },
      { id: P.iot, name: "Industrial IoT Sensor", inventoryDaysOnHand: 40, reorderPointDays: 20, primarySupplierId: S.bosch },
      { id: P.power, name: "Portable Power Bank", inventoryDaysOnHand: 30, reorderPointDays: 15, primarySupplierId: S.samsung },
    ],
    painPoints: [],
    transportModes: ["Ocean Freight", "Truck"],
    tradeLanes: [],
    createdAt: iso,
    updatedAt: iso,
  }
  return { ...profile, tradeLanes: deriveTradeLanes(SAMPLE_PORTS, profile.suppliers) }
}

export function buildSampleExtras(now: Date = new Date()): OnboardingExtras {
  const today = localISODate(now)
  return {
    version: 1,
    role: "operations",
    entryPorts: [...SAMPLE_PORTS],
    inventoryAsOf: { [P.hub]: today, [P.ev]: today, [P.iot]: today, [P.power]: today },
    inventoryUnknown: [],
    reorderPointDefaulted: [],
    leadTimeUnknown: [],
    primaryMarketsDerived: true,
    path: "sample",
    startedAt: now.toISOString(),
    completedAt: now.toISOString(),
  }
}

/** Fresh as of module load (the page load that entered demo mode). */
export const SAMPLE_PROFILE: CompanyProfile = buildSampleProfile()
export const SAMPLE_EXTRAS: OnboardingExtras = buildSampleExtras()
