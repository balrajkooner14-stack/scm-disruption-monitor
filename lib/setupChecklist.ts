import type { CompanyProfile } from "./profile"
import type { OnboardingExtras } from "./onboarding"
import { findSinglePointsOfFailure } from "./supplyChainGraph"

// The dashboard "Sharpen your alerts" checklist (spec 8.1), as pure data.
// computeChecklist() evaluates every rule and marks each item done or open;
// the UI shows open items in this order (ordered by value).

export interface ChecklistFlags {
  emailBrief: boolean
  teams: boolean
}

export interface ChecklistItem {
  id: string
  title: string
  why: string
  time: string
  /** Link target; null for inline actions (email) or not-yet-built ones (invite). */
  href: string | null
  actionLabel: string
  done: boolean
}

export function computeChecklist(
  profile: CompanyProfile,
  extras: OnboardingExtras | null | undefined,
  flags: ChecklistFlags,
): ChecklistItem[] {
  const x = extras ?? { version: 1 as const }
  const items: ChecklistItem[] = []
  const productName = (id: string) => profile.productLines.find(p => p.id === id)?.name ?? "a product"

  items.push({
    id: "finish-onboarding",
    title: "Finish setting up",
    why: "You left setup part-way. Pick up where you stopped.",
    time: "2 min",
    href: "/onboarding",
    actionLabel: "Finish setup",
    done: !!x.completedAt || !extras, // profiles from before v5.1 never went through onboarding
  })

  if (profile.productLines.length > 0) {
    const spof = findSinglePointsOfFailure(profile).find(r => r.isSinglePointOfFailure)
    items.push({
      id: spof ? `backup:${spof.productLineId}` : "backup",
      title: spof ? `Name a backup for ${spof.productLineName}` : "Name backup suppliers",
      why: "It has one source. A backup lets us tell you when you can switch.",
      time: "1 min",
      href: "/profile?step=3",
      actionLabel: "Add backup",
      done: !spof,
    })

    const unknown = (x.inventoryUnknown ?? []).find(id => profile.productLines.some(p => p.id === id))
    items.push({
      id: unknown ? `stock:${unknown}` : "stock",
      title: unknown ? `Add stock levels for ${productName(unknown)}` : "Add stock levels",
      why: "Unlocks reorder warnings for this product.",
      time: "30 sec",
      href: "/profile?step=3",
      actionLabel: "Add stock",
      done: !unknown,
    })
  }

  if (profile.suppliers.length > 0) {
    const missingLead = (x.leadTimeUnknown ?? []).filter(id =>
      profile.suppliers.some(s => s.id === id && !(s.leadTimeDays > 0)),
    )
    items.push({
      id: "leadtimes",
      title: `Add lead times for ${missingLead.length} supplier${missingLead.length === 1 ? "" : "s"}`,
      why: "Lets us compare stock against how long a reorder takes.",
      time: "1 min",
      href: "/profile?step=2",
      actionLabel: "Add lead times",
      done: missingLead.length === 0,
    })

    const top = [...profile.suppliers].sort((a, b) => b.sharePercent - a.sharePercent)[0]
    items.push({
      id: "tier2",
      title: `Who supplies ${top.name}?`,
      why: "Most shocks start one tier down. Add a sub-supplier to see them.",
      time: "2 min",
      href: "/profile?step=2",
      actionLabel: "Add sub-supplier",
      done: (top.tier2Suppliers ?? []).length > 0,
    })
  }

  const defaulted = (x.reorderPointDefaulted ?? []).filter(id => profile.productLines.some(p => p.id === id))
  // Applies once onboarding recorded reorder defaults; /profile clears an id
  // when the user edits that product's inventory, which marks this done.
  if (x.reorderPointDefaulted !== undefined && profile.productLines.length > 0) {
    items.push({
      id: "reorder",
      title: "Check your reorder points",
      why: "We set them to each supplier's lead time. Adjust if you hold safety stock.",
      time: "1 min",
      href: "/profile?step=3",
      actionLabel: "Check reorder points",
      done: defaulted.length === 0,
    })
  }

  if (x.primaryMarketsDerived !== undefined) {
    items.push({
      id: "markets",
      title: "Confirm where you sell",
      why: `We assumed ${profile.primaryMarkets[0] ?? "your home region"} from your headquarters.`,
      time: "30 sec",
      href: "/profile?step=1",
      actionLabel: "Confirm markets",
      done: !x.primaryMarketsDerived,
    })
  }

  items.push({
    id: "painpoints",
    title: "Tell us what worries you most",
    why: "Sharpens which news we rank first.",
    time: "30 sec",
    href: "/profile?step=4",
    actionLabel: "Choose concerns",
    done: profile.painPoints.length > 0,
  })

  if (flags.emailBrief) {
    items.push({
      id: "email",
      title: "Turn on your morning brief",
      why: "One short email before your day starts.",
      time: "10 sec",
      href: null,
      actionLabel: "Turn on",
      done: x.morningEmail !== undefined,
    })
  }

  if (flags.teams) {
    items.push({
      id: "invite",
      title: "Invite a teammate",
      why: "Share alerts with whoever places the orders.",
      time: "30 sec",
      href: null,
      actionLabel: "Invite",
      done: false,
    })
  }

  return items
}

export function openItems(items: ChecklistItem[]): ChecklistItem[] {
  return items.filter(i => !i.done)
}

/**
 * "Setup is N% complete" on the finish screen: the onboarding sections
 * (company, suppliers, ports, products) plus every checklist item, counting
 * what's actually done. Honest by construction: nothing is pre-ticked.
 */
export function setupPercent(
  profile: CompanyProfile,
  extras: OnboardingExtras | null | undefined,
  items: ChecklistItem[],
): number {
  const sections = [
    profile.companyName.trim().length > 0,
    profile.suppliers.length > 0,
    (extras?.entryPorts ?? []).length > 0,
    profile.productLines.length > 0,
  ]
  const done = sections.filter(Boolean).length + items.filter(i => i.done).length
  const total = sections.length + items.length
  return total === 0 ? 0 : Math.round((100 * done) / total)
}

/** Progress for the checklist header: done = initial items no longer open. */
export function checklistProgress(
  items: ChecklistItem[],
  extras: OnboardingExtras | null | undefined,
): { done: number; total: number } {
  const open = new Set(openItems(items).map(i => i.id))
  const initial = extras?.checklistInitial
  if (!initial || initial.length === 0) return { done: 0, total: open.size }
  return { done: initial.filter(id => !open.has(id)).length, total: initial.length }
}
