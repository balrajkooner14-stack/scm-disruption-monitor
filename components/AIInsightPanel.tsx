"use client"

import { useEffect, useState } from "react"
import { useCompanyProfile } from "@/hooks/useCompanyProfile"
import { ui } from "@/lib/ui"

interface AIInsightPanelProps {
  headlines: string[]
  onSummaryLoaded?: (points: string[]) => void
  onStatusChange?: (status: "live" | "cached" | "error") => void
  /** Events matching the profile — drives the computed headline. */
  relevantCount?: number
  /** Severity-3 events today. */
  criticalCount?: number
  /** All events monitored today (headline when there is no profile). */
  totalCount?: number
}

type Status = "loading" | "success" | "error"

// The API returns "Title: body text" strings. Split on the first ": " when
// the part before it is short enough to be a title; otherwise it's all body.
// Display only — onSummaryLoaded still receives the original strings.
function splitPoint(point: string): { title: string | null; body: string } {
  const clean = point.replace(/^[•\-\s]+/, "")
  const idx = clean.indexOf(": ")
  if (idx > 0 && idx <= 80) {
    return { title: clean.slice(0, idx), body: clean.slice(idx + 2) }
  }
  return { title: null, body: clean }
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many
}

export default function AIInsightPanel({
  headlines,
  onSummaryLoaded,
  onStatusChange,
  relevantCount = 0,
  criticalCount = 0,
  totalCount = 0,
}: AIInsightPanelProps) {
  const [summary, setSummary] = useState<string[]>([])
  const [status, setStatus] = useState<Status>("loading")
  const [isStale, setIsStale] = useState(false)
  const { profile, isLoaded } = useCompanyProfile()

  useEffect(() => {
    if (!isLoaded) return

    const fetchSummary = async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ headlines, profile }),
        })

        if (!res.ok) {
          setStatus("error")
          onStatusChange?.("error")
          return
        }

        const data = await res.json()

        if (data.summary && data.summary.length > 0) {
          setSummary(data.summary)
          setIsStale(!!data.isStale)
          setStatus("success")
          onSummaryLoaded?.(data.summary)
          onStatusChange?.(data.isStale ? "cached" : "live")
        } else {
          setStatus("error")
          onStatusChange?.("error")
        }
      } catch {
        setStatus("error")
        onStatusChange?.("error")
      }
    }

    if (headlines.length > 0) {
      fetchSummary()
    } else {
      setStatus("error")
      onStatusChange?.("error")
    }
  // Re-fetch when profile loads — profile changes the prompt
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, profile?.updatedAt])

  // Computed, not AI-written.
  const firstSentence = profile
    ? `${relevantCount} ${plural(relevantCount, "event touches", "events touch")} ${profile.companyName} today.`
    : `${totalCount} ${plural(totalCount, "event", "events")} monitored today.`
  const secondSentence =
    criticalCount === 0
      ? "None are critical."
      : `${criticalCount} ${plural(criticalCount, "is", "are")} critical.`

  // Only rendered after the client fetch resolves, so the date never comes
  // from the prerendered HTML (no hydration mismatch).
  const dateLabel = new Date().toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })

  if (status === "loading") {
    return (
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-7 border-b border-line" aria-busy="true">
        <div className="lg:col-span-4 space-y-3">
          <p className={ui.eyebrow}>Today&apos;s brief</p>
          <div className={`${ui.skeleton} h-10 w-full`} />
          <p className={ui.meta}>Analyzing today&apos;s signals…</p>
        </div>
        <div className="lg:col-start-6 lg:col-span-7 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`${ui.skeleton} h-4`} style={{ width: `${70 + i * 10}%` }} />
          ))}
        </div>
      </section>
    )
  }

  if (status === "error") {
    return (
      <div className={ui.card}>
        <p className={ui.meta}>
          AI analysis unavailable — add your free Gemini API key at{" "}
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-ember underline"
          >
            aistudio.google.com
          </a>
        </p>
      </div>
    )
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-7 border-b border-line">
      <div className="lg:col-span-4 flex flex-col gap-2.5">
        <p className={ui.eyebrow}>Today&apos;s brief · {dateLabel}</p>
        <h1 className="font-serif text-[40px] leading-[1.1] font-normal text-ink">
          {firstSentence} {secondSentence}
        </h1>
        <p className={ui.meta}>
          AI summary · refreshes every 15 min · verify before acting
          {isStale && " · showing cached analysis"}
        </p>
      </div>
      <ol className="lg:col-start-6 lg:col-span-7 flex flex-col gap-4">
        {summary.map((point, i) => {
          const { title, body } = splitPoint(point)
          return (
            <li key={i} className="flex gap-4">
              <span className="font-serif text-xl text-ember w-6 flex-shrink-0">{i + 1}</span>
              <div className="flex flex-col gap-1">
                {title && <p className="text-base font-semibold text-ink">{title}</p>}
                <p className={ui.body}>{body}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
