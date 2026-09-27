import Navbar from "@/components/Navbar"
import ScenarioPageClient from "@/components/ScenarioPageClient"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

// ISR: re-fetch disruptions every 30 minutes instead of once per deploy.
// GDELT's free API throttles datacenter IPs hard (often 0 of 3 queries
// succeed in a given window), and with a purely static build that one
// unlucky window froze a weather-only feed in place until the next deploy —
// observed live for 42 days. Regenerating on a schedule means a bad window
// costs 30 minutes instead of days. Paired with the per-query last-good
// cache in lib/fetchDisruptions.ts, which covers the gaps in between.
export const revalidate = 1800

export const metadata = {
  title: "Scenario Planner | SCM Disruption Monitor",
  description: "Model disruption scenarios against your supply chain and get AI-powered impact analysis.",
}

export default async function ScenariosPage() {
  const events = await fetchDisruptions()

  return (
    <main className="min-h-screen bg-slate-900">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">
            Scenario Planner
          </h1>
          <p className="text-slate-400 text-sm">
            Model disruption scenarios against your supply chain.
            Get AI-powered impact analysis and recovery recommendations
            specific to your company profile and inventory position.
          </p>
        </div>
        <ScenarioPageClient events={events} />
      </div>
    </main>
  )
}
