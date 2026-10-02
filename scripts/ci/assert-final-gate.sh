#!/usr/bin/env bash
# Aggregate job results: FAIL if any result is not success.
set -euo pipefail
# Args: name=result pairs
FAIL=0
for pair in "$@"; do
  name="${pair%%=*}"
  result="${pair#*=}"
  echo "JOB $name => $result"
  case "$result" in
    success) ;;
    *)
      echo "FINAL_GATE_FAIL: $name is $result (need success)"
      FAIL=1
      ;;
  esac
done
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
echo "FINAL_GATE=PASS"
