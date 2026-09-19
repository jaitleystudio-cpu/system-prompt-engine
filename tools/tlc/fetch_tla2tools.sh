#!/usr/bin/env bash
# Fetch pinned TLA+ tools jar for G2 TLC runs.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
URL="${TLA2TOOLS_URL:-https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar}"
EXPECTED_SHA256="${TLA2TOOLS_SHA256:-9d36716ffb5e49d1ba8fae4651eba59f3189887e12eb90e204a42d2e6e993fef}"
OUT="$DIR/tla2tools.jar"
if [[ -f "$OUT" ]]; then
  actual=$(sha256sum "$OUT" | awk '{print $1}')
  if [[ "$actual" == "$EXPECTED_SHA256" ]]; then
    echo "OK: $OUT matches $EXPECTED_SHA256"
    exit 0
  fi
  echo "WARN: existing jar hash mismatch; re-fetching" >&2
fi
curl -fsSL -o "$OUT" "$URL"
actual=$(sha256sum "$OUT" | awk '{print $1}')
if [[ "$actual" != "$EXPECTED_SHA256" ]]; then
  echo "ERROR: sha256 $actual != expected $EXPECTED_SHA256" >&2
  exit 1
fi
echo "Fetched $OUT ($actual)"
