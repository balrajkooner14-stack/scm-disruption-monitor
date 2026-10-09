"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import HorizonProgress from "@/components/onboarding/HorizonProgress"
import { useOnboardingExtras } from "@/hooks/useOnboardingExtras"
import type { CompanyProfile } from "@/lib/profile"
import { isDemoMode } from "@/lib/demoMode"
import { ENABLE_EMAIL_BRIEF, ENABLE_TEAMS } from "@/lib/featureFlags"
import { checklistProgress, computeChecklist, openItems, type ChecklistItem } from "@/lib/setupChecklist"
import { ui } from "@/lib/ui"

// "Sharpen your alerts" (spec 8.1, screen 8): the rest of the profile,
// collected over time, most valuable item first. Top of the Overview tab.

const FLAGS = { emailBrief: ENABLE_EMAIL_BRIEF, teams: ENABLE_TEAMS }
const MAX_ROWS = 4
const BAR_START = 4
const BAR_END = 296

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}

export default function SetupChecklist({ profile }: { profile: CompanyProfile | null }) {
  const { extras, saveExtras, isLoaded } = useOnboardingExtras()
  const [demo, setDemo] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const completionSaved = useRef(false)

  useEffect(() => {
    setDemo(isDemoMode())
  }, [])

  const items = useMemo(() => (profile ? computeChecklist(profile, extras, FLAGS) : []), [profile, extras])
  const open = openItems(items)
  const { done, total } = checklistProgress(items, extras)
  const initial = new Set(extras?.checklistInitial ?? [])
  const doneItems = items.filter(i => i.done && initial.has(i.id))
  const dismissed = !!extras?.checklistDismissedAt || hidden
  // Only meaningful once the profile and extras have loaded: before that the
  // item list is empty, which would otherwise read as "everything done" and
  // permanently hide the checklist.
  const allDone = !!profile && isLoaded && items.length > 0 && open.length === 0 && initial.size > 0

  // Everything done: say so once, then hide for good.
  useEffect(() => {
    if (!allDone || dismissed || completionSaved.current || demo) return
    completionSaved.current = true
    void saveExtras({ checklistDismissedAt: new Date().toISOString() })
  }, [allDone, dismissed, demo, saveExtras])

  if (!profile || !isLoaded || demo) return null
  if (allDone) {
    if (!completionSaved.current && dismissed) return null
    return (
      <section className="flex items-center gap-3 rounded-[14px] border border-line bg-paper-raised px-7 py-5" role="status">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-moss-tint text-moss-deep">
          <CheckIcon />
        </span>
        <p className="text-[15px] text-ink">Setup complete. Foreglow is tuned to your network.</p>
      </section>
    )
  }
  if (dismissed || open.length === 0) return null

  const hide = async () => {
    setError(null)
    setHidden(true)
    const ok = await saveExtras({ checklistDismissedAt: new Date().toISOString() })
    if (!ok) {
      setHidden(false)
      setError("Couldn't hide the checklist. Try again.")
    }
  }

  const fraction = total > 0 ? done / total : 0
  const rows = showAll ? open : open.slice(0, MAX_ROWS)

  return (
    <section
      aria-label="Sharpen your alerts"
      className="grid grid-cols-1 gap-8 rounded-[14px] border border-line bg-paper-raised p-7 lg:grid-cols-[320px_1fr] lg:gap-10"
    >
      <div className="flex flex-col gap-3.5">
        <p className={ui.eyebrow}>Sharpen your alerts</p>
        <h2 className="font-serif text-[32px] font-normal leading-[1.12] text-ink">
          {done} of {total} done. Each step makes Foreglow more specific to you.
        </h2>
        <HorizonProgress
          width={300}
          height={40}
          lineStart={BAR_START}
          lineEnd={BAR_END}
          stops={[]}
          sunX={BAR_START + (BAR_END - BAR_START) * fraction}
          ariaLabel={`Setup progress: ${done} of ${total} steps done`}
        />
        <button type="button" onClick={hide} className={`${ui.btnGhost} self-start px-0 text-ink-2 hover:text-ink`}>
          Hide for now
        </button>
        {error && <p className={ui.errorBox} role="alert">{error}</p>}
      </div>

      <div className="flex flex-col">
        {rows.map((item, i) => (
          <Row key={item.id} item={item} primary={i === 0} onEmail={() => saveExtras({ morningEmail: true })} />
        ))}
        {!showAll && open.length > MAX_ROWS && (
          <button type="button" onClick={() => setShowAll(true)} className={`${ui.btnGhost} self-start px-0 pt-3`}>
            Show {open.length - MAX_ROWS} more
          </button>
        )}
        {doneItems.length > 0 && (
          <div className="grid grid-cols-[28px_1fr_120px] items-center gap-3.5 py-4 text-ink-3">
            <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-moss-tint text-moss-deep">
              <CheckIcon />
            </span>
            <span className="line-through">{doneItems.map(i => i.title).join(", ")}</span>
            <span className="text-[13px]">Done</span>
          </div>
        )}
      </div>
    </section>
  )
}

function Row({ item, primary, onEmail }: { item: ChecklistItem; primary: boolean; onEmail: () => void }) {
  const btn = `${primary ? ui.btnPrimary : ui.btnSecondary} justify-self-start`
  return (
    <div className="grid grid-cols-[28px_1fr] items-center gap-3.5 border-b border-line-soft py-4 sm:grid-cols-[28px_1fr_120px_150px]">
      <span className="h-[22px] w-[22px] rounded-full border-[1.5px] border-line-control" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-ink">{item.title}</span>
        <span className="text-[13px] text-ink-2">{item.why}</span>
      </div>
      <span className={`${ui.meta} col-start-2 sm:col-start-auto`}>{item.time}</span>
      {item.href ? (
        <Link href={item.href} className={`${btn} col-start-2 sm:col-start-auto`}>{item.actionLabel}</Link>
      ) : item.id === "email" ? (
        <button type="button" onClick={onEmail} className={`${btn} col-start-2 sm:col-start-auto`}>{item.actionLabel}</button>
      ) : (
        <button type="button" disabled className={`${btn} col-start-2 sm:col-start-auto`}>{item.actionLabel}</button>
      )}
    </div>
  )
}
