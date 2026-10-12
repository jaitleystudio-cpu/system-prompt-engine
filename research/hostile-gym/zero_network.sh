#!/bin/bash
# Real OS-level zero-network harness (macOS sandbox-exec, network denied).
# Positive control proves the sandbox actually blocks sockets; then the WASM gate must pass inside it.
cd "$(dirname "$0")"
PROF='(version 1)(allow default)(deny network*)'
node -e 'fetch("http://127.0.0.1:11435/api/tags").then(r=>{console.log("control_unsandboxed_fetch_status",r.status)}).catch(e=>{console.log("control_unsandboxed_fetch_error",e.cause?.code||e.message);process.exit(3)})'; c1=$?
sandbox-exec -p "$PROF" node -e 'fetch("http://127.0.0.1:11435/api/tags").then(r=>{console.log("SANDBOX_LEAK",r.status);process.exit(0)}).catch(e=>{console.log("control_sandboxed_fetch_blocked",e.cause?.code||e.message);process.exit(4)})'; c2=$?
sandbox-exec -p "$PROF" node wasm_gate.mjs > /tmp/hg-r1-gate-sandboxed.json; c3=$?
sandbox-exec -p "$PROF" env SPE_FIXTURE_ID=POS-001 node ../../apps/web/scripts/eval-fixture.mjs > /tmp/hg-r1-eval-sandboxed.json; c4=$?
echo "{\"control_unsandboxed_exit\":$c1,\"control_sandboxed_exit\":$c2,\"gate_in_sandbox_exit\":$c3,\"eval_in_sandbox_exit\":$c4,\"eval_status\":$(node -e 'console.log(JSON.stringify(JSON.parse(require("fs").readFileSync("/tmp/hg-r1-eval-sandboxed.json","utf8")).result?.status??null))')}"
# Gate may exit 1 for non-network known defects (schema fail-open); zero-network requires: gate completed in sandbox,
# every boundary case VALID/handled, tripwires empty, no ENGINE_UNAVAILABLE caused by blocked sockets.
node -e 'const j=JSON.parse(require("fs").readFileSync("/tmp/hg-r1-gate-sandboxed.json","utf8"));const t=j.results.find(r=>r.name==="zero_network_tripwires");const unavailable=j.results.filter(r=>r.status==="ENGINE_UNAVAILABLE").length;const bnd=j.results.filter(r=>r.name.startsWith("boundary_"));console.log(JSON.stringify({gate_total:j.total,gate_failed:j.failed,failed_names:j.results.filter(r=>!r.ok).map(r=>r.name),tripwires:t.trips,boundary_cases:bnd.length,boundary_ok:bnd.filter(r=>r.ok).length,engine_unavailable:unavailable}));process.exit(t.ok&&unavailable===0&&bnd.every(r=>r.ok)?0:5)'; c5=$?
[ $c1 -eq 0 ] && [ $c2 -eq 4 ] && [ $c5 -eq 0 ] && [ $c4 -eq 0 ]
