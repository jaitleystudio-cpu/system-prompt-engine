#!/usr/bin/env bash
# Assert checked-in WASM sha256 matches the RT pin (no rebuild required).
set -euo pipefail
PIN="${WASM_PIN:-b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b}"
WASM_PATH="${WASM_PATH:-apps/web/public/spe_wasm.wasm}"
META_PATH="${META_PATH:-apps/web/public/spe_wasm.sha256.json}"
if [[ ! -f "$WASM_PATH" ]]; then
  echo "WASM_CUSTODY_FAIL: missing $WASM_PATH"
  exit 1
fi
OBS=$(shasum -a 256 "$WASM_PATH" | awk '{print $1}')
echo "WASM_OBS=$OBS"
echo "WASM_PIN=$PIN"
if [[ "$OBS" != "$PIN" ]]; then
  echo "WASM_CUSTODY_FAIL: sha256 mismatch"
  exit 1
fi
META_SHA=$(python3 -c "import json; print(json.load(open('$META_PATH'))['sha256'])")
echo "WASM_META=$META_SHA"
if [[ "$META_SHA" != "$PIN" ]]; then
  echo "WASM_CUSTODY_FAIL: spe_wasm.sha256.json mismatch"
  exit 1
fi
echo "WASM_CUSTODY_OK=YES"
