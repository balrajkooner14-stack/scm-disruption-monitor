import type { CompanyProfile } from "./profile"
import type { OnboardingExtras } from "./onboarding"

// Guest → account carry-over (v5.1). When someone signs in to an account
// with no profile and this browser holds a profile they built as a guest,
// offer once to bring it over. Never automatic, never onto an account that
// already has a profile. Pure: the hook passes in what it read from storage.

export const CARRYOVER_DISMISSED_PREFIX = "scm_carryover_dismissed_"

export interface CarryOverInput {
  signedIn: boolean
  accountHasProfile: boolean
  /** Raw scm_company_profile value. */
  guestProfileRaw: string | null
  /** Raw scm_onboarding value. */
  guestExtrasRaw: string | null
  /**
   * Raw values of every scm_profile_<userId> key. A signed-in save also
   * writes scm_company_profile, so a copy that matches one of these is an
   * account's cache (e.g. a session that expired without sign-out), not
   * guest work, and must never be offered to a different account.
   */
  accountCachesRaw: string[]
  /** "Start fresh" was chosen for this account on this browser. */
  dismissed: boolean
}

export type CarryOverDecision =
  | { kind: "none" }
  | { kind: "prompt"; companyName: string; profile: CompanyProfile; extras: OnboardingExtras | null }

function parse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function sameProfile(a: CompanyProfile, b: Partial<CompanyProfile> | null): boolean {
  return !!b && a.companyName === b.companyName && a.createdAt === b.createdAt
}

export function decideCarryOver(input: CarryOverInput): CarryOverDecision {
  if (!input.signedIn || input.accountHasProfile || input.dismissed) return { kind: "none" }
  const profile = parse<CompanyProfile>(input.guestProfileRaw)
  if (!profile || !profile.companyName?.trim() || !Array.isArray(profile.suppliers)) return { kind: "none" }
  if (input.accountCachesRaw.some(raw => sameProfile(profile, parse<CompanyProfile>(raw)))) return { kind: "none" }
  const extras = parse<OnboardingExtras>(input.guestExtrasRaw)
  return { kind: "prompt", companyName: profile.companyName, profile, extras: extras && extras.version === 1 ? extras : null }
}
