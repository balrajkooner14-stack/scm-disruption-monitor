import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Safe fallback during build/prerender when env vars aren't available
  return createBrowserClient(
    url ?? "https://placeholder.supabase.co",
    key ?? "placeholder-key"
  )
}
