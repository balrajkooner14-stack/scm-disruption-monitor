"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Logo from "@/components/ui/Logo"
import OnboardingHeader from "@/components/onboarding/OnboardingHeader"
import StepChoosePath from "@/components/onboarding/StepChoosePath"
import StepCompany from "@/components/onboarding/StepCompany"
import StepFirstLight from "@/components/onboarding/StepFirstLight"
import StepImport from "@/components/onboarding/StepImport"
import StepProducts from "@/components/onboarding/StepProducts"
import StepPorts from "@/components/onboarding/StepPorts"
import StepSuppliers from "@/components/onboarding/StepSuppliers"
import { useAuth } from "@/hooks/useAuth"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { useOnboardingExtras } from "@/hooks/useOnboardingExtras"
import type { DisruptionEvent } from "@/lib/types"
import {
  DRAFT_STORAGE_KEY,
  companyFromEmail,
  draftToExtras,
  emptyDraft,
  firstNameFromMetadata,
  onboardingToProfile,
  validDraftSuppliers,
  type OnboardingDraft,
  type OnboardingPath,
  type OnboardingStep,
} from "@/lib/onboarding"
import { ui } from "@/lib/ui"

// The /onboarding flow (spec 6): owns the draft, autosaves it, and routes
// between steps. Each step is a presentational component fed by the draft.

const MANUAL_STEPS: OnboardingStep[] = ["company", "suppliers", "ports", "products"]
const IMPORT_STEPS: OnboardingStep[] = ["company", "import", "ports"]
const MANUAL_LABELS = ["Company", "Suppliers", "Ports", "Products"]
const IMPORT_LABELS = ["Company", "Import", "Ports"]
const TIME_LEFT: Record<OnboardingPath, Partial<Record<OnboardingStep, string>>> = {
  manual: { company: "About 4 min left", suppliers: "About 3 min left", ports: "About 2 min left", products: "Last step" },
  import: { company: "About 3 min left", import: "About 2 min left", ports: "Last step" },
  sample: {},
}

const AUTOSAVE_MS = 400

function readDraft(): OnboardingDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OnboardingDraft
    return parsed && parsed.version === 1 ? parsed : null
  } catch {
    return null
  }
}

function writeDraft(draft: OnboardingDraft) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {}
}

interface OnboardingFlowProps {
  /** Today's events; the live panels in the supplier/port/product steps read them. */
  events: DisruptionEvent[]
}

export default function OnboardingFlow({ events }: OnboardingFlowProps) {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const { profile, isLoaded: profileLoaded, saveProfile } = useCompanyProfile()
  const { saveExtras } = useOnboardingExtras()

  const [draft, setDraft] = useState<OnboardingDraft | null>(null)
  const [hadStoredDraft, setHadStoredDraft] = useState(false)
  // Decided once, when everything has loaded: a profile that exists before
  // this visit (and no draft to resume) shows the "already set up" notice.
  // Not re-evaluated afterwards, or saving at the finish step would swap the
  // first-light screen for the notice.
  const [alreadySetUp, setAlreadySetUp] = useState<string | null | undefined>(undefined)
  const finished = useRef(false)
  const [savingLater, setSavingLater] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const prefilled = useRef(false)

  // Restore the draft after mount (localStorage isn't available on the server).
  useEffect(() => {
    const stored = readDraft()
    setHadStoredDraft(stored !== null)
    setDraft(stored ?? emptyDraft())
  }, [])

  useEffect(() => {
    if (alreadySetUp !== undefined || !draft || authLoading || !profileLoaded) return
    setAlreadySetUp(profile && !hadStoredDraft ? profile.companyName : null)
  }, [alreadySetUp, draft, authLoading, profileLoaded, profile, hadStoredDraft])

  // Autosave, debounced. Only once a path is chosen: before that there is
  // nothing to resume, and saving would turn a mere visit into a "draft" that
  // hides the already-set-up notice on the next visit. Never on the finish
  // step, which deletes the draft once the setup is saved.
  useEffect(() => {
    if (!draft?.path || draft.step === "finish" || finished.current) return
    const t = setTimeout(() => writeDraft(draft), AUTOSAVE_MS)
    return () => clearTimeout(t)
  }, [draft])

  // Prefill the company name from a work email, once, if still empty.
  useEffect(() => {
    if (prefilled.current || !draft || authLoading) return
    prefilled.current = true
    const guess = companyFromEmail(user?.email)
    if (guess && !draft.company.name) {
      setDraft(d => (d ? { ...d, company: { ...d.company, name: guess } } : d))
    }
  }, [draft, user, authLoading])

  // Step changes start at the top of the page.
  const step = draft?.step
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [step])

  const update = useCallback((fn: (d: OnboardingDraft) => OnboardingDraft) => {
    setDraft(d => (d ? fn(d) : d))
  }, [])

  const goTo = (next: OnboardingStep) => update(d => ({ ...d, step: next }))

  const steps = draft?.path === "import" ? IMPORT_STEPS : MANUAL_STEPS
  const labels = draft?.path === "import" ? IMPORT_LABELS : MANUAL_LABELS

  const goNext = () => {
    if (!draft) return
    const i = steps.indexOf(draft.step)
    goTo(i >= 0 && i < steps.length - 1 ? steps[i + 1] : "finish")
  }
  const goBack = () => {
    if (!draft) return
    const i = steps.indexOf(draft.step)
    goTo(i > 0 ? steps[i - 1] : "path")
  }

  const choosePath = (path: OnboardingPath) => {
    if (path === "sample") return // wired in the sample-company phase
    update(d => ({ ...d, path, step: "company" }))
  }

  const saveAndFinishLater = async () => {
    if (!draft) return
    writeDraft(draft)
    setSaveError(null)
    if (validDraftSuppliers(draft).length > 0) {
      setSavingLater(true)
      const saved = await saveProfile(onboardingToProfile(draft))
      const extrasSaved = saved && (await saveExtras(draftToExtras(draft)))
      setSavingLater(false)
      if (!saved || !extrasSaved) {
        setSaveError("We couldn't save your setup. Your answers are kept on this device.")
        return
      }
    }
    router.push("/")
  }

  // ── Loading ──
  if (!draft || authLoading || !profileLoaded || alreadySetUp === undefined) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <div className="flex h-16 items-center border-b border-line bg-paper-raised px-6 sm:px-12">
          <Logo size={26} />
        </div>
        <div className="flex flex-col gap-4 px-6 py-16 sm:px-12 xl:px-[120px]" aria-label="Loading">
          <div className={`${ui.skeleton} h-4 w-32`} />
          <div className={`${ui.skeleton} h-12 w-full max-w-[640px]`} />
          <div className="grid grid-cols-1 gap-5 pt-6 lg:grid-cols-3">
            <div className={`${ui.skeleton} h-56 rounded-[14px]`} />
            <div className={`${ui.skeleton} h-56 rounded-[14px]`} />
            <div className={`${ui.skeleton} h-56 rounded-[14px]`} />
          </div>
        </div>
      </div>
    )
  }

  // ── Already set up (and not resuming a saved-for-later draft) ──
  if (alreadySetUp) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10">
        <div className="w-full max-w-[440px] space-y-6 rounded-xl border border-line bg-paper-raised p-8">
          <Logo />
          <h1 className={ui.h2}>
            {/* "Inc." already ends the sentence; don't print "Inc.." */}
            You&apos;ve already set up {alreadySetUp.replace(/\.+$/, "")}. Edit your profile instead?
          </h1>
          <div className="flex flex-wrap gap-3">
            <Link href="/profile" className={`${ui.btnPrimary} py-2.5`}>Edit my profile</Link>
            <Link href="/" className={`${ui.btnSecondary} py-2.5`}>Go to my dashboard</Link>
          </div>
        </div>
      </div>
    )
  }

  const firstName = firstNameFromMetadata(user?.user_metadata)

  if (draft.step === "path" || !draft.path) {
    return (
      <div className="flex min-h-screen flex-col bg-paper">
        <OnboardingHeader variant="path" email={user?.email} />
        <StepChoosePath firstName={firstName} onChoose={choosePath} sampleAvailable={false} />
      </div>
    )
  }

  if (draft.step === "finish") {
    return (
      <StepFirstLight
        draft={draft}
        events={events}
        saveProfile={saveProfile}
        saveExtras={saveExtras}
        onSaved={() => {
          finished.current = true
        }}
      />
    )
  }

  const currentIndex = Math.max(0, steps.indexOf(draft.step))
  const timeLeft = TIME_LEFT[draft.path][draft.step] ?? ""

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <OnboardingHeader
        variant="steps"
        labels={labels}
        currentIndex={currentIndex}
        timeLeft={timeLeft}
        onSaveLater={saveAndFinishLater}
        saving={savingLater}
      />
      {saveError && (
        <div className="px-6 pt-4 sm:px-16">
          <p className={ui.errorBox} role="alert">{saveError}</p>
        </div>
      )}

      {draft.step === "company" && (
        <StepCompany
          company={draft.company}
          path={draft.path}
          firstName={firstName}
          onChange={patch => update(d => ({ ...d, company: { ...d.company, ...patch } }))}
          onContinue={goNext}
        />
      )}

      {draft.step === "suppliers" && (
        <StepSuppliers
          suppliers={draft.suppliers}
          events={events}
          onChange={suppliers => update(d => ({ ...d, suppliers }))}
          onBack={goBack}
          onContinue={goNext}
        />
      )}

      {draft.step === "ports" && (
        <StepPorts
          entryPorts={draft.entryPorts}
          transport={draft.transport}
          events={events}
          path={draft.path}
          companyName={draft.company.name}
          onChange={patch => update(d => ({ ...d, ...patch }))}
          onBack={goBack}
          onContinue={goNext}
        />
      )}

      {draft.step === "products" && (
        <StepProducts
          draft={draft}
          events={events}
          onChange={products => update(d => ({ ...d, products }))}
          onBack={goBack}
          onFinish={goNext}
        />
      )}

      {draft.step === "import" && (
        <StepImport
          onConfirm={({ suppliers, products }) => update(d => ({ ...d, suppliers, products, step: "ports" }))}
          onTypeInstead={() => update(d => ({ ...d, path: "manual", step: "suppliers" }))}
          onBack={goBack}
        />
      )}
    </div>
  )
}
