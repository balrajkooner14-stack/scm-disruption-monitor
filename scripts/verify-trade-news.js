// Adapter behaviour with a stubbed network: RSS and Atom shapes, the
// admission filter, the round-robin cap, and the per-feed last-good cache.
const path = require("path");
const realDateNow = Date.now;
let clockOffset = 0;
Date.now = () => realDateNow.call(Date) + clockOffset;

function rssFeed(titles) {
  const items = titles.map((t, i) =>
    `<item><title>${t}</title><link>https://example.test/a${i}</link>` +
    `<pubDate>Fri, 26 Sep 2026 12:00:00 GMT</pubDate></item>`).join("");
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Chan</title>${items}</channel></rss>`;
}
function atomFeed(titles) {
  const entries = titles.map((t, i) =>
    `<entry><title>${t}</title><link href="https://atom.test/a${i}"/>` +
    `<updated>2026-09-26T12:00:00Z</updated></entry>`).join("");
  return `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Chan</title>${entries}</feed>`;
}

const ADMIT = "Port strike halts container terminal operations";
const REJECT_NO_CONTEXT = "Iceland whaling company shrugs off permanent ban";
const REJECT_NO_DISRUPTION = "6 food manufacturers talk supply chain tactics";
const REJECT_NO_DISRUPTION_2 = "Lego to spend $400M to add warehouse space at Mexico plant";

let mode = "ok";
const defaultModeFetch = async (url) => {
  const u = String(url);
  if (mode === "all-down") throw new Error("network down");
  if (mode === "malformed") return { ok: true, status: 200, text: async () => "<rss><chan" };
  if (mode === "html-page") {
    return {
      ok: true, status: 200,
      text: async () => "<html><head><title>Just a moment...</title></head><body>Checking your browser</body></html>",
    };
  }
  if (mode === "empty-success") {
    const isAtom = u.includes("maritime-executive");
    const titles = [REJECT_NO_DISRUPTION, REJECT_NO_DISRUPTION_2];
    return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
  }
  const isAtom = u.includes("maritime-executive");
  const titles = [ADMIT, REJECT_NO_CONTEXT, REJECT_NO_DISRUPTION];
  return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
};
global.fetch = defaultModeFetch;

const { fetchTradeNews } = require("../.verify/fetchTradeNews.js");
const { fetchDisruptions } = require("../.verify/fetchDisruptions.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

(async () => {
  console.log("-- NOAA alerts must survive cross-source dedup even though every alert shares the same placeholder url (finding 1) --");
  {
    // This must be fetchDisruptions()'s very first call in this process: both
    // its own GDELT last-good cache and fetchTradeNews's per-feed cache start
    // empty, so a thrown/quiet response here genuinely means zero events from
    // those sources rather than a fallback to a leftover cache from an earlier
    // test step below.
    const NOAA_IDS = ["noaa-test-1", "noaa-test-2", "noaa-test-3", "noaa-test-4", "noaa-test-5"];
    global.fetch = async (url) => {
      const u = String(url);
      if (u.includes("gdeltproject.org")) throw new Error("network down");
      if (u.includes("weather.gov")) {
        return {
          ok: true, status: 200,
          json: async () => ({
            features: NOAA_IDS.map((id) => ({
              properties: {
                id,
                areaDesc: "Test County, TX",
                event: "Flash Flood Warning",
                severity: "Severe",
                headline: `Flash Flood Warning issued for ${id}`,
                effective: "2026-09-26T12:00:00Z",
              },
            })),
          }),
        };
      }
      if (u.includes("gdacs.org")) return { ok: true, status: 200, json: async () => ({ features: [] }) };
      // Trade feeds: fetch succeeds, but nothing is admitted (no disruption
      // or supply-chain term in the headline) — genuinely zero contribution,
      // not a cache fallback, since this is the first call in the process.
      return {
        ok: true, status: 200,
        text: async () =>
          `<?xml version="1.0"?><rss version="2.0"><channel><title>Chan</title>` +
          `<item><title>Quarterly earnings beat expectations</title>` +
          `<link>https://example.test/quiet</link>` +
          `<pubDate>Fri, 26 Sep 2026 12:00:00 GMT</pubDate></item></channel></rss>`,
      };
    };

    const merged = await fetchDisruptions();
    const noaaEvents = merged.filter((e) => e.sourceDomain === "weather.gov");
    check("all 5 distinct NOAA alerts survive despite sharing one placeholder url",
      noaaEvents.length, 5);
    check("every surviving NOAA alert kept a distinct, source-prefixed id",
      new Set(noaaEvents.map((e) => e.id)).size, 5);
    check("GDELT and trade news contributed nothing in this scenario",
      merged.length, 5);
  }

  global.fetch = defaultModeFetch;
  console.log("-- healthy fetch, filter applied to both RSS and Atom --");
  let events = await fetchTradeNews();
  check("only the admitted headline survives, one per feed",
    events.length, 6);
  check("every event kept is the admitted one",
    events.every(e => e.title === ADMIT), true);
  check("Atom feed contributed",
    events.some(e => e.sourceDomain === "maritime-executive.com"), true);
  check("category assigned from title", events[0].category, "Port");
  check("severity assigned from title", events[0].severity, 3);
  check("ids are stable across fetches (no Date.now in id)",
    events[0].id, (await fetchTradeNews())[0].id);

  console.log("-- all feeds down: per-feed cache covers --");
  clockOffset += 60 * 1000;
  mode = "all-down";
  events = await fetchTradeNews();
  check("cached events still returned", events.length, 6);

  console.log("-- malformed XML must not wipe the cache --");
  clockOffset += 60 * 1000;
  mode = "malformed";
  events = await fetchTradeNews();
  check("cache survived malformed XML", events.length, 6);

  console.log("-- a 200 that is an HTML page (e.g. a Cloudflare interstitial), not a feed, must be treated as a failure, not an empty feed (finding 5) --");
  clockOffset += 60 * 1000;
  mode = "html-page";
  let capturedHtmlLog = "";
  const originalLogHtml = console.log;
  console.log = (msg) => { capturedHtmlLog = String(msg); };
  events = await fetchTradeNews();
  console.log = originalLogHtml;
  check("cache survived a 200 HTML-root response", events.length, 6);
  check("HTML-root response is NOT labelled empty",
    capturedHtmlLog.includes("6 empty"), false);
  check("HTML-root response is labelled cached (a fetch failure with cache fallback)",
    capturedHtmlLog.includes("6 cached"), true);

  console.log("-- healthy-but-empty (no admitted items) must not wipe the cache --");
  clockOffset += 60 * 1000;
  mode = "empty-success";
  let capturedLog = "";
  const originalLog = console.log;
  console.log = (msg) => { capturedLog = String(msg); };
  events = await fetchTradeNews();
  console.log = originalLog;
  check("cache survived a genuine 200 with zero admitted items", events.length, 6);
  check("empty label used, not cached label", capturedLog.includes("6 empty"), true);
  check("cached label not used for empty scenario", capturedLog.includes("6 cached"), false);

  console.log("-- cap is enforced --");
  clockOffset += 60 * 1000;
  mode = "ok";
  global.fetch = async () => ({
    ok: true, status: 200,
    text: async () => rssFeed(Array.from({ length: 40 }, () => ADMIT)),
  });
  events = await fetchTradeNews();
  check("total capped at 30", events.length, 30);

  console.log("-- round-robin fairness under asymmetric feed volumes --");
  // TRADE_FEEDS order: supplychaindive, freightwaves, maritime-executive,
  // gcaptain, splash247, joc. First feed gets 40 admitted items (mirroring
  // FreightWaves' real 56-vs-10 imbalance), the rest get 2 each. Naive
  // concatenation + a flat 30-slice would let the first feed alone consume
  // the whole cap; round-robin interleaving must not.
  clockOffset += 60 * 1000;
  global.fetch = async (url) => {
    const u = String(url);
    const isAtom = u.includes("maritime-executive");
    const isFirstFeed = u.includes("supplychaindive");
    const count = isFirstFeed ? 40 : 2;
    const titles = Array.from({ length: count }, () => ADMIT);
    return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
  };
  events = await fetchTradeNews();
  const domains = new Set(events.map((e) => e.sourceDomain));
  check("all six publishers represented despite one feed dominating volume",
    domains.size, 6);

  console.log("-- merged feed includes trade news and dedupes across sources --");
  // GDELT and GDACS/NOAA all fail; only trade news contributes. One trade-news
  // URL is also returned by GDELT, and must appear exactly once.
  const SHARED = "https://example.test/a0";
  global.fetch = async (url) => {
    const u = String(url);
    if (u.includes("gdeltproject.org")) {
      return { ok: true, status: 200, json: async () => ({ articles: [{
        url: SHARED, title: ADMIT, seendate: "20260926T120000Z",
        domain: "example.test", sourcecountry: "US" }] }) };
    }
    if (u.includes("gdacs.org") || u.includes("weather.gov")) {
      return { ok: true, status: 200, json: async () => ({ features: [] }) };
    }
    // Two items per feed: one sharing GDELT's URL (proves cross-source dedup)
    // and one unique (proves trade news actually reaches the merged feed).
    // With only the shared URL, GDELT is pushed first and every trade event
    // would be deduped away, making the second assertion unsatisfiable.
    const item = (link) =>
      `<item><title>${ADMIT}</title><link>${link}</link>` +
      `<pubDate>Fri, 26 Sep 2026 12:00:00 GMT</pubDate></item>`;
    const uniqueLink = `https://unique.test/${encodeURIComponent(u)}`;
    return { ok: true, status: 200, text: async () =>
      `<?xml version="1.0"?><rss version="2.0"><channel><title>Chan</title>` +
      `${item(SHARED)}${item(uniqueLink)}</channel></rss>` };
  };
  clockOffset += 10 * 60 * 1000; // past the 5-minute fetchDisruptions memo TTL
  const merged = await fetchDisruptions();
  check("shared URL appears exactly once across sources",
    merged.filter(e => e.url === SHARED).length, 1);
  check("trade-news events present in merged feed",
    merged.some(e => e.sourceDomain === "supplychaindive.com"), true);

  process.exit(failed ? 1 : 0);
})();
