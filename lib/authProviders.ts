// Which sign-in options are shown. Each provider needs manual setup in Google
// Cloud / Microsoft Entra and Supabase first, so its button stays hidden until
// the matching env flag is set to "1" in Vercel.
export const AUTH = {
  google: process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1",
  microsoft: process.env.NEXT_PUBLIC_AUTH_MICROSOFT === "1",
  emailCode: true,
} as const

// Calendly/Cal.com link. Empty means every "Book a setup call" link is hidden.
export const SETUP_CALL_URL = process.env.NEXT_PUBLIC_SETUP_CALL_URL ?? ""
