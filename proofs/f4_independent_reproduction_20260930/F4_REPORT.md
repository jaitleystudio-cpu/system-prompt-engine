# SPE Ω F4 independent reproduction

Verification only. Candidate source remains `bd4540a9c96801168f2e7363c001a4184bad4311`.
This branch adds proof logs. It does not change production source.

DO NOT MERGE. DO NOT DEPLOY. DO NOT HOST.

## Custody

| Field | Value |
| --- | --- |
| fresh machine | `bc-29ea249f-5786-5670-b259-57b634b0fc8d` |
| session URL | https://cursor.com/agents/bc-29ea249f-5786-5670-b259-57b634b0fc8d |
| recorded at | 2026-09-29T21:54:55Z |
| origin | https://github.com/jaitleystudio-cpu/system-prompt-engine |
| default branch | `main` |
| checkout | detached `bd4540a9c96801168f2e7363c001a4184bad4311` |
| start porcelain | empty |
| previous workspace reused | no |
| OS | Ubuntu 24.04.4 LTS, Linux 6.12.94+, x86_64 |
| CPU | Intel Xeon, 4 cores |
| Python | 3.12.3 |
| pip | 24.0 |
| pytest | 9.1.1 in `/tmp/spe-f4-venv` |
| jsonschema | 4.26.0 |
| rustc | 1.98.1 commit `48a229ceaefd4985c50990b14116b6d856af0985` |
| cargo | 1.98.1 |
| Node | v22.14.0 |
| npm | 10.9.7 |
| Chrome | 148.0.7778.96 |

Absent before this run: `target/`, `apps/web/node_modules/`, `apps/web/dist/`, `portable/spe-core-rs/target/`, `portable/spe-wasm/target-canonical/`, any `spe-core-eval` binary. The tracked pin `apps/web/public/spe_wasm.wasm` was already the reviewed canonical bytes and was not treated as a build cache.

## Source identities

Git blobs and SHA-256 were recorded before tests and were unchanged after tests.

| Input | git blob | sha256 |
| --- | --- | --- |
| `spe_runtime/xcat/router.py` | `148e086b162ebb2ceab2fee2bf093b4bcd42b570` | `e9c72154689e01507b52b6fa0c2dd59f4c864a7eeeeb22dec9db7cba1ba0e3d0` |
| `spe_runtime/xcat/auto_route.py` | `64ccc5a146b2ead69f7e32c4f88951f04216cc29` | `98837cc564034b90b6e808939a156a584f127ee235aef2b64ffe72a9bebef315` |
| `portable/spe-core-rs/src/xcat.rs` | `bee9838a744365f6e84548000a2b30b5b0a62ec5` | `93ae2f69be90a60867b57d0dc3194fff2219bdbee925e6882e5fac6e53deedb4` |
| `spe_runtime/k3/selector.py` | `6b06067ecd88a9ab6094450169ad21326f5a52ac` | `8f9860c3198b720f3e3ca02e3912a1d757928e32eea2221ce6721c1080f0f6d1` |
| `spe_runtime/quality/engine.py` | `9969d41a0394ba3c2ce98a26e2a60b7275374bbe` | `1d12ebfea5849495ba4e524f21b4a6058809fab101d267935ba59bae5b0837d6` |
| `apps/web/src/engine/core-b.mjs` | `c18ecec637aaa1ebfca82d495e25e36fbfb5063d` | `75b4a42946ec892a44a4bc092f8d1373970515e004a5b8b39b4b7317f9b374de` |
| `apps/web/public/spe_wasm.wasm` | `83ecafb9853ce44d5aadcc9fb0d8bd00cf80aa5b` | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` |
| `apps/web/public/spe_wasm.sha256.json` | `0e93bc2b46e2500b24b3deedcfcbd89a580a7c2d` | `ec5561f5fbdb588a8106335593181dc401ad0cf1ba7918c7b608aeeb02e8bf45` |
| `tools/wasm_canonical_build.mjs` | `3d5de76e8652a1e345197bb27b51c97c4909a3f1` | `425c9e731641b72069e95b753ea8e74d22bdd5976078720041e922338e5f4633` |
| `apps/web/scripts/test-create-quality-r1v.mjs` | `d958dd926084924d12b4bff34a27ba62b5bb5160` | `daa13c4c14f6d72ab2498dc6cfd5d3a315f2ae645cad98b283f255522e71cdd0` |
| `apps/web/scripts/repaired-browser-qualification.mjs` | `7d791fd5cb252f66d7b2936a6dea7f20a1750c1c` | `64911adb70832f35adf172c4737a4d6c1edf584d6bf5f05bbd07ef0def62ba75` |
| `tests/unit/test_xcat_r1v_mutants.py` | `8ce1aee367fc22fe5faf37bf7b8e979f307f5191` | `2e45285b99e2520095bc973d75f514b3393d8d8777d07cc63f2ee54bb34e9528` |
| `proofs/k3_runtime_closure_20260929/K3_VECTORS.json` | `1f3840b69062c1e393214ca4fa77355103508ffd` | `563bf5cc5b454c9cf453dfdf59b98b533932633195e23eb4a98eadbee9b286c2` |

## Gates

Python command: `PYTHONPATH=/workspace python -m pytest -q` using a fresh venv. Result: 1018 passed, 0 failed, 48.23s. An earlier run of the same 1018 collected tests, without `PYTHONPATH`, failed 2 because `tools/run_context_protocol_benchmark.py` could not import `spe_runtime`. Collection count did not change. The rerun is the recorded result.

Rust: `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --offline --locked` after `cargo fetch --locked`. 41 passed, 0 failed (2 + 8 + 4 + 10 + 2 + 2 + 13; doc-tests 0). `spe-core-eval` was then removed with `cargo clean -p spe-core-rs` and rebuilt with `cargo build --offline --locked --bin spe-core-eval`. rustc compiled the binary on this machine.

WASM: `SPE_WASM_MEASURE_ONLY=1 node tools/wasm_canonical_build.mjs`, delete `portable/spe-wasm/target-canonical`, then the same command again.

| Build | sha256 | bytes | imports | exports |
| --- | --- | --- | --- | --- |
| A | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 1340112 | 0 | `memory`, `spe_alloc`, `spe_evaluate`, `spe_free` |
| B | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` | 1340112 | 0 | `memory`, `spe_alloc`, `spe_evaluate`, `spe_free` |

SHA_A equals SHA_B and equals the candidate pin. The pin was not edited.

Parity on the independent WASM, fresh `spe-core-eval`, and Python `route_mission_stage` for C01–C12, ambiguous, conflicting, multi-domain, forged category, and unknown evidence: Python↔Rust 0, Rust↔WASM 0, Python↔WASM 0. Log: `logs/parity-auto-xcat.txt`.

Historical mutants, each run separately:

| Suite | Result |
| --- | --- |
| Task57 `test_mutants_killed` | 1 passed |
| Task57R `test_task57r_guard_mutants_are_killed` | 1 passed, killed 12 |
| F1 `test_f1_from_k3_mutants_are_killed` | 1 passed, killed F1 F2 F3 F10 |
| F2 `killedRepairedBrowserMutants` | defined 10, killed 10, survived 0 (F2-01–F2-10). Same call also killed F3-11 and F3-12 |
| F3 `test_f3_mutants_are_killed` | 1 passed, killed 10 |
| F3E `test_f3e_mutants_are_killed` | 1 passed, killed 15 |
| XCAT `test_all_twenty_three_mutants_killed` | 1 passed, 23 killed, survived empty |
| Effect `test_effect_mutants_are_killed` | 1 passed, M1–M11 killed |
| R1V `test_r1v_mutants_are_killed` | 1 passed, defined 20, killed 20, survived 0 |

Web: `npm ci` then `npm run build` in `apps/web`, exit 0. `npx tsc --noEmit`, exit 0. `apps/web/dist/spe_wasm.wasm` and `apps/web/public/spe_wasm.wasm` both sha256 `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b`, 1340112 bytes.

Chrome: `node apps/web/scripts/test-create-quality-r1v.mjs` against local `dist`, Playwright `channel: chrome`, headless, exit 0. Normal C01–C12 12/12 PASS. Repaired C01–C12 12/12 PASS. Surface mismatches 0. External hosts empty. Core-B PASS: safe fallback visible, original request retained, no `verified` claim in the text, prompt region 0, `.spe` export 0. The production bundle Chrome loaded sets `canonical`, `verified`, `quality_verified`, `semantic_engine_used`, and `execution_authorized` false.

Egress: `node apps/web/scripts/egress-proof.mjs` on POS-001. `zero_egress` true, `external_hosts` [], `fetch_during_evaluate` 0, `websocket_during_evaluate` 0, `used_ts_fallback` false. The tracked egress JSON did not change.

Deployment gate: `node tools/deployment-safety-gate.mjs` exit 2, `HOSTING` FORBIDDEN. It rewrote only the `at` timestamp in `proofs/spe_v1_gap_closure/deployment_safety_gate.json`. That file was restored to the candidate blob, matching the R1V note that the gate rewrite is not part of qualification. Final `git status --porcelain` empty. HEAD still `bd4540a9c96801168f2e7363c001a4184bad4311` before this proof commit.

CI: GitHub commit status for `bd4540a9c96801168f2e7363c001a4184bad4311` has `total_count` 0 and no check runs. `CI_STATUS` = `NOT_AVAILABLE`.

## Report

```
SPE Ω F4 INDEPENDENT REPRODUCTION REPORT
========================================

MACHINE:
fresh_machine=bc-29ea249f-5786-5670-b259-57b634b0fc8d
previous_workspace_reused=false

CANDIDATE_SHA:
bd4540a9c96801168f2e7363c001a4184bad4311

SOURCE_MODIFIED=false

PYTHON:
passed=1018
failed=0

RUST:
passed=41
failed=0

WASM:
sha_a=b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b
sha_b=b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b
expected=b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b
bytes=1340112
imports=0
reproducible=yes

PARITY:
Python↔Rust=0
Rust↔WASM=0
Python↔WASM=0

NORMAL_CHROME:
C01=PASS
C02=PASS
C03=PASS
C04=PASS
C05=PASS
C06=PASS
C07=PASS
C08=PASS
C09=PASS
C10=PASS
C11=PASS
C12=PASS

REPAIRED_CHROME:
C01=PASS
C02=PASS
C03=PASS
C04=PASS
C05=PASS
C06=PASS
C07=PASS
C08=PASS
C09=PASS
C10=PASS
C11=PASS
C12=PASS

SURFACE_MISMATCHES=0

R1V_MUTANTS:
defined=20
killed=20
survived=0

HISTORICAL_MUTATIONS:
Task57=PASS
Task57R=PASS killed=12
F1=PASS killed=F1,F2,F3,F10
F2=PASS defined=10 killed=10 survived=0
F3=PASS killed=10
F3E=PASS killed=15
XCAT=PASS killed=23 survived=0
Effect=PASS killed=M1-M11 survived=0

CORE_B=PASS

EGRESS=zero_egress=true external_hosts=[] fetch_during_evaluate=0 websocket=0

BUILD=exit 0

TSC=exit 0

CI_STATUS=NOT_AVAILABLE

DEPLOYMENT_GATE=exit 2
HOSTING=FORBIDDEN

CROSS_MACHINE_MISMATCHES=none

FINAL:
F4_INDEPENDENT_REPRODUCTION_PASS
```
