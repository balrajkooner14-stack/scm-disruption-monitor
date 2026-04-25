"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  CompanyProfile,
  IndustrySector,
  SupplyRegion,
  TransportMode,
  PainPoint,
  TradeLane,
  Supplier,
  ProductLine,
} from "@/lib/profile"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"

const INDUSTRY_SECTORS: IndustrySector[] = [
  "Automotive", "Electronics", "Pharmaceuticals", "Retail",
  "Food & Beverage", "Apparel", "Aerospace", "Industrial", "Other",
]

const SUPPLY_REGIONS: SupplyRegion[] = [
  "Asia Pacific", "Europe", "North America", "Latin America", "Middle East", "Africa",
]

const TRANSPORT_MODES: TransportMode[] = [
  "Ocean Freight", "Air Freight", "Truck", "Rail",
]

const PAIN_POINTS: PainPoint[] = [
  "Tariff exposure",
  "Port congestion",
  "Supplier concentration risk",
  "Raw material price volatility",
  "Labor disruptions",
  "Demand forecasting accuracy",
  "Lead time variability",
]

const TRADE_LANES: TradeLane[] = [
  "Asia-Pacific to US West Coast",
  "Asia-Pacific to US East Coast",
  "Asia-Pacific to Europe",
  "Europe to US",
  "Intra-Asia",
  "Latin America to US",
  "Middle East to Europe",
  "Other",
]

const STEP_NAMES = [
  "Company Basics",
  "Supplier Network",
  "Inventory Profile",
  "Pain Points & Concerns",
  "Transportation",
]

function newSupplier(): Supplier {
  return {
    id: crypto.randomUUID(),
    name: "",
    country: "",
    region: "Asia Pacific",
    category: "",
    sharePercent: 0,
    leadTimeDays: 0,
  }
}

function newProductLine(): ProductLine {
  return {
    id: crypto.randomUUID(),
    name: "",
    inventoryDaysOnHand: 0,
    reorderPointDays: 0,
  }
}

export default function ProfilePage() {
  const router = useRouter()
  const { profile, saveProfile, isLoaded } = useCompanyProfile()

  const [step, setStep] = useState(1)
  const [error, setError] = useState("")

  // Step 1
  const [companyName, setCompanyName] = useState("")
  const [sector, setSector] = useState<IndustrySector>("Automotive")
  const [revenueRange, setRevenueRange] = useState<CompanyProfile["revenueRange"]>("$0–$10M")
  const [primaryMarkets, setPrimaryMarkets] = useState<SupplyRegion[]>([])

  // Step 2
  const [suppliers, setSuppliers] = useState<Supplier[]>([newSupplier()])

  // Step 3
  const [productLines, setProductLines] = useState<ProductLine[]>([newProductLine()])

  // Step 4
  const [painPoints, setPainPoints] = useState<PainPoint[]>([])

  // Step 5
  const [transportModes, setTransportModes] = useState<TransportMode[]>([])
  const [tradeLanes, setTradeLanes] = useState<TradeLane[]>([])

  // Pre-fill from saved profile
  useEffect(() => {
    if (isLoaded && profile) {
      setCompanyName(profile.companyName)
      setSector(profile.sector)
      setRevenueRange(profile.revenueRange)
      setPrimaryMarkets(profile.primaryMarkets)
      setSuppliers(profile.suppliers.length > 0 ? profile.suppliers : [newSupplier()])
      setProductLines(profile.productLines.length > 0 ? profile.productLines : [newProductLine()])
      setPainPoints(profile.painPoints)
      setTransportModes(profile.transportModes)
      setTradeLanes(profile.tradeLanes)
    }
  }, [isLoaded, profile])

  function validateStep(): string {
    if (step === 1) {
      if (!companyName.trim()) return "Company name is required."
      if (primaryMarkets.length === 0) return "Select at least one primary market."
    }
    if (step === 2) {
      if (suppliers.length === 0) return "Add at least one supplier."
      for (const s of suppliers) {
        if (!s.name.trim()) return "All suppliers must have a name."
        if (!s.country.trim()) return "All suppliers must have a country."
        if (!s.category.trim()) return "All suppliers must have a supply category."
      }
    }
    if (step === 3) {
      if (productLines.length === 0) return "Add at least one product line."
      for (const p of productLines) {
        if (!p.name.trim()) return "All product lines must have a name."
      }
    }
    if (step === 4) {
      if (painPoints.length === 0) return "Select at least one pain point."
    }
    if (step === 5) {
      if (transportModes.length === 0) return "Select at least one transport mode."
    }
    return ""
  }

  function handleContinue() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    setStep((s) => s + 1)
  }

  function handleBack() {
    setError("")
    setStep((s) => s - 1)
  }

  function handleSave() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    const now = new Date().toISOString()
    const newProfile: CompanyProfile = {
      companyName: companyName.trim(),
      sector,
      revenueRange,
      primaryMarkets,
      suppliers,
      productLines,
      painPoints,
      transportModes,
      tradeLanes,
      createdAt: profile?.createdAt ?? now,
      updatedAt: now,
    }
    saveProfile(newProfile)
    router.push("/?profileSaved=true")
  }

  // Supplier helpers
  function updateSupplier(id: string, field: keyof Supplier, value: string | number) {
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }
  function addSupplier() {
    if (suppliers.length < 10) setSuppliers((prev) => [...prev, newSupplier()])
  }
  function removeSupplier(id: string) {
    setSuppliers((prev) => prev.filter((s) => s.id !== id))
  }

  // ProductLine helpers
  function updateProductLine(id: string, field: keyof ProductLine, value: string | number) {
    setProductLines((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    )
  }
  function addProductLine() {
    if (productLines.length < 5) setProductLines((prev) => [...prev, newProductLine()])
  }
  function removeProductLine(id: string) {
    setProductLines((prev) => prev.filter((p) => p.id !== id))
  }

  // Pain point toggle
  function togglePainPoint(pp: PainPoint) {
    setPainPoints((prev) =>
      prev.includes(pp) ? prev.filter((p) => p !== pp) : [...prev, pp]
    )
  }

  // Transport/Trade toggles
  function toggleTransport(mode: TransportMode) {
    setTransportModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    )
  }
  function toggleTradeLane(lane: TradeLane) {
    setTradeLanes((prev) =>
      prev.includes(lane) ? prev.filter((l) => l !== lane) : [...prev, lane]
    )
  }

  const progressPercent = (step / 5) * 100

  const inputCls =
    "w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500 transition-colors"
  const labelCls = "block text-sm text-slate-300 mb-1"
  const checkboxLabelCls =
    "flex items-center gap-2 text-slate-300 text-sm cursor-pointer select-none"

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16">
      {/* Progress bar */}
      <div className="w-full h-1 bg-slate-700">
        <div
          className="h-1 bg-blue-600 rounded transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Set Up Your Supply Chain Profile</h1>
          <p className="text-slate-400 text-sm mt-1">
            Takes about 5 minutes. Your data stays in your browser only.
          </p>
          <p className="text-slate-400 text-sm mt-2">
            Step {step} of 5 — {STEP_NAMES[step - 1]}
          </p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          {/* Step 1 — Company Basics */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Company Name *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Industry Sector *</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value as IndustrySector)}
                  className={inputCls}
                >
                  {INDUSTRY_SECTORS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Revenue Range *</label>
                <div className="space-y-2 mt-1">
                  {(["$0–$10M", "$10M–$100M", "$100M–$1B", "$1B+"] as const).map((r) => (
                    <label key={r} className={checkboxLabelCls}>
                      <input
                        type="radio"
                        name="revenueRange"
                        value={r}
                        checked={revenueRange === r}
                        onChange={() => setRevenueRange(r)}
                        className="accent-blue-500"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Primary Markets * (select all that apply)</label>
                <div className="space-y-2 mt-1">
                  {SUPPLY_REGIONS.map((region) => (
                    <label key={region} className={checkboxLabelCls}>
                      <input
                        type="checkbox"
                        checked={primaryMarkets.includes(region)}
                        onChange={() =>
                          setPrimaryMarkets((prev) =>
                            prev.includes(region)
                              ? prev.filter((r) => r !== region)
                              : [...prev, region]
                          )
                        }
                        className="accent-blue-500"
                      />
                      {region}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2 — Supplier Network */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{suppliers.length} of 10 suppliers added</span>
                <button
                  onClick={addSupplier}
                  disabled={suppliers.length >= 10}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add Supplier
                </button>
              </div>

              {suppliers.map((supplier, idx) => (
                <div key={supplier.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">Supplier {idx + 1}</span>
                    {suppliers.length > 1 && (
                      <button
                        onClick={() => removeSupplier(supplier.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
                        aria-label="Remove supplier"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Supplier Name *</label>
                      <input
                        type="text"
                        value={supplier.name}
                        onChange={(e) => updateSupplier(supplier.id, "name", e.target.value)}
                        placeholder="e.g. Samsung SDI"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Country of Origin *</label>
                      <input
                        type="text"
                        value={supplier.country}
                        onChange={(e) => updateSupplier(supplier.id, "country", e.target.value)}
                        placeholder="e.g. South Korea"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Region *</label>
                      <select
                        value={supplier.region}
                        onChange={(e) => updateSupplier(supplier.id, "region", e.target.value)}
                        className={inputCls}
                      >
                        {SUPPLY_REGIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>What they supply *</label>
                      <input
                        type="text"
                        value={supplier.category}
                        onChange={(e) => updateSupplier(supplier.id, "category", e.target.value)}
                        placeholder="e.g. Semiconductors"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Supply share %</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={supplier.sharePercent}
                        onChange={(e) => updateSupplier(supplier.id, "sharePercent", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Lead time (days)</label>
                      <input
                        type="number"
                        min={0}
                        value={supplier.leadTimeDays}
                        onChange={(e) => updateSupplier(supplier.id, "leadTimeDays", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Inventory Profile */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400 text-sm">{productLines.length} of 5 product lines added</span>
                <button
                  onClick={addProductLine}
                  disabled={productLines.length >= 5}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add Product Line
                </button>
              </div>

              {productLines.map((pl, idx) => (
                <div key={pl.id} className="bg-slate-700/50 border border-slate-600 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-300 text-sm font-medium">Product Line {idx + 1}</span>
                    {productLines.length > 1 && (
                      <button
                        onClick={() => removeProductLine(pl.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors text-lg leading-none"
                        aria-label="Remove product line"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className={labelCls}>Product Line Name *</label>
                      <input
                        type="text"
                        value={pl.name}
                        onChange={(e) => updateProductLine(pl.id, "name", e.target.value)}
                        placeholder="e.g. EV Battery Modules"
                        className={inputCls}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Inventory days on hand</label>
                        <input
                          type="number"
                          min={0}
                          value={pl.inventoryDaysOnHand}
                          onChange={(e) => updateProductLine(pl.id, "inventoryDaysOnHand", Number(e.target.value))}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Reorder point (days)</label>
                        <input
                          type="number"
                          min={0}
                          value={pl.reorderPointDays}
                          onChange={(e) => updateProductLine(pl.id, "reorderPointDays", Number(e.target.value))}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4 — Pain Points */}
          {step === 4 && (
            <div className="space-y-3">
              <p className="text-slate-400 text-sm mb-4">
                Select your top 3 supply chain challenges
              </p>
              {PAIN_POINTS.map((pp) => {
                const checked = painPoints.includes(pp)
                const disabled = !checked && painPoints.length >= 3
                return (
                  <label
                    key={pp}
                    className={`flex items-center gap-3 text-sm rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : disabled
                        ? "border-slate-700 text-slate-600 cursor-not-allowed"
                        : "border-slate-600 text-slate-300 hover:border-slate-400"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePainPoint(pp)}
                      className="accent-blue-500"
                    />
                    {pp}
                  </label>
                )
              })}
              <p className="text-slate-500 text-xs mt-2">{painPoints.length}/3 selected</p>
            </div>
          )}

          {/* Step 5 — Transportation */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <label className="block text-slate-300 font-medium mb-3">
                  How do you primarily move goods? *
                </label>
                <div className="space-y-2">
                  {TRANSPORT_MODES.map((mode) => (
                    <label key={mode} className={checkboxLabelCls}>
                      <input
                        type="checkbox"
                        checked={transportModes.includes(mode)}
                        onChange={() => toggleTransport(mode)}
                        className="accent-blue-500"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-3">
                  Which shipping lanes are most critical to you?
                </label>
                <div className="space-y-2">
                  {TRADE_LANES.map((lane) => (
                    <label key={lane} className={checkboxLabelCls}>
                      <input
                        type="checkbox"
                        checked={tradeLanes.includes(lane)}
                        onChange={() => toggleTradeLane(lane)}
                        className="accent-blue-500"
                      />
                      {lane}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button
                onClick={handleBack}
                className="text-slate-400 hover:text-white border border-slate-600 hover:border-slate-400 px-4 py-2 rounded-lg text-sm transition-colors"
              >
                ← Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button
                onClick={handleContinue}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Save Profile ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
