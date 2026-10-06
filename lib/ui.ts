// First Light class recipes. Import these instead of retyping long class
// lists so every component stays consistent. tailwind.config.ts scans lib/
// so classes that only appear here are not purged.
export const ui = {
  // surfaces
  card: "bg-paper-raised border border-line rounded-xl p-6",
  cardInner: "bg-surface border border-line-soft rounded-[10px] p-4",
  divider: "border-t border-line-soft",

  // type
  eyebrow: "text-xs font-semibold uppercase tracking-[0.14em] text-ink-3",
  h1: "font-serif text-4xl font-normal text-ink",
  h2: "font-serif text-[26px] leading-tight font-medium text-ink",
  h3: "font-serif text-xl font-medium text-ink",
  body: "text-[15px] leading-relaxed text-ink-2",
  meta: "text-[13px] text-ink-3",
  stat: "font-serif text-[44px] leading-none text-ink",

  // buttons (min height 36px; 44px for the main action on a page)
  btnPrimary:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-2 disabled:opacity-50",
  btnAccent:
    "inline-flex items-center justify-center gap-2 rounded-lg bg-ember px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-ember-deep disabled:opacity-50",
  btnSecondary:
    "inline-flex items-center justify-center gap-2 rounded-lg border border-line-strong bg-transparent px-3.5 py-2 text-sm text-ink transition-colors hover:border-ink disabled:opacity-50",
  btnGhost:
    "inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-ember transition-colors hover:text-ember-deep",

  // forms
  label: "text-[13px] font-semibold text-ink",
  input:
    "w-full rounded-lg border border-line-control bg-surface px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:border-ink focus:outline-none",
  help: "text-xs text-ink-3",

  // chips
  chip: "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
  chipCritical: "bg-ember text-white",
  chipWarning: "bg-ochre-tint text-ochre",
  chipMonitor: "bg-sea-tint text-sea-deep",
  chipPositive: "bg-moss-tint text-moss-deep",
  chipNeutral: "bg-line-soft text-ink-2",
  chipAi: "bg-ai-tint text-ai",

  // filter pills
  pill: "rounded-full border border-line px-3 py-1 text-[13px] text-ink transition-colors hover:border-ink",
  pillActive: "rounded-full border border-ink bg-ink px-3 py-1 text-[13px] text-paper",

  // feedback
  skeleton: "animate-pulse rounded bg-paper-sunk",
  errorBox: "rounded-lg border border-ember-line bg-ember-tint p-3 text-[13px] text-ember-deep",
  emptyText: "text-[13px] text-ink-3",
} as const
