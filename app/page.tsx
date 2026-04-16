import { Metadata } from "next"
import Navbar from "@/components/Navbar"
import AIInsightPanel from "@/components/AIInsightPanel"
import CategoryChart from "@/components/CategoryChart"
import DashboardClient from "@/components/DashboardClient"
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
        <CategoryChart events={events} />
        <DashboardClient events={events} />
      </div>
      <footer className="text-center py-6 border-t border-slate-800 mt-6">
        <p className="text-xs text-slate-600">
          SCM Disruption Monitor · Data: GDELT Project (gdeltproject.org) ·
          AI: Google Gemini 2.5 Flash · Built with Next.js + Vercel
        </p>
        <p className="text-xs text-slate-700 mt-1">
          Updates every page load · AI summary refreshes every 10 min ·
          Not financial advice
        </p>
      </footer>
    </main>
  )
}
