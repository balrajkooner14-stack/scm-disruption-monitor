// Shared page footer. GDELT attribution is a licence requirement — keep it.
export default function SiteFooter() {
  return (
    <footer className="bg-paper-raised border-t border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 flex flex-col sm:flex-row justify-between gap-2 text-[13px] text-ink-3">
        <p>
          News data from the{" "}
          <a
            href="https://www.gdeltproject.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-ember"
          >
            GDELT Project
          </a>
          , GDACS and NOAA. AI analysis by Google Gemini. Verify before acting.
        </p>
        <p>Not financial advice</p>
      </div>
    </footer>
  )
}
