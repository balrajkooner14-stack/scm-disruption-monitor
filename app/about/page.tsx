import Navbar from "@/components/Navbar"

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            About SCM Disruption Monitor
          </h1>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            This project aggregates global supply chain disruption signals in real time,
            helping logistics and procurement teams surface critical risks before they
            impact operations. Built as a portfolio project combining Supply Chain
            Management domain expertise with modern full-stack development and AI integration.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Data Sources
          </h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            News data comes from the{" "}
            <a
              href="https://www.gdeltproject.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GDELT Project
            </a>
            , which monitors 4,500+ news sources across 100+ languages, updated every
            15 minutes. The GDELT DOC 2.0 API is completely free with no API key required.
            AI summaries are generated using Google Gemini 2.5 Flash via the free tier
            at{" "}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Severity Methodology
          </h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 dark:bg-slate-800">
                <tr>
                  <th className="text-left p-3 text-gray-700 dark:text-gray-300">Level</th>
                  <th className="text-left p-3 text-gray-700 dark:text-gray-300">Score</th>
                  <th className="text-left p-3 text-gray-700 dark:text-gray-300">Keywords</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                <tr className="bg-white dark:bg-slate-900">
                  <td className="p-3 font-semibold text-red-600">Critical</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">3</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    strike, closure, sanctions, blocked, halt, shutdown, ban
                  </td>
                </tr>
                <tr className="bg-white dark:bg-slate-900">
                  <td className="p-3 font-semibold text-amber-600">Warning</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">2</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    delay, shortage, disruption, tariff, congestion, reduced
                  </td>
                </tr>
                <tr className="bg-white dark:bg-slate-900">
                  <td className="p-3 font-semibold text-green-600">Monitor</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">1</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">
                    All other events
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Tech Stack
          </h2>
          <div className="rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {[
                  ["Framework", "Next.js 14 (App Router, TypeScript)"],
                  ["Styling", "Tailwind CSS"],
                  ["Map", "react-simple-maps"],
                  ["News data", "GDELT DOC 2.0 API (free, no key needed)"],
                  ["AI summary", "Google Gemini 2.5 Flash (free tier)"],
                  ["Hosting", "Vercel (free Hobby tier)"],
                ].map(([layer, tech]) => (
                  <tr key={layer} className="bg-white dark:bg-slate-900">
                    <td className="p-3 font-medium text-gray-700 dark:text-gray-300 w-1/3">
                      {layer}
                    </td>
                    <td className="p-3 text-gray-600 dark:text-gray-400">{tech}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Built by
          </h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            This project was built as a portfolio piece for supply chain and data analyst
            roles, combining an MSc in Supply Chain Management with systematic trading
            and quantitative analysis skills. The app demonstrates real-world API
            integration, AI tooling, and domain knowledge applied to a genuine business
            problem faced by logistics and procurement teams daily.
          </p>
        </div>

      </div>
    </main>
  )
}
