import type { Metadata } from "next"
import AuthScreen from "@/components/auth/AuthScreen"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

// Same 30-minute ISR window as the dashboard: the live panel shows today's
// real events, and fetchDisruptions' 5-minute memo shares one fetch between
// pages regenerating together.
export const revalidate = 1800

export const metadata: Metadata = { title: "Create your account" }

export default async function SignupPage() {
  const events = await fetchDisruptions()
  return <AuthScreen mode="signup" events={events} />
}
