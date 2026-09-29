# SPE TASK 57R CORE-B / QUALITY PRODUCT CLOSURE REPORT

```text
SPE TASK 57R CORE-B / QUALITY PRODUCT CLOSURE REPORT
====================================================

BASE SHA:
352d05ee0fb97b46fea0171e958868da30f268d9

FINAL PR HEAD:
recorded after the proof commit on cursor/spe-quality-delta-planb-validate-only-20260929

HISTORICAL PLAN-B RECOVERY:
PR39=not re-fetched in this session
old_runtime_bytes=not claimed
verdict=HOLD on PR39 history; Task57 WASM dd57eb3e… is historical only

RUNTIME CUSTODY:
caller_can_mint_verified=0 on the trusted quality path (custody tests passed)
trusted_quality_path=Worker type quality
verified_wasm_sha=0537fc879b42524d36cf94b965e1234f02cf557c47cc55c7b1612d5643c70fcb
receipt_subject_binding=YES

QUALITY DELTA:
Task57 engine kept; from_k3 maps kernel K3 output inside Python and Rust
caller flags without runtime evidence cap at ENFORCEMENT_AVAILABLE

CAUSAL RECONSTRUCTION:
max_attempts=1
diagnosed_surface_only=YES for accepted repairs
scope_escape=rejected
protected_regressions=rejected

VECTORS:
distinct_quality=38 (normal 9, adversarial 29)
distinct_reconstruction=18 (normal 6, adversarial 12)
distinct_validate=21 (normal 1, adversarial 20)
padding_rows=0

MUTATION:
task57_original=passed inside pytest (test_mutants_killed)
task57r=12 guard outcomes killed
core_b=fallback and no-dead-end scripts passed
xcat=23/23 test is inside the 992 passed
effect=11/11 module is inside the 992 passed

CORE B:
implemented=YES
semantic_authority=NONE
raw_request_preserved=YES
network=0
credentials=0
external_effect=0
recursion=0
canonical=0
verified=0

NO-DEAD-END:
blank_success=0 in test-no-dead-end.mjs
silent_failure=terminal states are explicit
fake_verification=0 on the trusted path

PRODUCT WIRING:
quality_kernel_called=YES (from_k3 after K3)
ui_computes_semantic_verdict=NO
fallback_visible=labeled Safe fallback
fallback_exported_as_canonical=NO (.spe disabled without an artifact)
gap=from_k3 does not return reconstruction, so a repaired prompt is not yet swapped in

PYTHON:
passed=992
failed=0

RUST:
passed=41
failed=0

WASM:
previous_sha=dd57eb3ee6eb14297da8d49acb9803cf4853dbb89adcc5ef52f408379d643b22
new_sha=0537fc879b42524d36cf94b965e1234f02cf557c47cc55c7b1612d5643c70fcb
bytes=1273629
imports=0
exports=memory,spe_alloc,spe_evaluate,spe_free
reproducible=YES (two independent measure-only builds matched)

PARITY:
Python↔Rust=PASS
Rust↔WASM=PASS for the shared payloads
Python↔WASM=PASS

PERFORMANCE:
python_n=100
python_median=0.920 ms
python_p95=2.071 ms
python_max=5.030 ms
wasm_n=100 warm
wasm_median=0.026 ms
wasm_p95=0.281 ms
wasm_max=1.669 ms
wasm_integrity_cold=3.963 ms (separate)
core_b_n=100
core_b_median=0.015 ms
core_b_p95=0.101 ms
core_b_max=15.620 ms

EGRESS:
zero_egress=true
external_hosts=[]
fetch_during_evaluate=0
websocket_during_evaluate=0

DEPLOYMENT:
2

HOSTING:
FORBIDDEN

PR:
#57 draft, not merged

OFFICIAL BUILD:
npm run build exit 0
canonical wasm unchanged by that build

BROWSER:
Create flow was not clicked through in a browser

FINAL:
HOLD
TASK57R_FROM_K3_DOES_NOT_RETURN_RECONSTRUCTION

The kernel can reconstruct in one shot, and the app will use a repaired prompt only if the kernel returns reconstruction.kept=repaired. evaluate_from_k3 does not return that record yet, so the live path keeps the canonical prompt after validation.

No claim of target-model success, human preference superiority, world-outcome correctness, universal task success, production qualification, or world #1.

STOP.
```

The report above is the historical Task57R HOLD at `c27b13ae6543ea19125e5a2be419e109f86dfd0b`. It is not rewritten.

Task57R-F1 closes that hold on the same branch. The closure record is `TASK57R_F1_FROM_K3_RECONSTRUCTION.md`, `TASK57R_F1_ARTIFACT_CONSISTENCY.md`, `TASK57R_F1_BROWSER.md`, and `TASK57R_F1_MUTATION_RESULTS.md`.

## Task57R-F2

F2 does not replace the F1 kernel result. The repaired browser path remains open.

Chrome fault injection removed one hard-constraint bullet from the real quality request. WASM kept the original candidate, plan `UNRESOLVED`, delta `UNRESOLVED`, one attempt. The visible prompt stayed canonical and did not match the corrupted candidate. The qualifier refused a repaired PASS. Receipt text is not evidence.

Hold: `HOLD_LIVE_CREATE_REPAIR_NOT_ACCEPTED`.

Details: `TASK57R_F2_REAL_REPAIRED_BROWSER.md` and `TASK57R_F2_MUTATION_RESULTS.md`.
