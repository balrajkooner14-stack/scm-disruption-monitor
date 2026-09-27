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

let mode = "ok";
global.fetch = async (url) => {
  const u = String(url);
  if (mode === "all-down") throw new Error("network down");
  if (mode === "malformed") return { ok: true, status: 200, text: async () => "<rss><chan" };
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

  console.log("-- cap is enforced --");
  clockOffset += 60 * 1000;
  mode = "ok";
  global.fetch = async () => ({
    ok: true, status: 200,
    text: async () => rssFeed(Array.from({ length: 40 }, () => ADMIT)),
  });
  events = await fetchTradeNews();
  check("total capped at 30", events.length, 30);

  process.exit(failed ? 1 : 0);
})();
