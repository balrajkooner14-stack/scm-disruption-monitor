"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/hooks/useAuth"
import { HistoryEntry } from "@/lib/disruptionHistory"
import type { ScoredEvent } from "@/lib/scoreEvents"

const STORAGE_KEY = "scm_disruption_history"
const MAX_ENTRIES = 500
const RETENTION_DAYS = 90

function loadLocalHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const entries: HistoryEntry[] = JSON.parse(raw)
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    return entries
      .filter(e => new Date(e.savedAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  } catch {
    return []
  }
}

function saveLocalHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {}
}

function rowToEntry(row: {
  event_id: string
  title: string | null
  category: string | null
  region: string | null
  severity: number | null
  severity_label: string | null
  source_domain: string | null
  event_url: string | null
  is_profile_match: boolean | null
  relevance_score: number | null
  relevance_reason: string | null
  saved_at: string | null
  date: string | null
}): HistoryEntry {
  return {
    id: row.event_id,
    title: row.title ?? "",
    category: row.category ?? "",
    region: row.region ?? "",
    severity: row.severity ?? 1,
    severityLabel: row.severity_label ?? "MONITOR",
    sourceDomain: row.source_domain ?? "",
    eventUrl: row.event_url ?? "",
    isProfileMatch: row.is_profile_match ?? false,
    relevanceScore: row.relevance_score ?? 0,
    relevanceReason: row.relevance_reason ?? "",
    savedAt: row.saved_at ?? new Date().toISOString(),
    date: row.date ?? "",
  }
}

function entryToRow(entry: HistoryEntry, userId: string) {
  return {
    user_id: userId,
    event_id: entry.id,
    title: entry.title,
    category: entry.category,
    region: entry.region,
    severity: entry.severity,
    severity_label: entry.severityLabel,
    source_domain: entry.sourceDomain,
    event_url: entry.eventUrl,
    is_profile_match: entry.isProfileMatch,
    relevance_score: entry.relevanceScore,
    relevance_reason: entry.relevanceReason,
    saved_at: entry.savedAt,
    date: entry.date,
  }
}

export function useDisruptionHistory() {
  const { user, isLoading: authLoading } = useAuth()
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false

    async function load() {
      if (user) {
        try {
          const cutoffIso = new Date(
            Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
          ).toISOString()
          const { data, error } = await supabase
            .from("disruption_history")
            .select("*")
            .eq("user_id", user.id)
            .gt("saved_at", cutoffIso)
            .order("saved_at", { ascending: false })
            .limit(MAX_ENTRIES)

          if (error) throw error

          // First-login migration: bulk-copy any existing guest data once.
          if ((data?.length ?? 0) === 0) {
            const local = loadLocalHistory()
            if (local.length > 0) {
              const rows = local.map(e => entryToRow(e, user.id))
              const { error: migrateError } = await supabase
                .from("disruption_history")
                .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true })
              if (!migrateError) {
                localStorage.removeItem(STORAGE_KEY)
                if (!cancelled) setEntries(local)
                if (!cancelled) setIsLoaded(true)
                return
              }
            }
          }

          if (!cancelled) setEntries((data ?? []).map(rowToEntry))
        } catch {
          if (!cancelled) setEntries([])
        }
      } else {
        setEntries(loadLocalHistory())
      }
      if (!cancelled) setIsLoaded(true)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user, authLoading, supabase])

  const saveEvents = useCallback(
    async (events: ScoredEvent[]): Promise<void> => {
      const existingIds = new Set(entries.map(e => e.id))
      const toSave = events.filter(e => e.severity >= 2 || e.isProfileMatch)

      const now = new Date()
      const dateStr = now.toISOString().split("T")[0]
      const savedAtStr = now.toISOString()

      const newEntries: HistoryEntry[] = []
      toSave.forEach(event => {
        const id = `${btoa(event.url).slice(0, 16)}-${dateStr}`
        if (existingIds.has(id)) return
        newEntries.push({
          id,
          title: event.title,
          category: event.category,
          region: event.region,
          severity: event.severity,
          severityLabel:
            event.severity === 3 ? "CRITICAL" : event.severity === 2 ? "WARNING" : "MONITOR",
          sourceDomain: event.sourceDomain ?? "",
          eventUrl: event.url,
          isProfileMatch: event.isProfileMatch,
          relevanceScore: event.relevanceScore,
          relevanceReason: event.relevanceReason ?? "",
          savedAt: savedAtStr,
          date: dateStr,
        })
      })

      if (newEntries.length === 0) return

      if (user) {
        try {
          const rows = newEntries.map(e => entryToRow(e, user.id))
          const { error } = await supabase
            .from("disruption_history")
            .upsert(rows, { onConflict: "user_id,event_id", ignoreDuplicates: true })
          if (error) return
        } catch {
          return
        }
        setEntries(prev => [...newEntries, ...prev].slice(0, MAX_ENTRIES))
      } else {
        setEntries(prev => {
          const merged = [...newEntries, ...prev].slice(0, MAX_ENTRIES)
          saveLocalHistory(merged)
          return merged
        })
      }
    },
    [user, supabase, entries]
  )

  const clear = useCallback(async (): Promise<void> => {
    if (user) {
      try {
        await supabase.from("disruption_history").delete().eq("user_id", user.id)
      } catch {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {}
    }
    setEntries([])
  }, [user, supabase])

  return { entries, isLoaded, saveEvents, clear }
}
