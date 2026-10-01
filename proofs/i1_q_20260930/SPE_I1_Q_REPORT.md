# SPE I1-Q report

Independent qualification of candidate `145b844d59161d54d8ea58d2586ec2cae16dbe8a` on `cursor/spe-i1-q-20260930`. This file records commands that were run in this worktree. It does not change XCAT, K3, Quality, or the WASM pin. It does not host or deploy. It does not start I2.

`I1_Q_PASS` means the gates below matched the recorded results. It is not a product benchmark score and not a hosting unlock.

## Custody

| Field | Value |
| --- | --- |
| CANDIDATE_SHA | `145b844d59161d54d8ea58d2586ec2cae16dbe8a` |
| PROOF_HEAD | the commit that adds this file, parent `145b844d59161d54d8ea58d2586ec2cae16dbe8a` |
| Branch | `cursor/spe-i1-q-20260930` |
| Start check | `git rev-parse HEAD` printed `145b844d59161d54d8ea58d2586ec2cae16dbe8a`. `git status --porcelain` was empty. |

## Rust

Command, from the repository root:

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --offline --locked`

Exit 0.

Passed tests: 41. Failed: 0.

Suite counts that make 41: lib 2, abi_transport 8, capability_contract 4, context_protocol 10, k3_selection 2, negative_mutations 2, semantic_equivalence 13. The eval binary suite and doc-tests each ran 0 tests.

Separate command, not added into the 41:

`cargo test --manifest-path portable/spe-wasm/Cargo.toml --offline --locked`

Exit 0. 4 passed, 0 failed (context_protocol_web 2, wrapper_conformance 2).

## WASM

Command:

`shasum -a 256 apps/web/public/spe_wasm.wasm`

`b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`

`wc -c` reported `1340112`.

Imports, from `WebAssembly.Module.imports` on those bytes: `0`.

The web build used for Chrome was `npx tsc --noEmit && npx vite build && node scripts/cache-shell.mjs` in `apps/web`. It did not run `tools/wasm_canonical_build.mjs`. After that build, `apps/web/dist/spe_wasm.wasm` hashed to the same SHA-256. The pin file was not edited.

## Chrome C01–C12

Command, from `apps/web`, against the local `dist` and installed Chrome (`channel: "chrome"`, headless). Not hosted.

`SPE_R1V_OUT=/tmp/spe-i1q-r1v-chrome.json node scripts/test-create-quality-r1v.mjs`

Exit 0. `error` null. `external_hosts` empty.

Normal, default AI Assistant Create: 12/12 PASS.

| Category | Status | plan | kept | receipt |
| --- | --- | --- | --- | --- |
| CAT:C01 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C02 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C03 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C04 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C05 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C06 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C07 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C08 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C09 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C10 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C11 | PASS | NOT_TRIGGERED | original | PASS |
| CAT:C12 | PASS | NOT_TRIGGERED | original | PASS |

Each normal row also had display label `AI Assistant`, `quality_posts` 1, and active category `C01` through `C12` matching the case. Errors were empty.

Repair, one-shot protected-constraint path in the same script: 12/12 PASS.

| Category | Status | plan | kept | attempt | max | receipt |
| --- | --- | --- | --- | --- | --- | --- |
| CAT:C01 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C02 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C03 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C04 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C05 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C06 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C07 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C08 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C09 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C10 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C11 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |
| CAT:C12 | PASS | ACCEPTED | repaired | 1 | 1 | PASS |

Repair errors were empty. The script accepts a repaired row only through `qualifyRepairedBrowserObservation`.

## R1V mutants

Command:

`.venv/bin/pytest tests/unit/test_xcat_r1v_mutants.py -q`

Python 3.12 virtualenv, `pip install -e ".[dev]"`. Exit 0. `1 passed` in 2.48s.

The passing test is `test_r1v_mutants_are_killed`. It appends `R1V-01` through `R1V-20` and asserts that list exactly. Defined 20. Killed 20. Survived 0.

## Core-B

The Chrome script aborted `**/spe_wasm.wasm` for `CAT:C03`. Result field `core_b` was `PASS`. `core_b_errors` was empty. Excerpt began `SPE SAFE FALLBACK spe.safe-fallback.v1` and `status: DEGRADED_DELIVERY`, and included the start of the original request.

A second local Chrome load of the same abort path, not hosted, read the page:

- safe-fallback regions present
- prompt includes `Write an executive brief about the launch.`
- prompt text does not contain `verified`
- `Your prompt` regions: 0
- buttons whose text is `.spe`: 0
- external hosts: empty

`node apps/web/scripts/test-core-b-fallback.mjs` exit 0. That run asserted `canonical` false, `verified` false, and `quality_verified` false on `renderSafeFallbackPrompt`. The bundle served to Chrome (`dist/assets/index-DfairO20.js`) contains the same fallback object with `canonical:!1`, `quality_verified:!1`, and `verified:!1`.

## Egress

Command, from `apps/web`:

`node scripts/egress-proof.mjs`

Exit 0.

`zero_egress` true. `fetch_during_evaluate` 0. `websocket_during_evaluate` 0. `external_hosts` empty. `used_ts_fallback` false. `engine_error` null.

## Deployment gate

Command, from the repository root:

`node tools/deployment-safety-gate.mjs`

Exit 2.

Stdout: `ok` false, `HOSTING` `FORBIDDEN`, failed checks `ddos_protection`, `bandwidth_spend_ceiling`, `tls`, `security_headers_live`, `cache_policy`, `abuse_protection`, `no_unlimited_billing`, `founder_unlock`.

The gate rewrote the timestamp in `proofs/spe_v1_gap_closure/deployment_safety_gate.json`. That rewrite was restored with `git checkout -- proofs/spe_v1_gap_closure/deployment_safety_gate.json` before this report. Exit 2 is the fail-closed result. It is not a hosting pass.

## Benchmark unknown law

Commands:

`.venv/bin/python tools/run_spe_benchmark.py --check-hashes`

Exit 0. `hashes=OK`, `frozen_files=11`, `measurement_default=UNKNOWN`, `scores_included=false`.

`.venv/bin/python tools/run_spe_benchmark.py --fixture-only`

Exit 0. `fixture_structure=VALID`, `marked_pass_count=0`, `harness_invented_scores=false`, `human_ratings_aggregated=false`, `network_used=false`, `provider_calls=0`. All 12 compared cases printed `spe_prompt=UNKNOWN` and `measurement_statuses=UNKNOWN`.

`.venv/bin/python tools/run_spe_benchmark.py --subject python-reference --format json`

Exit 0. `mode=offline-record`, `measurement_default=UNKNOWN`, `marked_pass_count=0`, `harness_invented_scores=false`, `human_ratings_aggregated=false`, `network_used=false`, `provider_calls=0`. Every measurement `status` in the JSON was `UNKNOWN` (576 statuses, 0 other). All 12 comparison pairs attached a compiled `spe_prompt`. That attachment is not a score.

`.venv/bin/pytest tests/regression/test_spe_benchmark_qualification_harness.py tests/regression/test_spe_benchmark_python_subject.py -q`

Exit 0. `22 passed` in 4.59s.

## Boundary

No production semantic source was modified. FINAL `I1_Q_PASS`.

HOSTING FORBIDDEN. DO NOT MERGE. DO NOT START I2.
