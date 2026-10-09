"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Logo from "@/components/ui/Logo"
import type { DisruptionEvent } from "@/lib/types"
import type { CompanyProfile } from "@/lib/profile"
import { COLOR } from "@/lib/brand"
import { ENABLE_EMAIL_BRIEF, ENABLE_TEAMS } from "@/lib/featureFlags"
import {
  DRAFT_STORAGE_KEY,
  draftToExtras,
  onboardingToProfile,
  shortCompanyName,
  watchingSentence,
  type OnboardingDraft,
  type OnboardingExtras,
} from "@/lib/onboarding"
import { firstLightCards, type FirstLightCard } from "@/lib/onboardingInsights"
import { computeChecklist, openItems, setupPercent } from "@/lib/setupChecklist"
import { ui } from "@/lib/ui"

// Screen 7 (spec 6.8): save the setup, then show what Foreglow sees today
// for this network, computed from the user's answers and today's real events.

const FLAGS = { emailBrief: ENABLE_EMAIL_BRIEF, teams: ENABLE_TEAMS }

function elapsedLabel(startedAt: string, now: Date): string | null {
  const ms = now.getTime() - new Date(startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0 || ms > 30 * 60_000) return null
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)} min ${total % 60} s`
}

function Card({ card }: { card: FirstLightCard }) {
  const tone = card.tone === "critical" ? ui.chipCritical : card.tone === "warning" ? ui.chipWarning : ui.chipPositive
  return (
    <article className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-[22px]">
      <span className={`${ui.chip} ${tone} self-start`}>{card.label}</span>
      <h2 className="line-clamp-2 font-serif text-[23px] font-medium leading-[1.2] text-ink">{card.title}</h2>
      <p className="text-sm leading-relaxed text-ink-2">{card.body}</p>
    </article>
  )
}

interface StepFirstLightProps {
  draft: OnboardingDraft
  events: DisruptionEvent[]
  saveProfile: (p: CompanyProfile) => Promise<boolean>
  saveExtras: (x: Partial<OnboardingExtras>) => Promise<boolean>
  /** Called once everything is saved (the flow stops autosaving the draft). */
  onSaved: () => void
}

export default function StepFirstLight({ draft, events, saveProfile, saveExtras, onSaved }: StepFirstLightProps) {
  // Fix "now" once so the profile, extras and cards all agree.
  const [now] = useState(() => new Date())
  const profile = useMemo(() => onboardingToProfile(draft, now), [draft, now])
  const baseExtras = useMemo(() => draftToExtras(draft, now), [draft, now])
  const [status, setStatus] = useState<"saving" | "saved" | "error">("saving")
  const [extras, setExtras] = useState<OnboardingExtras>(baseExtras)
  const started = useRef(false)

  const save = useCallback(async () => {
    setStatus("saving")
    const completed: OnboardingExtras = { ...baseExtras, completedAt: now.toISOString() }
    const checklistInitial = openItems(computeChecklist(profile, completed, FLAGS)).map(i => i.id)
    const finalExtras: OnboardingExtras = { ...completed, checklistInitial }
    const profileSaved = await saveProfile(profile)
    const extrasSaved = profileSaved && (await saveExtras(finalExtras))
    if (!profileSaved || !extrasSaved) {
      setStatus("error")
      return
    }
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {}
    setExtras(finalExtras)
    setStatus("saved")
    onSaved()
  }, [baseExtras, now, profile, saveExtras, saveProfile, onSaved])

  useEffect(() => {
    // Strict mode mounts twice in dev; save exactly once.
    if (started.current) return
    started.current = true
    void save()
  }, [save])

  const cards = useMemo(() => firstLightCards(profile, extras, events, now), [profile, extras, events, now])
  const pct = useMemo(() => setupPercent(profile, extras, computeChecklist(profile, extras, FLAGS)), [profile, extras])

  if (status !== "saved") {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="flex h-16 items-center border-b border-line bg-paper-raised px-6 sm:px-12">
          <Logo size={26} />
        </div>
        <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-6 py-24">
          {status === "saving" ? (
            <>
              <p className={ui.eyebrow} role="status">Saving your setup…</p>
              <div className={`${ui.skeleton} h-12 w-3/4`} />
              <div className={`${ui.skeleton} h-4 w-full`} />
              <div className={`${ui.skeleton} h-4 w-5/6`} />
            </>
          ) : (
            <>
              <p className={ui.errorBox} role="alert">We couldn&apos;t save your setup. Your answers are kept on this device.</p>
              <button type="button" onClick={() => void save()} className={`${ui.btnPrimary} self-start py-2.5`}>
                Try again
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const elapsed = elapsedLabel(draft.startedAt, now)
  const countries = new Set(profile.suppliers.map(s => s.country)).size
  const quietOnly = cards.length === 1 && cards[0].key === "quiet"

  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <section className="relative flex h-[360px] shrink-0 flex-col gap-3.5 overflow-hidden bg-ink px-6 py-14 text-paper sm:px-12 xl:px-[120px]">
        {elapsed && (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-dawn">Setup complete · {elapsed}</p>
        )}
        <h1 className="font-serif text-[64px] font-normal leading-[1.02]">
          First light, <em className="italic text-dawn">{shortCompanyName(profile.companyName)}.</em>
        </h1>
        <p className="max-w-[760px] text-[19px] leading-normal text-on-ink-muted">
          {watchingSentence({
            suppliers: profile.suppliers.length,
            countries,
            ports: (extras.entryPorts ?? []).length,
            products: profile.productLines.length,
          })}
        </p>
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="xMaxYMax slice"
          className="absolute bottom-0 left-0 h-[120px] w-full"
          fill="none"
          aria-hidden="true"
        >
          <g className="animate-[sunRise_1.2s_ease-out]">
            <path d="M1040 120 A190 190 0 0 1 1420 120" stroke={COLOR.dawn} strokeWidth="1.5" />
            <path d="M1105 120 A125 125 0 0 1 1355 120 Z" fill={COLOR.ember} />
          </g>
          <path d="M0 119 H1440" stroke={COLOR.paper} strokeWidth="2" />
        </svg>
      </section>

      <section className="flex flex-col gap-[22px] px-6 py-10 sm:px-12 xl:px-[120px]">
        {quietOnly ? (
          <div className="mx-auto w-full max-w-xl">
            <Card card={cards[0]} />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {cards.map(c => <Card key={c.key} card={c} />)}
          </div>
        )}

        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
          {ENABLE_EMAIL_BRIEF && (
            <div className="flex items-center justify-between gap-5 rounded-xl border border-line bg-paper-raised p-[22px] lg:col-span-7">
              <div className="flex flex-col gap-1">
                <p className="font-semibold text-ink">Get this in your inbox every morning</p>
                <p className="text-sm text-ink-2">
                  A short brief at 7:00 AM {Intl.DateTimeFormat().resolvedOptions().timeZone.replace(/_/g, " ")} time. Only what touches your network.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={extras.morningEmail ?? true}
                aria-label="Morning email brief"
                onClick={async () => {
                  const next = !(extras.morningEmail ?? true)
                  if (await saveExtras({ morningEmail: next })) setExtras(x => ({ ...x, morningEmail: next }))
                }}
                className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors ${(extras.morningEmail ?? true) ? "bg-ink" : "bg-line-strong"}`}
              >
                <span className={`absolute top-1 h-[22px] w-[22px] rounded-full bg-paper transition-transform ${(extras.morningEmail ?? true) ? "translate-x-[26px]" : "translate-x-1"} left-0`} />
              </button>
            </div>
          )}
          <div className={`flex flex-col justify-center gap-2.5 ${ENABLE_EMAIL_BRIEF ? "lg:col-span-5" : "lg:col-span-6 lg:col-start-4"}`}>
            <Link href="/" className={`${ui.btnAccent} h-[52px] text-base`}>Open my dashboard</Link>
            <p className={`${ui.meta} text-center`}>Setup is {pct}% complete. Your dashboard shows what to add next.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
