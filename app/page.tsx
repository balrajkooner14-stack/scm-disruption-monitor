import { Metadata } from "next"
import Navbar from "@/components/Navbar"
import KPIBar from "@/components/KPIBar"
import WorldMap from "@/components/WorldMap"
import DisruptionFeed from "@/components/DisruptionFeed"
import AIInsightPanel from "@/components/AIInsightPanel"
import CategoryChart from "@/components/CategoryChart"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

export const metadata: Metadata = {
  title: "SCM Disruption Monitor | Live Supply Chain Risk Feed",
  description: "Real-time supply chain disruption monitoring powered by GDELT and Gemini AI",
}

export default async function Home() {
  const events = await fetchDisruptions()
  const top5Headlines = events.slice(0, 5).map((e) => e.title)

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <AIInsightPanel headlines={top5Headlines} />
        <KPIBar events={events} />
        <CategoryChart events={events} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WorldMap events={events} />
          <DisruptionFeed events={events} />
        </div>
      </div>
      <footer className="text-center text-xs text-gray-400 py-6 border-t border-gray-200 dark:border-slate-700 mt-6">
        Data: GDELT Project · AI: Google Gemini · Built with Next.js + Vercel
      </footer>
    </main>
  )
}
