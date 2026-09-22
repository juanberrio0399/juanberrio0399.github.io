#!/usr/bin/env sh
# Rebuilds assets/vendor/duckdb-wasm/duckdb-api.js (the small JS API, ~215 KB) and prints the
# SHA-384 hashes that assets/js/playground.js pins for the worker and .wasm files it loads from
# jsDelivr. After bumping VERSION: update ENGINE_VERSION and SRI in playground.js with the output,
# and refresh the versions in THIRD_PARTY_NOTICES.txt.
set -eu

VERSION=1.32.0
# Exact version on purpose: this bundler produces the file served to visitors, so a
# range (0.25) would let two rebuilds emit different bytes.
ESBUILD_VERSION=0.25.12
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TMP=$(mktemp -d)
cd "$TMP"

npm init -y >/dev/null
npm install --no-audit --no-fund "@duckdb/duckdb-wasm@$VERSION" "esbuild@$ESBUILD_VERSION" >/dev/null
printf "export { AsyncDuckDB, VoidLogger, selectBundle } from '@duckdb/duckdb-wasm';\n" > entry.mjs
npx esbuild entry.mjs --bundle --format=esm --minify --legal-comments=eof --target=es2020 \
  --outfile="$ROOT/assets/vendor/duckdb-wasm/duckdb-api.js"

for f in duckdb-eh.wasm duckdb-mvp.wasm duckdb-browser-eh.worker.js duckdb-browser-mvp.worker.js; do
  printf "'%s': 'sha384-%s',\n" "$f" \
    "$(openssl dgst -sha384 -binary "node_modules/@duckdb/duckdb-wasm/dist/$f" | openssl base64 -A)"
done
