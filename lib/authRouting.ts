import type { SupabaseClient } from "@supabase/supabase-js"

// Post-auth routing, shared by app/auth/callback/route.ts (OAuth, recovery)
// and the client-side email-code verify, so the rule lives in one place.

// Only same-origin paths. "//evil.com" and "/\evil.com" are protocol-relative
// in browsers, so both are rejected along with anything not starting with "/".
export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith("/")) return null
  if (raw.startsWith("//") || raw.startsWith("/\\")) return null
  return raw
}

// Signed-in user with a saved profile row → dashboard; otherwise → onboarding.
// A profiles row only exists once a profile has been saved (no sign-up trigger).
export async function postAuthPath(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()
  // Lookup failed: the dashboard already copes with a missing profile (it
  // shows the setup prompt), so it's the safe place to land.
  if (error) return "/"
  return data ? "/" : "/onboarding"
}
