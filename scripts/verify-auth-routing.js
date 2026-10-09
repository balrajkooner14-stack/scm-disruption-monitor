// safeNextPath guards the ?next= redirect on /auth/callback. Anything that
// isn't a same-origin path must come back null so it can't become an open
// redirect.
const { safeNextPath } = require("../.verify/authRouting.js");

let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label} -> got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
}

console.log("-- safeNextPath: same-origin paths pass through --");
check('"/reset-password"', safeNextPath("/reset-password"), "/reset-password");
check('"/"', safeNextPath("/"), "/");
check('"/profile?step=3"', safeNextPath("/profile?step=3"), "/profile?step=3");

console.log("-- safeNextPath: unset values --");
check("null", safeNextPath(null), null);
check("undefined", safeNextPath(undefined), null);
check('""', safeNextPath(""), null);

console.log("-- safeNextPath: off-origin values are rejected --");
check('"//evil.com"', safeNextPath("//evil.com"), null);
check('"/\\\\evil.com"', safeNextPath("/\\evil.com"), null);
check('"https://evil.com"', safeNextPath("https://evil.com"), null);
check('"evil.com/path"', safeNextPath("evil.com/path"), null);
check('"javascript:alert(1)"', safeNextPath("javascript:alert(1)"), null);

if (failed) { console.log(`${failed} FAILED`); process.exit(1); }
console.log("all passed");
