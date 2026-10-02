#!/usr/bin/env bash
# Apply Phase-3 TS promotion wire when liveScholarlyFabric.ts still lacks gate import.
# Usage (from repo root on Mac worktree): bash scripts/apply_p3_liveScholarlyFabric_wire.sh
set -euo pipefail
PATCH="docs/rt/patches/p3-liveScholarlyFabric-promotion-wire.patch"
if grep -q evaluateLivePromotionGate apps/web/src/engine/continuation/liveScholarlyFabric.ts; then
  echo "Wire already present."
  exit 0
fi
if git apply --check "$PATCH"; then
  git apply "$PATCH"
  echo "Applied $PATCH"
else
  echo "FAILED: patch does not apply and wire missing" >&2
  exit 1
fi
