#!/usr/bin/env bash
# Compiles lib/ to .verify/ then runs every scripts/verify-*.js.
# This repo has no test framework; these harnesses are the test suite.
set -euo pipefail
cd "$(dirname "$0")/.."

rm -rf .verify
npx tsc lib/fetchDisruptions.ts lib/tradeFeeds.ts lib/fetchTradeNews.ts \
  --outDir .verify \
  --module commonjs \
  --target es2020 \
  --moduleResolution node \
  --esModuleInterop \
  --skipLibCheck \
  --resolveJsonModule

failed=0
for f in scripts/verify-*.js; do
  echo ""
  echo "=== $f ==="
  if ! node "$f"; then failed=1; fi
done

echo ""
if [ "$failed" -ne 0 ]; then echo "VERIFY FAILED"; exit 1; fi
echo "VERIFY PASSED"
