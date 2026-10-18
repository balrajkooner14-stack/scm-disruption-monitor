// Pure onboarding helpers (lib/onboarding*.ts, countries, ports, textMatch).
// Each case pins a rule from the v5.1 spec; nothing here touches the network.
require("./verify-alias");
const { containsTerm } = require("../.verify/textMatch.js");
const { findCountry, countryToSupplyRegion, searchCountries, textMentionsCountry, countryGeoName } = require("../.verify/countries.js");
const { matchEventsToPorts, portName, customPortId } = require("../.verify/ports.js");
const { deriveTradeLanes, onboardingToProfile, draftToExtras, emptyDraft, parsePastedSupplierRows, shortCompanyName, watchingSentence, importResultToDraft, extrasAfterProfileSave } = require("../.verify/onboarding.js");
const { computeChecklist, openItems, setupPercent, checklistProgress } = require("../.verify/setupChecklist.js");
const {
  pickHeadlineEvents, supplierEventMatch, supplierTeaser, activeEventsForSuppliers,
  productInsight, stockDaysRemaining, firstLightCards, QUIET_CARD, portWatchHeadline,
} = require("../.verify/onboardingInsights.js");

let failed = 0;
function scoreEventsForProfileForShareCheck() {
  const { scoreEventsForProfile } = require("../.verify/scoreEvents.js");
  const r = scoreEventsForProfile([{ id: "x", title: "China factory floods", url: "", date: "2026-10-08T00:00:00Z", sourceDomain: "x", sourceCountry: "", category: "Weather", severity: 2, region: "Asia Pacific" }], profile)[0];
  return r.relevanceReason === "67% of your supply comes from this region";
}
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

const ev = (id, category, severity, date, extra = {}) =>
  ({ id, title: id, url: "", date, sourceDomain: "x", sourceCountry: "", category, severity, region: "Asia Pacific", ...extra });

console.log("-- pickHeadlineEvents: distinct categories, highest severity first --");
const mixed = [
  ev("port-2", "Port", 2, "2026-10-08T00:00:00Z"),
  ev("port-3", "Port", 3, "2026-10-07T00:00:00Z"),
  ev("labor-3", "Labor", 3, "2026-10-06T00:00:00Z"),
  ev("weather-2", "Weather", 2, "2026-10-08T00:00:00Z"),
  ev("tariff-1", "Tariff", 1, "2026-10-08T00:00:00Z"),
];
check("one per category, severity then date", pickHeadlineEvents(mixed).map(e => e.id), ["port-3", "labor-3", "weather-2"]);
const ties = [ev("old", "Port", 3, "2026-10-01T00:00:00Z"), ev("new", "Port", 3, "2026-10-08T00:00:00Z")];
check("newest wins within a category", pickHeadlineEvents(ties, 1).map(e => e.id), ["new"]);
const oneCategory = [
  ev("w1", "Weather", 1, "2026-10-08T00:00:00Z"), ev("w3", "Weather", 3, "2026-10-08T00:00:00Z"),
  ev("w2", "Weather", 2, "2026-10-08T00:00:00Z"), ev("w2b", "Weather", 2, "2026-10-07T00:00:00Z"),
];
check("fewer than 3 categories fills by severity", pickHeadlineEvents(oneCategory).map(e => e.id), ["w3", "w2", "w2b"]);
check("no events -> empty", pickHeadlineEvents([]), []);
check("does not mutate input order", oneCategory.map(e => e.id), ["w1", "w3", "w2", "w2b"]);

console.log("-- containsTerm: whole terms only, abbreviations case-sensitive --");
check('"US" vs pronoun "us"', containsTerm("Tariffs hit us hard", "US"), false);
check('"US" vs "US tariffs"', containsTerm("New US tariffs on steel", "US"), true);
check('"Niger" inside "Nigeria"', containsTerm("Floods in Nigeria", "Niger"), false);
check('"Oman" inside "woman"', containsTerm("Woman named CEO", "Oman"), false);
check('"u.s." before a hyphen', containsTerm("U.S.-China talks stall", "u.s."), true);
check('"china" case-insensitive', containsTerm("CHINA exports fall", "China"), true);

console.log("-- countries: lookup, regions, aliases --");
check("alias USA", findCountry("usa")?.name, "United States");
check("alias Holland", findCountry("Holland")?.name, "Netherlands");
check("alias PRC", findCountry("PRC")?.name, "China");
check("lookup-only Korea still resolves", findCountry("Korea")?.name, "South Korea");
check("America is not an alias", findCountry("America"), null);
check("Mexico is North America (matches event feeds)", countryToSupplyRegion("Mexico"), "North America");
check("unknown country -> null, never a guess", countryToSupplyRegion("Atlantis"), null);
check("geoName for United States", countryGeoName("US"), "United States of America");
check("search 'ger' prefix first", searchCountries("ger").map(c => c.name)[0], "Germany");
check("search caps at 6", searchCountries("a").length, 6);
check("search matches lookup aliases", searchCountries("kor").map(c => c.name), ["South Korea"]);

console.log("-- countries: headline matching --");
check("Korea alias does not match North Korea news", textMentionsCountry("North Korea fires missile", "South Korea"), false);
check("South Korea matches its own name", textMentionsCountry("South Korea port strike", "South Korea"), true);
check("Latin America news is not about the US", textMentionsCountry("Latin America floods disrupt trade", "United States"), false);
check("US abbreviation matches", textMentionsCountry("US ports brace for strike", "United States"), true);

console.log("-- ports: keyword matching and ordering --");
const portEvents = [
  ev("Long Beach terminal congestion eases", "Port", 1, "2026-10-08T00:00:00Z"),
  ev("Los Angeles port strike looms", "Port", 3, "2026-10-07T00:00:00Z"),
  ev("Laredo crossing delays mount at the US-Mexico border", "Port", 2, "2026-10-08T00:00:00Z"),
  ev("Oaklands of Ohio fair opens", "General", 1, "2026-10-08T00:00:00Z"),
  ev("Port of Baltimore reopens channel", "Port", 2, "2026-10-08T00:00:00Z"),
];
const pm = matchEventsToPorts(portEvents, ["la-lb", "laredo", "oakland", "savannah", customPortId("Port of Baltimore")]);
check("LA/LB: severity desc", pm["la-lb"].map(e => e.severity), [3, 1]);
check("Laredo matched", pm["laredo"].length, 1);
check('"Oaklands" is not Oakland', pm["oakland"].length, 0);
check("unmatched port has an empty list", pm["savannah"], []);
check("custom port matches its own name", pm["custom:Port of Baltimore"].length, 1);
check("portName for custom id", portName("custom:Port of Baltimore"), "Port of Baltimore");

console.log("-- deriveTradeLanes (spec 4.4.1) --");
const sup = (country, region) => ({ country, region });
check("Asia + LA/LB -> West Coast", deriveTradeLanes(["la-lb"], [sup("Taiwan", "Asia Pacific")]), ["Asia-Pacific to US West Coast"]);
check("Asia + Savannah -> East Coast", deriveTradeLanes(["savannah"], [sup("China", "Asia Pacific")]), ["Asia-Pacific to US East Coast"]);
check("Europe + Houston -> Europe to US", deriveTradeLanes(["houston"], [sup("Germany", "Europe")]), ["Europe to US"]);
check("Mexico + Laredo -> Latin America to US", deriveTradeLanes(["laredo"], [sup("Mexico", "North America")]), ["Latin America to US"]);
check("Asia + Laredo only -> nothing", deriveTradeLanes(["laredo"], [sup("China", "Asia Pacific")]), []);
check("Middle East + Europe with any ports", deriveTradeLanes(["oakland"], [sup("Israel", "Middle East"), sup("Germany", "Europe")]), ["Middle East to Europe"]);
check("no ports: fallback per region", deriveTradeLanes([], [sup("China", "Asia Pacific"), sup("Germany", "Europe"), sup("Brazil", "Latin America")]),
  ["Asia-Pacific to US West Coast", "Europe to US", "Latin America to US"]);
check("de-duplicated", deriveTradeLanes(["la-lb", "oakland"], [sup("China", "Asia Pacific"), sup("Japan", "Asia Pacific")]), ["Asia-Pacific to US West Coast"]);

console.log("-- onboardingToProfile / draftToExtras (spec 4.4) --");
const NOW = new Date(2026, 9, 8, 12, 0, 0); // 8 Oct 2026, local noon
const draft = emptyDraft(NOW);
draft.path = "manual";
draft.company = { name: " Meridian Electronics Co. ", hqCountry: "usa", sector: "Electronics", revenueRange: "$100M–$1B", role: "operations" };
draft.suppliers = [
  { id: "s1", name: "TSMC", country: "Taiwan", category: "Semiconductors", leadTimeDays: 45 },
  { id: "s2", name: "Foxconn", country: "china", category: "Contract assembly" },
  { id: "s3", name: "Bosch", country: "Germany", category: "Sensors", leadTimeDays: 25 },
  { id: "s4", name: "Nowhere Ltd", country: "Atlantis", category: "?" },
];
draft.entryPorts = ["la-lb", "ny-nj"];
draft.transport = ["Ocean Freight", "Truck"];
draft.products = [
  { id: "p1", name: "EV Charging Module", supplierId: "s1", stockDays: 18, asOf: "2026-10-08" },
  { id: "p2", name: "Smart Home Hub", supplierId: "s2", stockLater: true },
  { id: "p3", name: "", supplierId: "s3", stockDays: 5 },
];
const profile = onboardingToProfile(draft, NOW);
const extras = draftToExtras(draft, NOW);
check("unknown-country supplier dropped", profile.suppliers.map(s => s.id), ["s1", "s2", "s3"]);
check("country canonicalised", profile.suppliers[1].country, "China");
check("regions from country", profile.suppliers.map(s => s.region), ["Asia Pacific", "Asia Pacific", "Europe"]);
check("even share in whole numbers summing to 100", profile.suppliers.map(s => s.sharePercent), [34, 33, 33]);
check("missing lead time -> 0", profile.suppliers[1].leadTimeDays, 0);
check("leadTimeUnknown", extras.leadTimeUnknown, ["s2"]);
check("unnamed product dropped", profile.productLines.map(p => p.id), ["p1", "p2"]);
check("reorder point defaults to lead time", profile.productLines[0].reorderPointDays, 45);
check("reorder point 0 when lead unknown", profile.productLines[1].reorderPointDays, 0);
check("reorderPointDefaulted", extras.reorderPointDefaulted, ["p1"]);
check("stock later -> 0 and inventoryUnknown", [profile.productLines[1].inventoryDaysOnHand, extras.inventoryUnknown], [0, ["p2"]]);
check("inventoryAsOf only for stocked products", extras.inventoryAsOf, { p1: "2026-10-08" });
check("HQ canonicalised", profile.headquartersCountry, "United States");
check("primaryMarkets from HQ", [profile.primaryMarkets, extras.primaryMarketsDerived], [["North America"], true]);
check("company name trimmed", profile.companyName, "Meridian Electronics Co.");
check("trade lanes from ports", profile.tradeLanes, ["Asia-Pacific to US West Coast", "Asia-Pacific to US East Coast", "Europe to US"]);
check("painPoints empty", profile.painPoints, []);
check("extras carry role, ports, path", [extras.role, extras.entryPorts, extras.path], ["operations", ["la-lb", "ny-nj"], "manual"]);

console.log("-- whole-number shares (largest remainder) --");
const { largestRemainderShares, wholeNumberShares } = require("../.verify/importCalculations.js");
check("3 -> 34/33/33", wholeNumberShares(3), [34, 33, 33]);
check("6 -> 17/17/17/17/16/16", wholeNumberShares(6), [17, 17, 17, 17, 16, 16]);
check("7 sums to 100", wholeNumberShares(7).reduce((t, n) => t + n, 0), 100);
check("every count 1..10 sums to 100", [1,2,3,4,5,6,7,8,9,10].every(n => wholeNumberShares(n).reduce((t, x) => t + x, 0) === 100), true);
check("weighted: largest remainder gets the spare point", largestRemainderShares([2, 1, 1, 1, 1, 1]), [29, 15, 14, 14, 14, 14]);
check("0 suppliers -> []", wholeNumberShares(0), []);
check("scorer now prints a whole percent", scoreEventsForProfileForShareCheck(), true);

console.log("-- supplierEventMatch (spec 7) --");
const tsmc = profile.suppliers[0];
check("monitor severity never active", supplierEventMatch(tsmc, ev("Taiwan typhoon", "Weather", 1, "2026-10-08T00:00:00Z")), null);
check("country named -> country", supplierEventMatch(tsmc, ev("Taiwan chip export curbs", "Tariff", 2, "2026-10-08T00:00:00Z")), "country");
// Country-only since Oct 2026: same-region Port/Labor/Weather events no longer count.
check("same-region weather, country not named -> null", supplierEventMatch(tsmc, ev("Typhoon in the Philippines", "Weather", 2, "2026-10-08T00:00:00Z")), null);
check("same-region labor, country not named -> null", supplierEventMatch(tsmc, ev("Dockworkers walk out in Busan", "Labor", 3, "2026-10-08T00:00:00Z")), null);
check("Japan vessel sanctions does NOT touch TSMC (Taiwan)", supplierEventMatch(tsmc, ev("Japan Launches First Vessel Sanctions in Support of Ukraine", "Port", 3, "2026-10-08T00:00:00Z")), null);
check("same-region tariff, country not named -> null", supplierEventMatch(tsmc, ev("Vietnam tariff talks", "Tariff", 3, "2026-10-08T00:00:00Z")), null);
check("port event naming the country -> country", supplierEventMatch(tsmc, ev("Taiwan port congestion worsens", "Port", 2, "2026-10-08T00:00:00Z")), "country");

console.log("-- supplierTeaser: country-named events only, then severity, then newest --");
const teaserEvents = [
  ev("Typhoon hits Asia", "Weather", 3, "2026-10-08T00:00:00Z"),
  ev("China port congestion", "Port", 2, "2026-10-06T00:00:00Z"),
  ev("China factory floods", "Weather", 2, "2026-10-07T00:00:00Z"),
];
const t = supplierTeaser(profile.suppliers, teaserEvents);
check("unnamed-country event ignored even when more severe", [t.event.id, t.supplier.id, t.matchedBy], ["China factory floods", "s2", "country"]);
check("Japan sanctions alone -> no teaser for Taiwan/China/Germany suppliers", supplierTeaser(profile.suppliers, [ev("Japan Launches First Vessel Sanctions in Support of Ukraine", "Port", 3, "2026-10-08T00:00:00Z")]), null);
check("no suppliers -> null", supplierTeaser([], teaserEvents), null);
check("only country-named events count as active", activeEventsForSuppliers(profile.suppliers, teaserEvents).map(e => e.id), ["China port congestion", "China factory floods"]);

console.log("-- stockDaysRemaining: as-of countdown --");
const p1 = profile.productLines[0];
check("as of today", stockDaysRemaining(p1, extras, NOW), 18);
check("10 days later", stockDaysRemaining(p1, extras, new Date(2026, 9, 18, 9)), 8);
check("never below zero", stockDaysRemaining(p1, extras, new Date(2026, 11, 1)), 0);
check("unknown stock -> null", stockDaysRemaining(profile.productLines[1], extras, NOW), null);
check("no extras -> raw value", stockDaysRemaining(p1, null, NOW), 18);

console.log("-- productInsight rules (spec 7) --");
const taiwanEvent = ev("Taiwan power outage halts fabs", "General", 3, "2026-10-08T00:00:00Z");
const r1 = productInsight(draft, [taiwanEvent], NOW);
check("rule 1: stock <= lead with active event", [r1.rule, r1.productId, r1.headline], [1, "p1", "EV Charging Module is your tightest spot."]);
check("rule 1 body names the country", r1.body, "18 days of stock against a 45-day lead time from TSMC, while Taiwan has active disruptions.");
const chinaEvent = ev("China port closure", "Port", 3, "2026-10-08T00:00:00Z", { region: "Asia Pacific" });
const draft2 = JSON.parse(JSON.stringify(draft));
draft2.products[0].stockDays = 90; // no longer tight
const r2 = productInsight(draft2, [chinaEvent], NOW);
// Only Foxconn (China) is named, so only p2 is exposed; TSMC in Taiwan is not, despite sharing the region.
check("rule 2: single source whose supplier's country is named", [r2.rule, r2.productId], [2, "p2"]);
check("rule 2 headline", r2.headline, "Smart Home Hub has one source: Foxconn, in China.");
const r2s = productInsight(draft2, [ev("Taiwan port closure", "Port", 3, "2026-10-08T00:00:00Z")], NOW);
check("rule 2 body with stock clause", [r2s.productId, r2s.body], ["p1", "With 90 days of stock against a 45-day lead time, a disruption there would leave a gap. You can name a backup later."]);
const draft3 = JSON.parse(JSON.stringify(draft));
draft3.products = [draft.products[1]];
const r2b = productInsight(draft3, [chinaEvent], NOW);
check("rule 2 without stock clause", r2b.body, "A disruption there would leave a gap. You can name a backup later.");
const r3 = productInsight(draft2, [], NOW);
check("rule 3: any single source, no events", [r3.rule, r3.body], [3, "A backup supplier lets Foreglow tell you when you can switch. You can add one later."]);
const draft4 = JSON.parse(JSON.stringify(draft));
draft4.products = [];
check("no products -> null", productInsight(draft4, [chinaEvent], NOW), null);

console.log("-- firstLightCards (spec 7) --");
check("nothing relevant -> only the quiet card", firstLightCards(profile, extras, [], NOW), [QUIET_CARD]);
const flEvents = [
  taiwanEvent,
  ev("Los Angeles port strike looms", "Port", 2, "2026-10-08T00:00:00Z", { region: "North America" }),
  ev("Long Beach berth reopens", "Port", 1, "2026-10-08T00:00:00Z", { region: "North America" }),
];
const cards = firstLightCards(profile, extras, flEvents, NOW);
check("decide card from the product insight", [cards[0].label, cards[0].tone, cards[0].title], ["DECIDE THIS WEEK", "critical", "EV Charging Module is your tightest spot."]);
check("entry-port event preferred, port name as title", [cards[1].label, cards[1].title, cards[1].body], ["WATCH", "Los Angeles / Long Beach", "Los Angeles port strike looms"]);
check("monitor-severity port news is not a watch card", cards.some(c => c.body === "Long Beach berth reopens"), false);
check("never more than one quiet card", cards.filter(c => c.key === "quiet").length <= 1, true);
check("at most three cards", cards.length <= 3, true);

console.log("-- parsePastedSupplierRows (spec 6.4 paste) --");
const pasted = parsePastedSupplierRows("Supplier\tCountry\tSupplies\tLead\r\nTSMC\tTaiwan\tChips\t45 days\nFoxconn\tChina\n\t\t\t\nBosch\tGermany\tSensors\t25\n");
check("header row skipped, blank rows dropped", pasted.map(r => r.name), ["TSMC", "Foxconn", "Bosch"]);
check("cells in table order, lead digits only", pasted[0], { name: "TSMC", country: "Taiwan", category: "Chips", lead: "45" });
check("missing trailing cells are empty", pasted[1], { name: "Foxconn", country: "China", category: "", lead: "" });

console.log("-- portWatchHeadline (spec 6.5) --");
check("no ports", portWatchHeadline(0, 0), "Pick your ports to see what's happening there.");
check("none with news", portWatchHeadline(3, 0), "Nothing reported at your ports today.");
check("one of one", portWatchHeadline(1, 1), "Your entry point has something going on this week.");
check("both", portWatchHeadline(2, 2), "Both of your entry points have something going on this week.");
check("all", portWatchHeadline(4, 4), "All of your entry points have something going on this week.");
check("some", portWatchHeadline(3, 1), "1 of your 3 entry points have something going on this week.");

console.log("-- shortCompanyName / watchingSentence (spec 6.8) --");
check("Co. dropped, Electronics kept", shortCompanyName("Meridian Electronics Co."), "Meridian Electronics");
check("stacked suffixes", shortCompanyName("Acme Holdings, Inc."), "Acme Holdings");
check("LLC", shortCompanyName("Brightline LLC"), "Brightline");
check("never empty", shortCompanyName("Inc."), "Inc.");
check("all clauses", watchingSentence({ suppliers: 4, countries: 4, ports: 2, products: 3 }),
  "Foreglow is now watching 4 suppliers in 4 countries, 2 entry points and 3 product lines. Here's what it sees today.");
check("zero clauses omitted, singulars", watchingSentence({ suppliers: 1, countries: 1, ports: 0, products: 1 }),
  "Foreglow is now watching 1 supplier in 1 country and 1 product line. Here's what it sees today.");

console.log("-- computeChecklist (spec 8.1) --");
const FLAGS_OFF = { emailBrief: false, teams: false };
const completedExtras = { ...extras, completedAt: NOW.toISOString() };
const items = computeChecklist(profile, completedExtras, FLAGS_OFF);
const open = openItems(items).map(i => i.id);
check("finish-onboarding done after completion", items.find(i => i.id === "finish-onboarding").done, true);
check("open items in value order", open, ["backup:p1", "stock:p2", "leadtimes", "tier2", "reorder", "markets", "painpoints"]);
check("backup names the product", items.find(i => i.id === "backup:p1").title, "Name a backup for EV Charging Module");
check("lead times count", items.find(i => i.id === "leadtimes").title, "Add lead times for 1 supplier");
check("markets names the region", items.find(i => i.id === "markets").why, "We assumed North America from your headquarters.");
check("email and invite hidden while flags are off", items.some(i => i.id === "email" || i.id === "invite"), false);
check("email shown when its flag is on", computeChecklist(profile, completedExtras, { emailBrief: true, teams: false }).some(i => i.id === "email"), true);
const partial = computeChecklist(profile, { ...extras }, FLAGS_OFF);
check("unfinished onboarding -> Finish setting up first", openItems(partial)[0].id, "finish-onboarding");
check("pre-v5.1 profile (no extras): no finish, stock, reorder or markets items",
  computeChecklist(profile, null, FLAGS_OFF).filter(i => ["finish-onboarding", "reorder", "markets"].includes(i.id) && !i.done).length
    + computeChecklist(profile, null, FLAGS_OFF).filter(i => i.id.startsWith("stock:")).length, 0);
check("percent counts sections + items honestly", setupPercent(profile, completedExtras, items), Math.round(100 * (4 + 1) / (4 + items.length)));
const progressed = { ...completedExtras, checklistInitial: open };
const afterPainPoints = computeChecklist({ ...profile, painPoints: ["Port congestion"] }, progressed, FLAGS_OFF);
check("progress: done = initial items no longer open", checklistProgress(afterPainPoints, progressed), { done: 1, total: 7 });

console.log("-- importResultToDraft (spec 6.7) --");
let n = 0;
const ids = () => `id${++n}`;
const imp = importResultToDraft(
  [
    { name: "TSMC Semiconductor", country: "taiwan", category: "Semiconductors", sharePercent: 60, leadTimeDays: 45 },
    { name: "Bosch Comp.", country: "", category: "Sensors", sharePercent: 40, leadTimeDays: 0 },
  ],
  [
    { name: "EV Charging Module", inventoryDaysOnHand: 18, reorderPointDays: 25, primarySupplierName: "TSMC" },
    { name: "Industrial IoT Sensor", inventoryDaysOnHand: 0, reorderPointDays: 0, primarySupplierName: "Unknown Co" },
  ],
  "2026-10-08",
  ids,
);
check("country canonicalised when known, kept blank when missing", imp.suppliers.map(s => s.country), ["Taiwan", ""]);
check("lead time kept only when > 0", imp.suppliers.map(s => s.leadTimeDays ?? null), [45, null]);
check("product linked by loose name match", imp.products[0].supplierId, imp.suppliers[0].id);
check("unmatched supplier name leaves product unlinked", imp.products[1].supplierId, undefined);
check("imported stock dated today", [imp.products[0].stockDays, imp.products[0].asOf], [18, "2026-10-08"]);
check("no stock -> add later", imp.products[1].stockLater, true);
const impDraft = { ...emptyDraft(NOW), suppliers: [...imp.suppliers], products: imp.products };
impDraft.suppliers[1] = { ...impDraft.suppliers[1], country: "Germany" };
const impProfile = onboardingToProfile(impDraft, NOW);
const impExtras = draftToExtras(impDraft, NOW);
check("real imported shares kept", impProfile.suppliers.map(s => s.sharePercent), [60, 40]);
check("real imported reorder point kept, not defaulted", [impProfile.productLines[0].reorderPointDays, impExtras.reorderPointDefaulted], [25, []]);
check("partial shares fall back to an even split", onboardingToProfile({ ...impDraft, suppliers: [impDraft.suppliers[0], { ...impDraft.suppliers[1], sharePercent: undefined }] }, NOW).suppliers.map(s => s.sharePercent), [50, 50]);

console.log("-- sample company (spec 4.7) --");
const { buildSampleProfile, buildSampleExtras } = require("../.verify/sampleProfile.js");
const { isDemoMode } = require("../.verify/demoMode.js");
const later = new Date(2026, 11, 25, 9);
const sp = buildSampleProfile(later);
const sx = buildSampleExtras(later);
check("dates are generated at build time, not fixed", sp.updatedAt, later.toISOString());
check("stock never decayed on the day it is built", sp.productLines.map(p => stockDaysRemaining(p, sx, later)), [25, 18, 40, 30]);
check("every product's supplier exists", sp.productLines.every(p => sp.suppliers.some(s => s.id === p.primarySupplierId)), true);
check("shares add up to 100", sp.suppliers.reduce((t, s) => t + s.sharePercent, 0), 100);
check("trade lanes derived from its ports", sp.tradeLanes, ["Asia-Pacific to US West Coast", "Latin America to US"]);
check("isDemoMode is false without a browser", isDemoMode(), false);

console.log("-- guest carry-over (v5.1) --");
const { decideCarryOver } = require("../.verify/guestCarryOver.js");
const guestRaw = JSON.stringify(profile);
const base = { signedIn: true, accountHasProfile: false, guestProfileRaw: guestRaw, guestExtrasRaw: JSON.stringify(completedExtras), accountCachesRaw: [], dismissed: false };
const d1 = decideCarryOver(base);
check("case 1: no account profile + guest profile -> prompt", [d1.kind, d1.companyName, !!d1.extras], ["prompt", "Meridian Electronics Co.", true]);
check("case 2: account already has a profile -> never", decideCarryOver({ ...base, accountHasProfile: true }).kind, "none");
check("case 3: no guest data -> nothing to offer", decideCarryOver({ ...base, guestProfileRaw: null, guestExtrasRaw: null }).kind, "none");
check("signed out -> none", decideCarryOver({ ...base, signedIn: false }).kind, "none");
check("Start fresh remembered -> none", decideCarryOver({ ...base, dismissed: true }).kind, "none");
check("copy that is another account's cache -> none", decideCarryOver({ ...base, accountCachesRaw: [guestRaw] }).kind, "none");
check("unreadable guest data -> none", decideCarryOver({ ...base, guestProfileRaw: "{not json" }).kind, "none");
check("profile without extras still offered", decideCarryOver({ ...base, guestExtrasRaw: null }).extras, null);

console.log("-- Phase 9: entry-port scoring (lib/scoreEvents.ts) --");
const { scoreEventsForProfile } = require("../.verify/scoreEvents.js");
const laEvent = ev("Los Angeles port strike looms", "Port", 2, "2026-10-08T00:00:00Z", { region: "North America" });
const noPorts = scoreEventsForProfile([laEvent], profile)[0];
const undefPorts = scoreEventsForProfile([laEvent], profile, undefined)[0];
const withPorts = scoreEventsForProfile([laEvent], profile, ["la-lb"])[0];
check("no ports: existing two-argument call unchanged", [undefPorts.relevanceScore, undefPorts.relevanceReason], [noPorts.relevanceScore, noPorts.relevanceReason]);
check("port match adds exactly 15", withPorts.relevanceScore - noPorts.relevanceScore, 15);
check("port reason goes first", withPorts.relevanceReason, "Affects your Los Angeles / Long Beach entry point");
check("non-matching port changes nothing", scoreEventsForProfile([laEvent], profile, ["savannah"])[0].relevanceScore, noPorts.relevanceScore);
check("custom port name matches", scoreEventsForProfile([ev("Baltimore terminal closed", "Port", 3, "2026-10-08T00:00:00Z")], profile, ["custom:Baltimore"])[0].relevanceReason, "Affects your Baltimore entry point");
const maxed = scoreEventsForProfile([ev("Los Angeles port strike shuts Taiwan China Germany lanes", "Port", 3, "2026-10-08T00:00:00Z", { region: "Asia Pacific" })], { ...profile, painPoints: ["Port congestion", "Lead time variability"] }, ["la-lb"])[0];
check("still capped at 100", maxed.relevanceScore <= 100, true);

console.log("-- Phase 10: inventory as-of dates (lib/inventoryRisk.ts, spec 8.2) --");
const { calculateInventoryRisk } = require("../.verify/inventoryRisk.js");
const invProfile = { ...profile, productLines: [{ id: "pA", name: "A", inventoryDaysOnHand: 30, reorderPointDays: 10, primarySupplierId: "s1" }, { id: "pB", name: "B", inventoryDaysOnHand: 0, reorderPointDays: 0, primarySupplierId: "s2" }] };
const tenDaysAgo = new Date(2026, 9, 8); const asOfNow = new Date(2026, 9, 18, 15);
const legacy = calculateInventoryRisk(invProfile, {}, 3);
const legacyUndef = calculateInventoryRisk(invProfile, {}, 3, undefined);
check("no opts: identical to before (decay by profile age)", [legacy.products[0].daysRemaining, legacy.products[0].riskLevel], [27, "warning"]);
check("no opts vs undefined opts identical", JSON.stringify(legacy.products.map(p => [p.daysRemaining, p.riskLevel, p.riskReason])), JSON.stringify(legacyUndef.products.map(p => [p.daysRemaining, p.riskLevel, p.riskReason])));
const dated = calculateInventoryRisk(invProfile, {}, 3, { inventoryAsOf: { pA: "2026-10-08" }, inventoryUnknown: ["pB"], now: asOfNow });
check("spec check 10: 30 days as of 10 days ago -> 20 left", dated.products[0].daysRemaining, 20);
check("unknown stock -> unknown level, 'Stock level not set'", [dated.products[1].riskLevel, dated.products[1].riskReason, dated.products[1].stockKnown], ["unknown", "Stock level not set", false]);
check("unknown stock excluded from critical/warning counts", [dated.criticalCount, dated.warningCount], [0, dated.products.filter(p => p.riskLevel === "warning").length]);
check("lead time 0 flagged as not set", dated.products[1].leadTimeKnown, false);
check("as-of echoed for display", dated.products[0].inventoryAsOf, "2026-10-08");

console.log("-- Phase 10: /profile save bookkeeping (extrasAfterProfileSave) --");
const beforeP = { ...invProfile, updatedAt: new Date(2026, 9, 1, 12).toISOString(), primaryMarkets: ["North America"] };
const baseX = { version: 1, inventoryAsOf: { pA: "2026-10-05" }, inventoryUnknown: ["pB"], reorderPointDefaulted: ["pA", "pB"], leadTimeUnknown: ["s2"], primaryMarketsDerived: true };
const nowSave = new Date(2026, 9, 9, 10);
const unchanged = extrasAfterProfileSave({ extras: baseX, before: beforeP, after: beforeP, asOfEdits: {}, now: nowSave });
check("unchanged product keeps its stock date", unchanged.inventoryAsOf.pA, "2026-10-05");
check("product never dated keeps the previous save's date (no silent reset)", unchanged.inventoryAsOf.pB, "2026-10-01");
check("unchanged unknown stays unknown", unchanged.inventoryUnknown, ["pB"]);
const afterP = { ...beforeP, productLines: [{ ...beforeP.productLines[0], reorderPointDays: 12 }, { ...beforeP.productLines[1], inventoryDaysOnHand: 14 }], suppliers: beforeP.suppliers.map(s => s.id === "s2" ? { ...s, leadTimeDays: 21 } : s), primaryMarkets: ["North America", "Europe"] };
const changed = extrasAfterProfileSave({ extras: baseX, before: beforeP, after: afterP, asOfEdits: { pA: "2026-10-03" }, entryPorts: ["ny-nj"], role: "planning", now: nowSave });
check("changed stock dated today", changed.inventoryAsOf.pB, "2026-10-09");
check("picked 'counted on' date wins", changed.inventoryAsOf.pA, "2026-10-03");
check("filled-in stock leaves inventoryUnknown", changed.inventoryUnknown, []);
check("edited reorder point leaves reorderPointDefaulted", changed.reorderPointDefaulted, ["pB"]);
check("entered lead time leaves leadTimeUnknown", changed.leadTimeUnknown, []);
check("changed markets are no longer 'derived'", changed.primaryMarketsDerived, false);
check("ports and role saved", [changed.entryPorts, changed.role], [["ny-nj"], "planning"]);
check("pre-v5.1 profile (no extras) gets dates without other flags", Object.keys(extrasAfterProfileSave({ extras: null, before: beforeP, after: beforeP, asOfEdits: {}, now: nowSave })).sort(), ["inventoryAsOf", "inventoryUnknown", "leadTimeUnknown", "reorderPointDefaulted", "version"]);

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all passed");
