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
global.fetch = async (url) => {
  const u = String(url);
  if (mode === "all-down") throw new Error("network down");
  if (mode === "malformed") return { ok: true, status: 200, text: async () => "<rss><chan" };
  if (mode === "empty-success") {
    const isAtom = u.includes("maritime-executive");
    const titles = [REJECT_NO_DISRUPTION, REJECT_NO_DISRUPTION_2];
    return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
  }
  const isAtom = u.includes("maritime-executive");
  const titles = [ADMIT, REJECT_NO_CONTEXT, REJECT_NO_DISRUPTION];
  return { ok: true, status: 200, text: async () => (isAtom ? atomFeed(titles) : rssFeed(titles)) };
};

const { fetchTradeNews } = require("../.verify/fetchTradeNews.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

(async () => {
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
  const { fetchDisruptions } = require("../.verify/fetchDisruptions.js");
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
