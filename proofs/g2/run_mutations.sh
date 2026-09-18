#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JAR="$ROOT/tools/tlc/tla2tools.jar"
OUT="$ROOT/proofs/g2/mutations"
CEX="$ROOT/proofs/g2/counterexamples"
mkdir -p "$CEX"

run_mut() {
  local id="$1" dir="$2" cfg="$3" expected_prop="$4"
  echo "=== MUTANT $id ==="
  local log="$OUT/$dir/tlc.log"
  local start end elapsed ec
  start=$(date +%s.%N)
  set +e
  (cd "$OUT/$dir" && java -XX:+UseParallelGC -Xmx3559m -jar "$JAR" \
    -config "$cfg" -workers 4 SPELeaseCommit) >"$log" 2>&1
  ec=$?
  set -e
  end=$(date +%s.%N)
  elapsed=$(python3 -c "print(round(float('$end')-float('$start'), 3))")
  # Save counterexample portion
  if grep -qE 'is violated|Temporal properties were violated|Deadlock reached' "$log"; then
    cp "$log" "$CEX/${id}_counterexample.log"
    killed=true
  else
    killed=false
  fi
  python3 - <<PY
import json, re, pathlib
log = pathlib.Path("$log").read_text(errors="replace")
inv = re.findall(r"Invariant (\S+) is violated", log)
temporal = "Temporal properties were violated" in log
deadlock = "Deadlock reached" in log
killed = bool(inv) or temporal or deadlock or int("$ec") != 0 and ("violated" in log.lower())
# exit 255 often means violation
if int("$ec") != 0 and ("violated" in log.lower() or "Error:" in log):
    killed = True
out = {
  "mutation_id": "$id",
  "directory": "proofs/g2/mutations/$dir",
  "cfg": "$cfg",
  "expected_violated_property": "$expected_prop",
  "exit_code": int("$ec"),
  "elapsed_sec": float("$elapsed"),
  "invariants_violated": inv,
  "temporal_violation": temporal,
  "deadlock": deadlock,
  "killed": killed,
  "counterexample_log": "proofs/g2/counterexamples/${id}_counterexample.log" if killed else None,
  "status": "KILLED" if killed else "SURVIVED",
}
pathlib.Path("$OUT/$dir/result.json").write_text(json.dumps(out, indent=2)+"\n")
print(json.dumps(out, indent=2))
PY
}

run_mut M1_stale M1_stale C1_stale_patch.cfg StalePatchNeverCommits
run_mut M2_atomicity M2_atomicity C_safety_all.cfg StateProofAtomicity
run_mut M3_lease_bind M3_lease_bind C3_multiple_leases.cfg LeaseBindsBaseSnapshot
run_mut M4_unknown_pass M4_unknown_pass C5_verdicts.cfg UnknownNeverCommits
run_mut M5_consumed_reuse M5_consumed_reuse C2_competing_patches.cfg OnlyActiveLeaseCommits/NoDoubleCommit
run_mut M6_liveness M6_liveness C6_liveness.cfg ValidContinuouslyEnabledCommitEventuallyResolves

echo "=== MUTATION SWEEP DONE ==="
