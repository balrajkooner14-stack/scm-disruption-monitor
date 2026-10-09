import type { Metadata } from "next"
import AuthScreen from "@/components/auth/AuthScreen"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

// See app/signup/page.tsx for the revalidate rationale.
export const revalidate = 1800

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage() {
  const events = await fetchDisruptions()
  return <AuthScreen mode="login" events={events} />
}
