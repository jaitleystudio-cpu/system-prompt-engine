#!/usr/bin/env bash
# G2 TLC runner — reproducible invocations for SPELeaseCommit
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JAR="$ROOT/tools/tlc/tla2tools.jar"
FORMAL="$ROOT/formal"
LOGDIR="$ROOT/proofs/g2/logs"
RESDIR="$ROOT/proofs/g2/results"
CMDDIR="$ROOT/proofs/g2/commands"
mkdir -p "$LOGDIR" "$RESDIR" "$CMDDIR"

WORKERS="${TLC_WORKERS:-4}"
HEAP="${TLC_HEAP:-3559m}"

run_one() {
  local cfg_id="$1"
  local cfg_file="$2"
  local log="$LOGDIR/${cfg_id}.log"
  local cmd_file="$CMDDIR/${cfg_id}.sh"
  cat > "$cmd_file" <<EOF
#!/usr/bin/env bash
cd "$FORMAL"
exec java -XX:+UseParallelGC -Xmx${HEAP} -jar "$JAR" \\
  -config "$FORMAL/cfg/$cfg_file" \\
  -workers ${WORKERS} \\
  -coverage 1 \\
  SPELeaseCommit
EOF
  chmod +x "$cmd_file"
  echo "=== RUNNING $cfg_id ==="
  local start end elapsed ec
  start=$(date +%s.%N)
  set +e
  (cd "$FORMAL" && java -XX:+UseParallelGC -Xmx"$HEAP" -jar "$JAR" \
    -config "$FORMAL/cfg/$cfg_file" \
    -workers "$WORKERS" \
    -coverage 1 \
    SPELeaseCommit) >"$log" 2>&1
  ec=$?
  set -e
  end=$(date +%s.%N)
  elapsed=$(python3 -c "print(round(float('$end')-float('$start'), 3))")
  CFG_ID="$cfg_id" CFG_FILE="$cfg_file" LOG="$log" EC="$ec" ELAPSED="$elapsed" \
  WORKERS="$WORKERS" HEAP="$HEAP" RESDIR="$RESDIR" \
  python3 - <<'PY'
import json, re, pathlib, os
cfg_id = os.environ["CFG_ID"]
cfg_file = os.environ["CFG_FILE"]
log = pathlib.Path(os.environ["LOG"]).read_text(errors="replace")
ec = int(os.environ["EC"])
elapsed = float(os.environ["ELAPSED"])
workers = int(os.environ["WORKERS"])
heap = os.environ["HEAP"]
resdir = os.environ["RESDIR"]

def m(pat, cast=str, default=None):
    r = re.search(pat, log, re.M)
    if not r:
        return default
    return cast(r.group(1))

gen = m(r"(\d+) states generated", int)
dist = m(r"(\d+) distinct states found", int)
depth = m(r"depth of the complete state graph search is (\d+)", int)
fp = m(r"calculated \(optimistic\):\s+val = ([0-9.E+-]+)")
err = "No error has been found" in log
temporal_fail = "Temporal properties were violated" in log or "violated property" in log.lower()
inv_fail = bool(re.search(r"Invariant\s+\S+\s+is violated", log))
deadlock = "Deadlock reached" in log
status = "PASS" if (ec == 0 and err and not temporal_fail and not inv_fail and not deadlock) else (
    "FAIL" if (ec != 0 or inv_fail or temporal_fail or deadlock) else "INCOMPLETE"
)
out = {
  "config_id": cfg_id,
  "module": "SPELeaseCommit",
  "cfg_path": f"formal/cfg/{cfg_file}",
  "command_file": f"proofs/g2/commands/{cfg_id}.sh",
  "log_path": f"proofs/g2/logs/{cfg_id}.log",
  "workers": workers,
  "heap": heap,
  "elapsed_sec": elapsed,
  "exit_code": ec,
  "states_generated": gen,
  "distinct_states": dist,
  "search_depth": depth,
  "fingerprint_collision_probability_optimistic": fp,
  "counterexample": "YES" if (inv_fail or temporal_fail or deadlock) else "NO",
  "deadlock": "YES" if deadlock else "NO",
  "no_error_text": err,
  "status": status,
}
pathlib.Path(resdir, f"{cfg_id}.json").write_text(json.dumps(out, indent=2) + "\n")
print(json.dumps(out, indent=2))
PY
}

run_one C0_smoke C0_smoke.cfg
run_one C1_stale_patch C1_stale_patch.cfg
run_one C2_competing_patches C2_competing_patches.cfg
run_one C3_multiple_leases C3_multiple_leases.cfg
run_one C4_obligations_types C4_obligations_types.cfg
run_one C5_verdicts C5_verdicts.cfg
run_one C6_liveness C6_liveness.cfg
run_one C7_maximal C7_maximal.cfg
run_one C_safety_all C_safety_all.cfg
echo "=== MATRIX COMPLETE ==="
