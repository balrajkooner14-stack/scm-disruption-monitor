#!/usr/bin/env bash
# Compiles lib/ to .verify/ then runs every scripts/verify-*.js.
# This repo has no test framework; these harnesses are the test suite.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf .verify
npx tsc -p scripts/tsconfig.verify.json

failed=0
for f in scripts/verify-*.js; do
  [ "$f" = "scripts/verify-alias.js" ] && continue
  echo ""
  echo "=== $f ==="
  if ! node "$f"; then failed=1; fi
done

echo ""
if [ "$failed" -ne 0 ]; then echo "VERIFY FAILED"; exit 1; fi
echo "VERIFY PASSED"
