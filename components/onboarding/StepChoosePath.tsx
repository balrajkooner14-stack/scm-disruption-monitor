"use client"

import Logo from "@/components/ui/Logo"
import { SETUP_CALL_URL } from "@/lib/authProviders"
import type { OnboardingPath } from "@/lib/onboarding"
import { ui } from "@/lib/ui"

// Screen 2 (spec 6.1): three ways in. No progress bar on this screen.

interface StepChoosePathProps {
  firstName: string | null
  onChoose: (path: OnboardingPath) => void
  sampleAvailable: boolean
}

function DocumentIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5" />
      <path d="M8 13h8M8 17h8M8 9h3" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  )
}

interface OptionCardProps {
  icon: React.ReactNode
  chip: string
  highlighted?: boolean
  title: string
  body: string
  meta: string
  onClick: () => void
  disabled?: boolean
  autoFocus?: boolean
}

function OptionCard({ icon, chip, highlighted, title, body, meta, onClick, disabled, autoFocus }: OptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`flex flex-col gap-3.5 rounded-[14px] p-7 text-left text-ink transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        highlighted
          ? "border-2 border-ink bg-surface"
          : "border border-line bg-paper-raised hover:border-ink"
      }`}
    >
      <span className="flex w-full items-center justify-between">
        {icon}
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
            highlighted ? "bg-ink text-paper" : "bg-line-soft text-ink-2"
          }`}
        >
          {chip}
        </span>
      </span>
      <span className="font-serif text-[26px] leading-tight">{title}</span>
      <span className="text-[15px] leading-relaxed text-ink-2">{body}</span>
      <span className="text-[13px] text-ink-3">{meta}</span>
    </button>
  )
}

export default function StepChoosePath({ firstName, onChoose, sampleAvailable }: StepChoosePathProps) {
  return (
    <div className="flex flex-col gap-10 px-6 py-16 sm:px-12 xl:px-[120px]">
      <div className="flex max-w-[760px] flex-col gap-2.5">
        <p className={ui.eyebrow}>{firstName ? `Welcome, ${firstName}` : "Welcome"}</p>
        <h1 className="font-serif text-[44px] font-normal leading-[1.1] text-ink">
          Foreglow needs one thing to start watching: who you buy from.
        </h1>
        <p className="text-[17px] leading-relaxed text-ink-2">Pick the fastest way in. You can add detail later.</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <OptionCard
          icon={<DocumentIcon />}
          chip="FASTEST · ABOUT 2 MIN"
          highlighted
          title="Upload the spreadsheet you already have"
          body="A supplier list, a purchase-order export or an inventory report. Messy column names are fine. You check what we found before anything is saved."
          meta="Excel or CSV · stays in your browser until you confirm"
          onClick={() => onChoose("import")}
          autoFocus
        />
        <OptionCard
          icon={<PencilIcon />}
          chip="ABOUT 4 MIN"
          title="Type in your key suppliers"
          body="Start with your top 3 to 5. Name, country and what they supply is enough to begin."
          meta="Best if you don't have a file handy"
          onClick={() => onChoose("manual")}
        />
        <OptionCard
          icon={<Logo size={36} showWordmark={false} />}
          chip="NO DATA NEEDED"
          title="Look around a sample company first"
          body="See Foreglow running for a mid-sized electronics importer with suppliers in Taiwan, Korea, China, Germany and Mexico."
          meta="Switch to your own data any time"
          onClick={() => onChoose("sample")}
          disabled={!sampleAvailable}
        />
      </div>

      {SETUP_CALL_URL && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-paper-raised px-6 py-5">
          <div className="flex flex-col gap-0.5">
            <p className="font-semibold text-ink">Rather have us do it?</p>
            <p className="text-sm text-ink-2">Send your file and book 15 minutes. We set up your account with you on the call.</p>
          </div>
          <a href={SETUP_CALL_URL} target="_blank" rel="noopener noreferrer" className={ui.btnSecondary}>
            Book a setup call
          </a>
        </div>
      )}
    </div>
  )
}
