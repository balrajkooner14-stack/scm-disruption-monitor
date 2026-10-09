import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// getAll/setAll, not the deprecated get/set/remove: the per-cookie methods
// miss chunked-session edge cases and are slated for removal in @supabase/ssr.
export function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co"
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-key"
  const cookieStore = cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // Server components can't set cookies; route handlers and server
        // actions can. Middleware refreshes the session either way.
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}
