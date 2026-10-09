// Pure onboarding helpers (lib/onboardingInsights.ts and friends). Each case
// pins a rule from the v5.1 spec; nothing here touches the network.
const { pickHeadlineEvents } = require("../.verify/onboardingInsights.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const ev = (id, category, severity, date) =>
  ({ id, title: id, url: "", date, sourceDomain: "x", sourceCountry: "", category, severity, region: "Asia Pacific" });

console.log("-- pickHeadlineEvents: distinct categories, highest severity first --");
const mixed = [
  ev("port-2", "Port", 2, "2026-10-08T00:00:00Z"),
  ev("port-3", "Port", 3, "2026-10-07T00:00:00Z"),
  ev("labor-3", "Labor", 3, "2026-10-06T00:00:00Z"),
  ev("weather-2", "Weather", 2, "2026-10-08T00:00:00Z"),
  ev("tariff-1", "Tariff", 1, "2026-10-08T00:00:00Z"),
];
check("one per category, severity then date", pickHeadlineEvents(mixed).map(e => e.id), ["port-3", "labor-3", "weather-2"]);

console.log("-- pickHeadlineEvents: same severity breaks ties on newest --");
const ties = [
  ev("old", "Port", 3, "2026-10-01T00:00:00Z"),
  ev("new", "Port", 3, "2026-10-08T00:00:00Z"),
];
check("newest wins within a category", pickHeadlineEvents(ties, 1).map(e => e.id), ["new"]);

console.log("-- pickHeadlineEvents: fewer than 3 categories falls back to highest severity overall --");
const oneCategory = [
  ev("w1", "Weather", 1, "2026-10-08T00:00:00Z"),
  ev("w3", "Weather", 3, "2026-10-08T00:00:00Z"),
  ev("w2", "Weather", 2, "2026-10-08T00:00:00Z"),
  ev("w2b", "Weather", 2, "2026-10-07T00:00:00Z"),
];
check("fills from remaining by severity", pickHeadlineEvents(oneCategory).map(e => e.id), ["w3", "w2", "w2b"]);
check("no events -> empty", pickHeadlineEvents([]), []);
check("does not mutate input order", oneCategory.map(e => e.id), ["w1", "w3", "w2", "w2b"]);

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all passed");
