// Pure-function cases for the two-gate admission filter and region inference.
// Headlines marked [real] were pulled from the live feeds on 2026-09-26.
const {
  TRADE_FEEDS,
  matchesDisruptionKeywords,
  inferRegionFromHeadline,
} = require("../.verify/tradeFeeds.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log("-- feed registry --");
check("six feeds registered", TRADE_FEEDS.length, 6);
check("every feed has a lastVerified date",
  TRADE_FEEDS.every(f => /^\d{4}-\d{2}-\d{2}$/.test(f.lastVerified)), true);
check("exactly one atom feed (Maritime Executive)",
  TRADE_FEEDS.filter(f => f.format === "atom").length, 1);

console.log("-- gate 1 AND gate 2 both required --");
check('[real] "Closure of Los Angeles harbor bridge looms amid elevated container dwells"',
  matchesDisruptionKeywords("Closure of Los Angeles harbor bridge looms amid elevated container dwells"), true);
check('[real] "US, China to extend trade war truce by 2 months"',
  matchesDisruptionKeywords("US, China to extend trade war truce by 2 months"), true);
check('[real] whaling ban has no supply-chain term',
  matchesDisruptionKeywords("Iceland's Last Whaling Company Shrugs Off Threat Of Permanent Ban"), false);
check('[real] "6 food manufacturers talk supply chain tactics" has no disruption term',
  matchesDisruptionKeywords("6 food manufacturers talk supply chain tactics"), false);
check('[real] "Lego to spend $400M to add warehouse space at Mexico plant"',
  matchesDisruptionKeywords("Lego to spend $400M to add warehouse space at Mexico plant"), false);

console.log("-- gate matching is leading-boundary, not substring --");
check('"Albania expands port terminal" (ban must not fire gate 1)',
  matchesDisruptionKeywords("Albania expands port terminal"), false);
check('inflections survive: "New tariffs hit container shipments"',
  matchesDisruptionKeywords("New tariffs hit container shipments"), true);
check('inflections survive: "Port closures announced across shipping lanes"',
  matchesDisruptionKeywords("Port closures announced across shipping lanes"), true);

console.log("-- region inference --");
check('"Port of Rotterdam congestion worsens"',
  inferRegionFromHeadline("Port of Rotterdam congestion worsens"), "Europe");
check('"Shanghai port closure disrupts exports"',
  inferRegionFromHeadline("Shanghai port closure disrupts exports"), "Asia Pacific");
check('"Long Beach terminal backlog grows"',
  inferRegionFromHeadline("Long Beach terminal backlog grows"), "North America");
check('"Suez Canal transit delays continue"',
  inferRegionFromHeadline("Suez Canal transit delays continue"), "Middle East");
check('"Brazil port strike halts grain shipments"',
  inferRegionFromHeadline("Brazil port strike halts grain shipments"), "Latin America");
check("no recognisable place -> Unknown",
  inferRegionFromHeadline("Carrier rates soften amid weak demand"), "Unknown");
check('[real] first match in reading order wins ("US, China...")',
  inferRegionFromHeadline("US, China to extend trade war truce by 2 months"), "North America");

console.log("-- \"u.s.\" region hint matches despite trailing punctuation (finding 2) --");
check('"U.S. tariffs hit container shipments"',
  inferRegionFromHeadline("U.S. tariffs hit container shipments"), "North America");
check('"U.S.-China trade war halts cargo" (first match in reading order)',
  inferRegionFromHeadline("U.S.-China trade war halts cargo"), "North America");
check('"US tariffs hit container shipments"',
  inferRegionFromHeadline("US tariffs hit container shipments"), "North America");
check('"Using rail to bypass congestion" must NOT match the "us" hint',
  inferRegionFromHeadline("Using rail to bypass congestion"), "Unknown");
check('"Port of Rotterdam congestion worsens" unchanged',
  inferRegionFromHeadline("Port of Rotterdam congestion worsens"), "Europe");

console.log("-- demonyms missing from HEADLINE_REGION_HINTS (finding 3) --");
check('[real] "German dockworkers weigh strike action amid port congestion"',
  inferRegionFromHeadline("German dockworkers weigh strike action amid port congestion"), "Europe");
check('[real] "Canadian legislation creates new path to limit freight disruption"',
  inferRegionFromHeadline("Canadian legislation creates new path to limit freight disruption"), "North America");

process.exit(failed ? 1 : 0);
