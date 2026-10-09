// Two-column body shared by every onboarding step (spec 6): form column on
// the left with its primary action pinned to the bottom, live panel on the
// right. Below 1024px the panel stacks under the form.

interface StepLayoutProps {
  /** "narrow" = 720px (Company step), "wide" = 760px (the rest). */
  formWidth?: "narrow" | "wide"
  form: React.ReactNode
  footer: React.ReactNode
  panel: React.ReactNode
  panelLabel: string
  onSubmit?: () => void
}

export default function StepLayout({ formWidth = "wide", form, footer, panel, panelLabel, onSubmit }: StepLayoutProps) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <form
        noValidate
        onSubmit={e => {
          e.preventDefault()
          onSubmit?.()
        }}
        className={`flex w-full shrink-0 flex-col gap-[18px] px-6 py-10 sm:px-16 ${
          formWidth === "narrow" ? "lg:w-[720px]" : "lg:w-[760px]"
        }`}
      >
        {form}
        {/* One row from sm up: the hint wraps inside its own space rather than
            pushing the primary action onto a second line (keeps it above the
            fold at 1280×800). */}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-4 sm:flex-nowrap [&>*:first-child]:min-w-0">
          {footer}
        </div>
      </form>
      <aside
        aria-label={panelLabel}
        className="flex flex-1 flex-col gap-5 border-t border-line bg-paper-raised px-6 py-10 sm:px-12 lg:border-l lg:border-t-0"
      >
        {panel}
      </aside>
    </div>
  )
}

/** Step title + sub-line, shared typography. */
export function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-serif text-[38px] font-normal leading-[1.12] text-ink">{title}</h1>
      <p className="text-base text-ink-2">{sub}</p>
    </div>
  )
}
