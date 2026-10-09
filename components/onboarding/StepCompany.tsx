"use client"

import { useEffect, useRef, useState } from "react"
import CountryCombobox from "@/components/onboarding/CountryCombobox"
import StepLayout, { StepHeading } from "@/components/onboarding/StepLayout"
import type { IndustrySector } from "@/lib/profile"
import { findCountry } from "@/lib/countries"
import {
  REVENUE_CHIPS,
  ROLE_CHIPS,
  SECTOR_CHIPS,
  roleLabel,
  type OnboardingDraft,
  type OnboardingPath,
} from "@/lib/onboarding"
import { ui } from "@/lib/ui"

// Screen 3 (spec 6.2): company basics, with a morning-brief preview that
// takes shape as the user answers.

type Company = OnboardingDraft["company"]

const WHY_WE_ASK: Partial<Record<IndustrySector, string>> = {
  Electronics: "Electronics importers care about chip capacity, memory supply and Asian port congestion.",
  Apparel: "Consumer goods importers care about Asian factory output, ocean freight and peak-season port congestion.",
  Retail: "Consumer goods importers care about Asian factory output, ocean freight and peak-season port congestion.",
  Automotive: "Industrial and automotive importers care about component lead times, Mexico border crossings and steel and metals supply.",
  Industrial: "Industrial and automotive importers care about component lead times, Mexico border crossings and steel and metals supply.",
  Pharmaceuticals: "Medical and pharma importers care about single-source ingredients, air freight and regulatory holds.",
  "Food & Beverage": "Food and beverage importers care about weather, crop conditions and cold-chain transport.",
}
const WHY_WE_ASK_DEFAULT = "Your answer decides which long-term risks we watch for you."

function tomorrowLabel(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  const weekday = d.toLocaleDateString("en-US", { weekday: "short" })
  const month = d.toLocaleDateString("en-US", { month: "short" })
  return `${weekday} ${d.getDate()} ${month}`
}

function ChipRow<T extends string>({
  legend,
  hint,
  options,
  value,
  onSelect,
  error,
  errorId,
}: {
  legend: string
  hint?: string
  options: { label: string; value: T }[]
  value: T | undefined
  onSelect: (v: T) => void
  error?: string | null
  errorId: string
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
      <legend className={`mb-2 ${ui.label}`}>
        {legend}
        {hint && <span className="font-normal text-ink-3"> · {hint}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onSelect(o.value)}
            className={value === o.value ? ui.choiceChipOn : ui.choiceChip}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p id={errorId} className="text-[13px] text-ember-deep">{error}</p>}
    </fieldset>
  )
}

interface StepCompanyProps {
  company: Company
  path: OnboardingPath | undefined
  firstName: string | null
  onChange: (patch: Partial<Company>) => void
  onContinue: () => void
}

export default function StepCompany({ company, path, firstName, onChange, onContinue }: StepCompanyProps) {
  const [attempted, setAttempted] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const [tomorrow, setTomorrow] = useState("")

  useEffect(() => {
    nameRef.current?.focus()
    setTomorrow(tomorrowLabel())
  }, [])

  const errors = {
    name: company.name.trim() ? null : "Enter your company name.",
    hq: !company.hqCountry.trim()
      ? "Enter your headquarters country."
      : findCountry(company.hqCountry)
        ? null
        : "Pick a country from the list.",
    sector: company.sector ? null : "Choose what you sell.",
    revenue: company.revenueRange ? null : "Choose a revenue range.",
  }
  const valid = Object.values(errors).every(e => e === null)
  const show = (e: string | null) => (attempted ? e : null)

  const submit = () => {
    setAttempted(true)
    if (valid) onContinue()
  }

  const role = roleLabel(company.role)
  const metaParts = [
    tomorrow,
    firstName || role
      ? `for ${[firstName, role ? role.charAt(0).toLowerCase() + role.slice(1) : null].filter(Boolean).join(", ")}`
      : null,
  ].filter(Boolean)
  const companyName = company.name.trim()

  return (
    <StepLayout
      formWidth="narrow"
      onSubmit={submit}
      panelLabel="Your morning brief, taking shape"
      form={
        <>
          <StepHeading
            title="First, the basics about your company."
            sub="This shapes which news counts as relevant to you."
          />
          <div className="grid grid-cols-1 gap-[18px] sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="onb-company" className={ui.label}>Company name</label>
              <input
                ref={nameRef}
                id="onb-company"
                type="text"
                value={company.name}
                onChange={e => onChange({ name: e.target.value })}
                autoComplete="organization"
                aria-invalid={!!show(errors.name) || undefined}
                aria-describedby={show(errors.name) ? "onb-company-error" : undefined}
                className={`${ui.input} h-[46px]`}
              />
              {show(errors.name) && <p id="onb-company-error" className="text-[13px] text-ember-deep">{errors.name}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="onb-hq" className={ui.label}>Headquarters country</label>
              <CountryCombobox
                id="onb-hq"
                value={company.hqCountry}
                onChange={v => onChange({ hqCountry: v })}
                invalid={!!show(errors.hq)}
                describedBy={show(errors.hq) ? "onb-hq-error" : undefined}
                inputClassName={`${ui.input} h-[46px]`}
              />
              {show(errors.hq) && <p id="onb-hq-error" className="text-[13px] text-ember-deep">{errors.hq}</p>}
            </div>
          </div>

          <ChipRow
            legend="What do you sell?"
            options={SECTOR_CHIPS}
            value={company.sector}
            onSelect={v => onChange({ sector: v })}
            error={show(errors.sector)}
            errorId="onb-sector-error"
          />
          <ChipRow
            legend="Revenue range"
            options={REVENUE_CHIPS}
            value={company.revenueRange}
            onSelect={v => onChange({ revenueRange: v })}
            error={show(errors.revenue)}
            errorId="onb-revenue-error"
          />
          <ChipRow
            legend="Your role"
            hint="so your morning brief speaks your language"
            options={ROLE_CHIPS}
            value={company.role}
            onSelect={v => onChange({ role: company.role === v ? undefined : v })}
            errorId="onb-role-error"
          />
        </>
      }
      footer={
        <>
          <p className={ui.meta}>Pain points and where you sell come later, from your dashboard.</p>
          <button type="submit" className={`${ui.btnPrimary} shrink-0 px-6 py-3.5 text-[15px]`}>
            {path === "import" ? "Continue to upload →" : "Continue to suppliers →"}
          </button>
        </>
      }
      panel={
        <>
          <p className={ui.eyebrow}>Your morning brief, taking shape</p>
          <div className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-6">
            {metaParts.length > 0 && <p className="text-[13px] text-ink-3">{metaParts.join(" · ")}</p>}
            <p className="font-serif text-[30px] leading-[1.15] text-ink">
              Good morning. Here&apos;s what touches{" "}
              <span className={companyName ? "text-ember" : "text-ink-3"}>{companyName || "your company"}</span> today.
            </p>
            <div className="flex flex-col gap-2.5" aria-hidden="true">
              <div className="h-3 w-[92%] rounded-md bg-paper-sunk" />
              <div className="h-3 w-[78%] rounded-md bg-paper-sunk" />
              <div className="h-3 w-[85%] rounded-md bg-paper-sunk" />
            </div>
            <p className="rounded-lg bg-paper p-3 text-sm text-ink-2">
              This fills in as soon as you add your first supplier.
            </p>
          </div>
          <div className="flex flex-col gap-3 pt-2">
            <p className="text-[13px] font-semibold text-ink">Why we ask</p>
            <p className="text-sm leading-relaxed text-ink-2">
              {(company.sector && WHY_WE_ASK[company.sector]) || WHY_WE_ASK_DEFAULT}
            </p>
          </div>
        </>
      }
    />
  )
}
