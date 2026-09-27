// Regression cases for word-boundary matching in assignCategory and
// scoreSeverity. Every FAIL row here was verified as actually broken on
// 2026-09-26 before the fix.
const { assignCategory, scoreSeverity } = require("../.verify/fetchDisruptions.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log("-- assignCategory: 'port' must not match inside other words --");
check('"new tariff announced on imported goods"',
  assignCategory("new tariff announced on imported goods", ""), "Tariff");
// General, not Geopolitical: no geopolitical keyword is present (sanction,
// war, conflict, embargo are all absent). The bug being fixed is that "port"
// matched inside "export"; removing that leaves nothing to match.
check('"export controls tighten on semiconductors"',
  assignCategory("export controls tighten on semiconductors", ""), "General");
check('"reporter details new sanctions package"',
  assignCategory("reporter details new sanctions package", ""), "Geopolitical");
check('"transport costs rise after tariff hike"',
  assignCategory("transport costs rise after tariff hike", ""), "Tariff");

console.log("-- assignCategory: genuine matches still work --");
check('"port strike halts container terminal operations"',
  assignCategory("port strike halts container terminal operations", ""), "Port");
check('"dockworkers union announces walkout"',
  assignCategory("dockworkers union announces walkout", ""), "Port");

console.log("-- scoreSeverity: 'ban'/'halt' must not match inside other words --");
check('"Albania signs new trade agreement"',
  scoreSeverity("Albania signs new trade agreement"), 1);
check('"City approves asphalt resurfacing near freight corridor"',
  scoreSeverity("City approves asphalt resurfacing near freight corridor"), 1);
check('"Urban logistics hubs expand across Europe"',
  scoreSeverity("Urban logistics hubs expand across Europe"), 1);
check('"Lebanon reopens border crossing for humanitarian aid"',
  scoreSeverity("Lebanon reopens border crossing for humanitarian aid"), 1);
check('"Port of Rotterdam reports abandoned container backlog"',
  scoreSeverity("Port of Rotterdam reports abandoned container backlog"), 1);

console.log("-- scoreSeverity: genuine matches still work --");
check('"Port strike halts container terminal operations"',
  scoreSeverity("Port strike halts container terminal operations"), 3);
check('"Iceland whaling company shrugs off permanent ban"',
  scoreSeverity("Iceland whaling company shrugs off permanent ban"), 3);
check('"Shipping delays expected through October"',
  scoreSeverity("Shipping delays expected through October"), 2);

process.exit(failed ? 1 : 0);
