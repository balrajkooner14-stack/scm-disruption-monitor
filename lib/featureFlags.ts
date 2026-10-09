// Sanctions screening is name-only token matching against the OFAC SDN list — no
// alias, address or country cross-check — so it must not read as a compliance
// clearance while that's true. The route, lib/sanctionsScreening.ts and
// SanctionsScreeningCard.tsx are all kept intact; flip this to true to re-enable.
export const ENABLE_SANCTIONS_SCREENING: boolean = false

// Morning-email opt-in UI (first-light card, setup checklist item). Off until
// email sending exists; the preference is stored but nothing is sent.
export const ENABLE_EMAIL_BRIEF: boolean = false

// Invite-a-teammate checklist item. Off until team accounts exist.
export const ENABLE_TEAMS: boolean = false
