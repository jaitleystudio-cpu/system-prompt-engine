# I1-Q frozen-core regression qualification

Qualification of the I1 benchmark harness on frozen core `bd4540a`. This file does not change benchmark semantics, product behavior, or the WASM pin. `I1_QUALIFIED_PASS` means the frozen core still passes the F4/R1V regression gates with the I1 harness present, and the harness still fails closed. It is not a product benchmark pass and not a hosting unlock.

## Custody

| Field | Value |
| --- | --- |
| I1_RUNTIME_HEAD | `145b844d59161d54d8ea58d2586ec2cae16dbe8a` |
| I1_PROOF_HEAD | the commit that adds this file, on top of `I1_RUNTIME_HEAD` |
| Branch | `grok/spe-i1-benchmark-harness-bd4540a-20260930` |
| PR | #71 draft |
| FROZEN_CORE | `bd4540a9c96801168f2e7363c001a4184bad4311` |
| Start status | `git status --porcelain` empty |

Working tree at the start of this qualification was clean on the required head.

## Feature delta

`git diff --name-only bd4540a9c96801168f2e7363c001a4184bad4311 145b844d59161d54d8ea58d2586ec2cae16dbe8a` is 19 files, all under:

- `evaluations/spe_benchmark_qualification_v1/**`
- `schemas/spe_benchmark_*.schema.json`
- `tests/regression/test_spe_benchmark_qualification_harness.py`
- `tests/regression/test_spe_benchmark_python_subject.py`
- `tools/run_spe_benchmark.py`
- `tools/spe_benchmark_python_subject.py`
- `proofs/i1_benchmark_harness_20260930/**`

No `spe_runtime`, `portable`, or `apps/web` semantic source is in that diff. This qualification adds only this report.

## Benchmark gate

| Command | Exit | Result |
| --- | --- | --- |
| `python3 tools/run_spe_benchmark.py --check-hashes` | 0 | `hashes=OK`, `frozen_files=11`, `measurement_default=UNKNOWN`, `scores_included=false` |
| `python3 tools/run_spe_benchmark.py --fixture-only` | 0 | `marked_pass_count=0`, `provider_calls=0`, `network_used=false`, every compared `spe_prompt=UNKNOWN` and `measurement_statuses=UNKNOWN` |
| `python3 tools/run_spe_benchmark.py --subject python-reference --format json` | 0 | `mode=offline-record`, `marked_pass_count=0`, `provider_calls=0`, `network_used=false`, `harness_invented_scores=false` |

Subject stdout sha256 `fdf09060cc149e312c77b2f7dd8dc94b4526e1e39787ce04de7e73b254aa2beb` (123334 bytes), identical to the I1 evidence run. All 12 measurement fields on all 24 records are `status=UNKNOWN`. Twelve records keep `spe_prompt=UNKNOWN` (raw arm). Twelve records attach a compiled prompt. `scores_emitted` is not a result-schema field. The subject trace for the same run (`--subject-trace-out`, not committed) has `scores_emitted=false`, `prompts_attached=12`, `prompts_absent=0`, sha256 `7a2663aca80a37222c1c68e6cd081e7fdfedc1ed35bee51306a43bf3c2c7b1a9`.

## Harness tests

`python3 -m pytest -q tests/regression/test_spe_benchmark_qualification_harness.py tests/regression/test_spe_benchmark_python_subject.py`

exit 0. `22 passed` in 12.64s.

`python3 -m pytest -q`

exit 0. `1040 passed` in 576.64s. Counts were not forced. No test was weakened.

## Rust frozen core

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --offline --locked`

exit 0. 41 passed, 0 failed (2 + 8 + 4 + 10 + 2 + 2 + 13). Doc-tests 0. Empty bins 0.

## WASM freeze

Two measure-only builds via `tools/wasm_canonical_build.mjs` (`SPE_WASM_MEASURE_ONLY=1`). Build B used `SPE_WASM_CANDIDATE_TARGET_DIR=/tmp/i1q-wasm-b`. `npm run build` then ran the pin-checked canonical build (`promoted=no`).

| Build | bytes | sha256 | imports |
| --- | --- | --- | --- |
| A default target | 1340112 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 0 |
| B separate target | 1340112 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 0 |
| pin-checked `npm run build` | 1340112 | same | 0 |

Exports `memory,spe_alloc,spe_evaluate,spe_free`. Pin was not updated.

## Production build

`npm run build` in `apps/web` (copy-check, canonical WASM, copy-wasm, `tsc --noEmit`, vite, cache-shell): exit 0.

`npx tsc --noEmit` in `apps/web`: exit 0.

Copied WASM, both `apps/web/public/spe_wasm.wasm` and `apps/web/dist/spe_wasm.wasm`: 1340112 bytes, sha256 `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`.

## R1V normal Chrome

Harness `apps/web/scripts/test-create-quality-r1v.mjs`. Local Playwright `chromium.launch({ channel: "chrome", headless: true })` against local Vite `dist`. Not hosted. Exit 0.

C01–C12 = 12/12 PASS. Each row: `plan=NOT_TRIGGERED`, `kept=original`, `receipt_verdict=PASS`, `compiled_is_prompt=true`, `quality_posts=1`, `surfaces_match=true`, display label `AI Assistant`. Active category matches the kernel route (`C01`/`CAT:C01` through `C12`/`CAT:C12`). Category mismatches = 0. No successful `NO_EFFECT_PLAN`.

## R1V repair Chrome

Same harness, repair arm. C01–C12 = 12/12 PASS. Each row: `attempt_index=1`, `max_attempts=1`, `plan=ACCEPTED`, `kept=repaired`, `receipt_verdict=PASS`, `surfaces_match=true`, `quality_posts=1`. `qualifyRepairedBrowserObservation` returns pass only when `quality_delta.disposition=IMPROVED`, `protected_regressions=[]`, and the visible, artifact, history, copy, JSON, and `.spe` surfaces equal the kernel-kept prompt. Errors were empty, so surface mismatches = 0.

## Mutations

| Suite | Command / gate | Result |
| --- | --- | --- |
| R1V | `tests/unit/test_xcat_r1v_mutants.py::test_r1v_mutants_are_killed` | defined=20 killed=20 survived=0 |
| Task57 | `tests/unit/test_quality_task57.py::test_mutants_killed` | passed |
| Task57R | `tests/unit/test_quality_task57r.py::test_task57r_guard_mutants_are_killed` | killed=12 |
| F1 | `tests/unit/test_quality_task57r.py::test_f1_from_k3_mutants_are_killed` | killed=`F1`,`F2`,`F3`,`F10` |
| F2 | `killedRepairedBrowserMutants()` in `apps/web/scripts/repaired-browser-qualification.mjs` | defined=10 killed=10 survived=0 (`F2-01`–`F2-10`) |
| F3 | `tests/unit/test_quality_task57r_f3.py::test_f3_mutants_are_killed` | killed=10 (`F3-01`–`F3-10`) |
| F3E | `tests/unit/test_xcat_auto_f3e.py::test_f3e_mutants_are_killed` | killed=15 |
| XCAT | `tests/unit/test_xcat_mutations_56b.py::test_all_twenty_three_mutants_killed` | defined=23 killed=23 survived=0 |
| Effect | `tests/unit/test_k3_effect.py::test_effect_mutants_are_killed` | killed=`M1`–`M11` (11) |

The eight pytest gates above passed together: `8 passed` in 17.28s, exit 0. The same F2 function also killed historical browser ids `F3-11` and `F3-12`.

## Core-B

Same Chrome harness aborted `**/spe_wasm.wasm`. `core_b=PASS`, `core_b_errors=[]`, external hosts empty. Excerpt is the safe fallback (`DEGRADED_DELIVERY`), includes the original request, and does not contain `verified`. `.spe` export count = 0. Successful `Your prompt` region count = 0.

`renderSafeFallbackPrompt` on that module returns `canonical=false`, `verified=false`, `quality_verified=false`, `semantic_engine_used=false`, `execution_authorized=false`.

## Egress

`SPE_PROOF_OUT` pointed at an untracked artifact. `node apps/web/scripts/egress-proof.mjs` exit 0.

`zero_egress=true`, `external_hosts=[]`, `fetch_during_evaluate=0`, `websocket_during_evaluate=0`, `used_ts_fallback=false`.

## Deployment gate

`node tools/deployment-safety-gate.mjs` exit 2. `HOSTING=FORBIDDEN`. `ok=false`. The gate rewrote `proofs/spe_v1_gap_closure/deployment_safety_gate.json`. That timestamped rewrite was restored with `git checkout` before this report. Final status does not include it.

## Boundary

HOSTING FORBIDDEN. DEPLOY FORBIDDEN. DO NOT MERGE. DO NOT START I2.

No production semantic source was modified. FINAL `I1_QUALIFIED_PASS`.
