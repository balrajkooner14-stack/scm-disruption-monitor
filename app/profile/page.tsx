"use client"
export const dynamic = "force-dynamic"

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
  Tier2Supplier,
  RawMaterial,
} from "@/lib/profile"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import ImportProfileFlow from "@/components/ImportProfileFlow"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import { BRAND } from "@/lib/brand"
import { ui } from "@/lib/ui"

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className={open ? "rotate-180" : ""}>
      <path d="M6 9 L12 15 L18 9" />
    </svg>
  )
}

function Required() {
  return <span className="text-ember" aria-hidden="true"> *</span>
}

const noteBox = "rounded-lg bg-ochre-tint text-ochre px-4 py-3 text-sm"
const groupCard = `${ui.cardInner} space-y-3`
// Compact field for the nested tier-2 / raw-material rows.
const smallInput =
  "w-full rounded-lg border border-line-control bg-surface px-2 py-1.5 text-sm text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none"
const smallLabel = "block text-xs text-ink-3 mb-1"
const disclosureBtn = "inline-flex items-center gap-1.5 text-sm text-ember transition-colors hover:text-ember-deep"

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
  "Company basics",
  "Supplier network",
  "Inventory profile",
  "Pain points",
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
  const [expandedTier2SupplierId, setExpandedTier2SupplierId] = useState<string | null>(null)
  const [expandedRawMaterialsId, setExpandedRawMaterialsId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)

  // Step 1
  const [companyName, setCompanyName] = useState("")
  const [headquartersCountry, setHeadquartersCountry] = useState("")
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
      setHeadquartersCountry(profile.headquartersCountry ?? "")
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
      if (!headquartersCountry.trim()) return "Headquarters country is required."
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

  async function handleSave() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    const now = new Date().toISOString()
    const newProfile: CompanyProfile = {
      companyName: companyName.trim(),
      headquartersCountry: headquartersCountry.trim(),
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
    await saveProfile(newProfile)
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

  // Tier-2 (sub-supplier) helpers — manual entry, visibility only, no
  // lead time/share% since risk math doesn't need to go two levels deep.
  function addTier2Supplier(supplierId: string) {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? {
              ...s,
              tier2Suppliers: [
                ...(s.tier2Suppliers ?? []),
                { id: crypto.randomUUID(), name: "", country: "", region: "Asia Pacific" as SupplyRegion },
              ],
            }
          : s
      )
    )
  }
  function updateTier2Supplier(supplierId: string, tier2Id: string, field: keyof Tier2Supplier, value: string) {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? {
              ...s,
              tier2Suppliers: (s.tier2Suppliers ?? []).map((t2) =>
                t2.id === tier2Id ? { ...t2, [field]: value } : t2
              ),
            }
          : s
      )
    )
  }
  function removeTier2Supplier(supplierId: string, tier2Id: string) {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === supplierId
          ? { ...s, tier2Suppliers: (s.tier2Suppliers ?? []).filter((t2) => t2.id !== tier2Id) }
          : s
      )
    )
  }

  // ProductLine helpers
  function updateProductLine(id: string, field: keyof ProductLine, value: string | number | undefined) {
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

  // Raw material breakout — manual entry, visibility only (v4.1), same
  // pattern as tier2Suppliers: no inventory-risk math reads these yet.
  function addRawMaterial(productLineId: string) {
    setProductLines((prev) =>
      prev.map((p) =>
        p.id === productLineId
          ? {
              ...p,
              rawMaterials: [
                ...(p.rawMaterials ?? []),
                { id: crypto.randomUUID(), name: "" },
              ],
            }
          : p
      )
    )
  }
  function updateRawMaterial(
    productLineId: string,
    materialId: string,
    field: keyof RawMaterial,
    value: string | number | undefined
  ) {
    setProductLines((prev) =>
      prev.map((p) =>
        p.id === productLineId
          ? {
              ...p,
              rawMaterials: (p.rawMaterials ?? []).map((m) =>
                m.id === materialId ? { ...m, [field]: value } : m
              ),
            }
          : p
      )
    )
  }
  function removeRawMaterial(productLineId: string, materialId: string) {
    setProductLines((prev) =>
      prev.map((p) =>
        p.id === productLineId
          ? { ...p, rawMaterials: (p.rawMaterials ?? []).filter((m) => m.id !== materialId) }
          : p
      )
    )
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

  const inputCls = ui.input
  const labelCls = `block ${ui.label} mb-1.5`
  const checkboxLabelCls =
    "flex items-center gap-2 text-[15px] text-ink cursor-pointer select-none"

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <Link href="/" aria-label="Home">
            <Logo />
          </Link>
          <Link href="/" className={ui.btnGhost}>
            Back to dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="mb-8 space-y-2">
          <p className={ui.eyebrow}>Company profile</p>
          <h1 className={ui.h1}>Tell {BRAND.name} about your supply chain</h1>
          <p className={ui.body}>
            Takes about 5 minutes. Your data stays in your browser only.
          </p>
        </div>

        {/* Stepper */}
        <ol className="flex items-start mb-8" aria-label="Progress">
          {STEP_NAMES.map((name, i) => {
            const n = i + 1
            const isCurrent = n === step
            const isDone = n < step
            return (
              <li key={name} className="flex-1 flex flex-col items-center gap-2 relative" aria-current={isCurrent ? "step" : undefined}>
                {i > 0 && (
                  <span className="absolute top-3.5 right-1/2 w-full h-px bg-line z-0" aria-hidden="true" />
                )}
                <span
                  className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                    isCurrent
                      ? "bg-ink text-paper"
                      : isDone
                      ? "bg-moss-tint text-moss-deep"
                      : "border border-line bg-paper text-ink-3"
                  }`}
                >
                  {isDone ? "✓" : n}
                </span>
                <span className={`text-xs text-center ${isCurrent ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {name}
                </span>
              </li>
            )
          })}
        </ol>

        {/* Import from file */}
        {!showImport ? (
          <div className="bg-paper-raised border border-line rounded-xl p-6 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h2 className={ui.h3}>Import from Excel or CSV</h2>
              <p className={ui.meta}>
                Already have your supplier list or inventory data in a spreadsheet? Upload it and AI will automatically map your columns to the profile fields.
              </p>
            </div>
            <button onClick={() => setShowImport(true)} className={`${ui.btnSecondary} flex-shrink-0`}>
              Import file
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <ImportProfileFlow
              onComplete={() => {
                setShowImport(false)
                router.push("/?profileSaved=true")
              }}
              onCancel={() => setShowImport(false)}
            />
          </div>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-line" />
          <span className={ui.meta}>or enter manually</span>
          <div className="flex-1 h-px bg-line" />
        </div>

        <div className="bg-paper-raised border border-line rounded-xl p-7 space-y-5">
          <h2 className={ui.h2}>
            Step {step} of 5 · {STEP_NAMES[step - 1]}
          </h2>

          {/* Step 1 — Company Basics */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className={labelCls}>Company name<Required /></label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Headquarters country<Required /></label>
                <input
                  type="text"
                  value={headquartersCountry}
                  onChange={(e) => setHeadquartersCountry(e.target.value)}
                  placeholder="e.g. United States"
                  className={inputCls}
                />
                <p className={`${ui.help} mt-1`}>
                  Used to give the AI advisor context on your company&apos;s home base.
                </p>
              </div>

              <div>
                <label className={labelCls}>Industry sector<Required /></label>
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
                <label className={labelCls}>Revenue range<Required /></label>
                <div className="space-y-2 mt-1">
                  {(["$0–$10M", "$10M–$100M", "$100M–$1B", "$1B+"] as const).map((r) => (
                    <label key={r} className={checkboxLabelCls}>
                      <input
                        type="radio"
                        name="revenueRange"
                        value={r}
                        checked={revenueRange === r}
                        onChange={() => setRevenueRange(r)}
                        className="accent-ink"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Primary markets<Required /> <span className="font-normal text-ink-3">(select all that apply)</span></label>
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
                        className="accent-ink"
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
              <div className="flex items-center justify-between">
                <span className={ui.meta}>{suppliers.length} of 10 suppliers added</span>
                <button
                  onClick={addSupplier}
                  disabled={suppliers.length >= 10}
                  className={`${ui.btnSecondary} disabled:cursor-not-allowed`}
                >
                  Add supplier
                </button>
              </div>

              {suppliers.map((supplier, idx) => (
                <div key={supplier.id} className={groupCard}>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold text-ink">{supplier.name || `Supplier ${idx + 1}`}</span>
                    {suppliers.length > 1 && (
                      <button onClick={() => removeSupplier(supplier.id)} className={ui.btnGhost}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Supplier name<Required /></label>
                      <input
                        type="text"
                        value={supplier.name}
                        onChange={(e) => updateSupplier(supplier.id, "name", e.target.value)}
                        placeholder="e.g. Samsung SDI"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Country of origin<Required /></label>
                      <input
                        type="text"
                        value={supplier.country}
                        onChange={(e) => updateSupplier(supplier.id, "country", e.target.value)}
                        placeholder="e.g. South Korea"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Region<Required /></label>
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
                      <label className={labelCls}>What they supply<Required /></label>
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

                  {/* Tier-2 sub-suppliers — optional, visibility only */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTier2SupplierId(
                          expandedTier2SupplierId === supplier.id ? null : supplier.id
                        )
                      }
                      aria-expanded={expandedTier2SupplierId === supplier.id}
                      className={disclosureBtn}
                    >
                      <Chevron open={expandedTier2SupplierId === supplier.id} />
                      Who does {supplier.name || "this supplier"} buy from?
                      {(supplier.tier2Suppliers?.length ?? 0) > 0 &&
                        ` (${supplier.tier2Suppliers?.length})`}
                    </button>

                    {expandedTier2SupplierId === supplier.id && (
                      <div className="mt-3 space-y-2 border-t border-line-soft pt-3">
                        <p className={ui.help}>
                          Optional — knowing your supplier&apos;s own suppliers helps surface
                          disruptions one step further upstream than you&apos;d normally see.
                        </p>
                        {(supplier.tier2Suppliers ?? []).map((t2) => (
                          <div key={t2.id} className="grid sm:grid-cols-3 gap-2 items-start">
                            <input
                              type="text"
                              value={t2.name}
                              onChange={(e) =>
                                updateTier2Supplier(supplier.id, t2.id, "name", e.target.value)
                              }
                              placeholder="Sub-supplier name"
                              className={smallInput}
                            />
                            <input
                              type="text"
                              value={t2.country}
                              onChange={(e) =>
                                updateTier2Supplier(supplier.id, t2.id, "country", e.target.value)
                              }
                              placeholder="Country"
                              className={smallInput}
                            />
                            <div className="flex items-center gap-1">
                              <select
                                value={t2.region}
                                onChange={(e) =>
                                  updateTier2Supplier(supplier.id, t2.id, "region", e.target.value)
                                }
                                className={`${smallInput} flex-1`}
                              >
                                {SUPPLY_REGIONS.map((r) => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => removeTier2Supplier(supplier.id, t2.id)}
                                className={`${ui.btnGhost} flex-shrink-0`}
                                aria-label="Remove sub-supplier"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addTier2Supplier(supplier.id)}
                          className={disclosureBtn}
                        >
                          Add sub-supplier
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 — Inventory Profile */}
          {step === 3 && (
            <div className="space-y-4">
              {isLoaded && profile && productLines.some(p => !p.primarySupplierId) && (
                <div className={noteBox}>
                  <p>
                    Assign a primary supplier to each product line for accurate inventory risk calculations. Without this, all products default to your highest-share supplier&apos;s lead time.
                  </p>
                </div>
              )}
              {isLoaded && profile && (
                <div className={noteBox}>
                  <p>
                    Update your inventory days on hand to keep risk calculations accurate. These numbers were set on{" "}
                    {new Date(profile.updatedAt).toLocaleDateString()} and may no longer reflect current stock levels.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className={ui.meta}>{productLines.length} of 5 product lines added</span>
                <button
                  onClick={addProductLine}
                  disabled={productLines.length >= 5}
                  className={`${ui.btnSecondary} disabled:cursor-not-allowed`}
                >
                  Add product line
                </button>
              </div>

              {productLines.map((pl, idx) => (
                <div key={pl.id} className={groupCard}>
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-semibold text-ink">{pl.name || `Product line ${idx + 1}`}</span>
                    {productLines.length > 1 && (
                      <button onClick={() => removeProductLine(pl.id)} className={ui.btnGhost}>
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className={labelCls}>Product line name<Required /></label>
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
                    {suppliers.length > 0 && (
                      <div>
                        <label className={labelCls}>Primary supplier</label>
                        <select
                          value={pl.primarySupplierId ?? ""}
                          onChange={e => updateProductLine(pl.id, "primarySupplierId", e.target.value || undefined)}
                          className={inputCls}
                        >
                          <option value="">Select supplier (or leave as highest-share)</option>
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({s.country}) — {s.sharePercent}% of supply
                            </option>
                          ))}
                        </select>
                        <p className={`${ui.help} mt-1`}>
                          Which supplier provides this product? Used for lead time risk calculations.
                        </p>
                      </div>
                    )}
                    {suppliers.length > 1 && (
                      <div>
                        <label className={labelCls}>Backup supplier (optional)</label>
                        <select
                          value={pl.backupSupplierId ?? ""}
                          onChange={e => updateProductLine(pl.id, "backupSupplierId", e.target.value || undefined)}
                          className={inputCls}
                        >
                          <option value="">No backup assigned</option>
                          {suppliers
                            .filter(s => s.id !== pl.primarySupplierId)
                            .map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.country}) — {s.leadTimeDays}d lead time
                              </option>
                            ))}
                        </select>
                        <p className={`${ui.help} mt-1`}>
                          Who would you switch to if your primary supplier were disrupted?
                        </p>
                      </div>
                    )}
                    <div>
                      <label className={labelCls}>HS code (optional)</label>
                      <input
                        type="text"
                        value={pl.hsCode ?? ""}
                        onChange={(e) => updateProductLine(pl.id, "hsCode", e.target.value || undefined)}
                        placeholder="e.g. 8542.31.00"
                        className={inputCls}
                      />
                      <p className={`${ui.help} mt-1`}>
                        Harmonized System code — enables a real US import duty rate lookup for this product.
                      </p>
                    </div>

                    {/* Raw material breakout — optional, visibility only */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedRawMaterialsId(
                            expandedRawMaterialsId === pl.id ? null : pl.id
                          )
                        }
                        aria-expanded={expandedRawMaterialsId === pl.id}
                        className={disclosureBtn}
                      >
                        <Chevron open={expandedRawMaterialsId === pl.id} />
                        Break out raw materials for {pl.name || "this product"}
                        {(pl.rawMaterials?.length ?? 0) > 0 &&
                          ` (${pl.rawMaterials?.length})`}
                      </button>

                      {expandedRawMaterialsId === pl.id && (
                        <div className="mt-3 space-y-3 border-t border-line-soft pt-3">
                          <p className={ui.help}>
                            Optional — if this finished good depends on multiple inputs from
                            different vendors, list them here with their own lead time and
                            safety stock. Vendors are picked from the suppliers you entered
                            in Step 2.
                          </p>
                          {(pl.rawMaterials ?? []).map((m) => (
                            <div key={m.id} className="rounded-lg border border-line-soft bg-paper-raised p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={m.name}
                                  onChange={(e) =>
                                    updateRawMaterial(pl.id, m.id, "name", e.target.value)
                                  }
                                  placeholder="Material name, e.g. Glass-fiber yarn"
                                  className={`${smallInput} flex-1`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeRawMaterial(pl.id, m.id)}
                                  className={`${ui.btnGhost} flex-shrink-0`}
                                  aria-label="Remove raw material"
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                <div>
                                  <label className={smallLabel}>Primary vendor</label>
                                  <select
                                    value={m.primaryVendorId ?? ""}
                                    onChange={(e) =>
                                      updateRawMaterial(pl.id, m.id, "primaryVendorId", e.target.value || undefined)
                                    }
                                    className={smallInput}
                                  >
                                    <option value="">Select vendor</option>
                                    {suppliers.map((s) => (
                                      <option key={s.id} value={s.id}>{s.name || "Unnamed supplier"}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className={smallLabel}>Secondary vendor</label>
                                  <select
                                    value={m.secondaryVendorId ?? ""}
                                    onChange={(e) =>
                                      updateRawMaterial(pl.id, m.id, "secondaryVendorId", e.target.value || undefined)
                                    }
                                    className={smallInput}
                                  >
                                    <option value="">No alternate assigned</option>
                                    {suppliers
                                      .filter((s) => s.id !== m.primaryVendorId)
                                      .map((s) => (
                                        <option key={s.id} value={s.id}>{s.name || "Unnamed supplier"}</option>
                                      ))}
                                  </select>
                                </div>
                                <div>
                                  <label className={smallLabel}>Lead time (days)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.leadTimeDays ?? ""}
                                    onChange={(e) =>
                                      updateRawMaterial(
                                        pl.id, m.id, "leadTimeDays",
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                    placeholder="Uses vendor's lead time if blank"
                                    className={smallInput}
                                  />
                                </div>
                                <div>
                                  <label className={smallLabel}>Reorder point / safety stock (days)</label>
                                  <input
                                    type="number"
                                    min={0}
                                    value={m.reorderPointDays ?? ""}
                                    onChange={(e) =>
                                      updateRawMaterial(
                                        pl.id, m.id, "reorderPointDays",
                                        e.target.value === "" ? undefined : Number(e.target.value)
                                      )
                                    }
                                    className={smallInput}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                          {(pl.rawMaterials?.length ?? 0) < 5 && (
                            <button
                              type="button"
                              onClick={() => addRawMaterial(pl.id)}
                              className={disclosureBtn}
                            >
                              Add raw material
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 4 — Pain Points */}
          {step === 4 && (
            <div className="space-y-3">
              <p className={ui.body}>
                Select your top 3 supply chain challenges
              </p>
              {PAIN_POINTS.map((pp) => {
                const checked = painPoints.includes(pp)
                const disabled = !checked && painPoints.length >= 3
                return (
                  <label
                    key={pp}
                    className={`flex items-center gap-3 text-[15px] rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-ink bg-surface font-semibold text-ink"
                        : disabled
                        ? "border-line-soft text-ink-3 cursor-not-allowed"
                        : "border-line bg-surface text-ink hover:border-ink"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePainPoint(pp)}
                      className="accent-ink"
                    />
                    {pp}
                  </label>
                )
              })}
              <p className={ui.help}>{painPoints.length}/3 selected</p>
            </div>
          )}

          {/* Step 5 — Transportation */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <p className={`${ui.label} mb-3`}>
                  How do you primarily move goods?<Required />
                </p>
                <div className="space-y-2">
                  {TRANSPORT_MODES.map((mode) => (
                    <label key={mode} className={checkboxLabelCls}>
                      <input
                        type="checkbox"
                        checked={transportModes.includes(mode)}
                        onChange={() => toggleTransport(mode)}
                        className="accent-ink"
                      />
                      {mode}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <p className={`${ui.label} mb-3`}>
                  Which shipping lanes are most critical to you?
                </p>
                <div className="space-y-2">
                  {TRADE_LANES.map((lane) => (
                    <label key={lane} className={checkboxLabelCls}>
                      <input
                        type="checkbox"
                        checked={tradeLanes.includes(lane)}
                        onChange={() => toggleTradeLane(lane)}
                        className="accent-ink"
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
            <p className={ui.errorBox} role="alert">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-3">
            {step > 1 ? (
              <button onClick={handleBack} className={ui.btnSecondary}>
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <button onClick={handleContinue} className={ui.btnPrimary}>
                Continue
              </button>
            ) : (
              <button onClick={handleSave} className={`${ui.btnAccent} px-5 py-2.5`}>
                Save profile
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
