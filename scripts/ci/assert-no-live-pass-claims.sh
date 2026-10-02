#!/usr/bin/env bash
# Fail if gate-scope docs/workflows claim LIVE_INDEX / LIVE_RETRACTION as PASS,
# or set FULL_SCHOLARLY_INDEX / LIVE_RETRACTION_VERIFICATION = YES outside fail-closed tests.
set -euo pipefail
set +e
HITS=$(grep -REn \
  --include='*.md' --include='*.yml' --include='*.yaml' --include='*.sh' --include='*.txt' \
  -e 'LIVE_(INDEX|RETRACTION)[[:space:]]*=[[:space:]]*PASS' \
  -e 'RT_B_LIVE_(INDEX|RETRACTION)[[:space:]]*=[[:space:]]*PASS' \
  docs/ci scripts/ci .github/workflows 2>/dev/null)
# Production continuation sources must not hardcode YES for live scholarly capabilities
# (tests asserting immutability may mention YES as attack payload — exclude tests/)
HITS2=$(grep -REn \
  --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' \
  -e 'LIVE_RETRACTION_VERIFICATION[[:space:]]*[:=][[:space:]]*['\''"]YES['\''"]' \
  -e 'FULL_SCHOLARLY_INDEX[[:space:]]*[:=][[:space:]]*['\''"]YES['\''"]' \
  -e 'LIVE_INDEX[[:space:]]*[:=][[:space:]]*['\''"]?PASS['\''"]?' \
  apps/web/src/engine/continuation apps/web/src/workspace 2>/dev/null \
  | grep -v 'CONTRADICT' | grep -v 'must not' | grep -v 'MUST_NOT' | grep -v 'fail-closed' || true)
set -e
if [[ -n "${HITS}${HITS2}" ]]; then
  echo "$HITS"
  echo "$HITS2"
  echo "FALSE_PROOF_FAIL: LIVE_INDEX/RETRACTION PASS or YES claim found in gate scope"
  exit 1
fi
echo "NO_LIVE_PASS_CLAIMS=YES"
