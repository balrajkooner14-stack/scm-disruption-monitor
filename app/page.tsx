import { Metadata } from "next"
import { Suspense } from "react"
import Navbar from "@/components/Navbar"
import DashboardClient from "@/components/DashboardClient"
import { fetchDisruptions } from "@/lib/fetchDisruptions"

export const metadata: Metadata = {
  title: "SCM Disruption Monitor | Live Supply Chain Risk Feed",
  description: "Real-time supply chain disruption monitoring powered by GDELT and Gemini AI",
}

export default async function Home() {
  const events = await fetchDisruptions()

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <Suspense>
          <DashboardClient events={events} />
        </Suspense>
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
