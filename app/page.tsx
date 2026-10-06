import { Metadata } from "next"
import { Suspense } from "react"
import Navbar from "@/components/Navbar"
import SiteFooter from "@/components/SiteFooter"
import DashboardClient from "@/components/DashboardClient"
import { BRAND } from "@/lib/brand"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

// ISR: re-fetch disruptions every 30 minutes instead of once per deploy.
// GDELT's free API throttles datacenter IPs hard (often 0 of 3 queries
// succeed in a given window), and with a purely static build that one
// unlucky window froze a weather-only feed in place until the next deploy —
// observed live for 42 days. Regenerating on a schedule means a bad window
// costs 30 minutes instead of days. Paired with the per-query last-good
// cache in lib/fetchDisruptions.ts, which covers the gaps in between.
export const revalidate = 1800

export const metadata: Metadata = {
  // absolute: the home page carries its own full title, never the template.
  title: { absolute: `${BRAND.name} | ${BRAND.descriptor}` },
  description: BRAND.description,
}

export default async function Home() {
  const events = await fetchDisruptions()

  return (
    <main className="min-h-screen bg-paper">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 space-y-7">
        <Suspense>
          <DashboardClient events={events} />
        </Suspense>
      </div>
      <SiteFooter />
    </main>
  )
}
