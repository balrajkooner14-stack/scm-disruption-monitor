import Logo from "@/components/ui/Logo"
import HorizonProgress from "@/components/onboarding/HorizonProgress"

// Shared onboarding header (spec 6.0): logo · horizon progress · time left and
// "Save and finish later". The choose-path screen shows only the logo and who
// is signed in.

const MANUAL_STOPS = [20, 200, 380, 540]
const IMPORT_STOPS = [20, 280, 540]

interface StepsHeaderProps {
  variant: "steps"
  labels: string[]
  currentIndex: number
  timeLeft: string
  onSaveLater: () => void
  saving?: boolean
}

interface PathHeaderProps {
  variant: "path"
  email?: string | null
}

export default function OnboardingHeader(props: StepsHeaderProps | PathHeaderProps) {
  if (props.variant === "path") {
    return (
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-paper-raised px-6 sm:px-12">
        <Logo size={26} />
        {props.email && <p className="text-[13px] text-ink-3">Signed in as {props.email}</p>}
      </header>
    )
  }

  const xs = props.labels.length === 3 ? IMPORT_STOPS : MANUAL_STOPS
  const stops = props.labels.map((label, i) => ({ x: xs[i], label }))
  return (
    <header className="grid h-[72px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-line bg-paper-raised px-6 sm:px-12">
      <Logo size={26} />
      <HorizonProgress
        lineStart={20}
        lineEnd={540}
        stops={stops}
        currentIndex={props.currentIndex}
        ariaLabel={`Step ${props.currentIndex + 1} of ${props.labels.length}: ${props.labels[props.currentIndex]}`}
        className="hidden md:block"
      />
      <div className="flex items-center justify-end gap-[18px] text-[13px] text-ink-3">
        <span>{props.timeLeft}</span>
        <button
          type="button"
          onClick={props.onSaveLater}
          disabled={props.saving}
          className="text-ember transition-colors hover:text-ember-deep disabled:opacity-50"
        >
          {props.saving ? "Saving…" : "Save and finish later"}
        </button>
      </div>
    </header>
  )
}
