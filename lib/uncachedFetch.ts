// fetch() for the external news/alert sources, bypassing Next's Data Cache.
//
// In server code Next 14 patches fetch() and stores responses in its Data
// Cache. Once an entry is stale, a later render serves the old copy and
// re-fetches in the background — outside the caller's try/catch — and adds
// that promise to the response's waitUntil. A timeout there surfaced as
// "fetch failed" → "failed to pipe response" (a 500) instead of the source's
// own fallback. Each source already has its own caching (per-query/per-feed
// last-good caches, the 5-minute memo in fetchDisruptions, ISR), so none of
// them needs the Data Cache.
//
// Not `cache: "no-store"`: that sets revalidate 0 and turns the ISR pages
// dynamic. Next keeps the unpatched fetch as fetch._nextOriginalFetch; outside
// Next (verify harnesses) or if a future Next drops it, this is plain fetch().
// Resolved on every call, because the harnesses swap global.fetch per case.
export function uncachedFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  const patched = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch }
  return (patched._nextOriginalFetch ?? patched)(input, init)
}
