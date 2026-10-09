import type { Metadata } from "next"
import OnboardingFlow from "@/components/onboarding/OnboardingFlow"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

// Today's real events feed every live right-hand panel in the flow. Same
// 30-minute ISR window as the dashboard and sign-in pages.
export const revalidate = 1800

export const metadata: Metadata = { title: "Set up" }

export default async function OnboardingPage() {
  const events = await fetchDisruptions()
  return <OnboardingFlow events={events} />
}
