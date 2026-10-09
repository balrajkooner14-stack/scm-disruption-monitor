import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase-server"
import { postAuthPath, safeNextPath } from "@/lib/authRouting"

export const dynamic = "force-dynamic"

// OAuth (Google, Microsoft) and password-recovery links land here with a PKCE
// code. Exchange it for a session cookie, then route (spec 5.4).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"))

  // Behind Vercel the request URL's origin can be the internal host; the
  // forwarded host is what the browser actually used. Take the scheme from
  // x-forwarded-proto too: `next start` on localhost sets the forwarded host
  // over plain http, and assuming https there breaks the redirect.
  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const isLocal = process.env.NODE_ENV === "development"
  const base = !isLocal && forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin

  if (!code) {
    return NextResponse.redirect(`${base}/auth/error`)
  }

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${base}/auth/error`)
  }

  const destination = next ?? (await postAuthPath(supabase, data.user.id))
  return NextResponse.redirect(`${base}${destination}`)
}
