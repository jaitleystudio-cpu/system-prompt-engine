# REPOSITORY_CUSTODY_REPORT — hostile-gym-r1 (Package A)
Generated 2026-10-13 ~00:15 IST by Grok Bot (builder). Not a verification. Builder ≠ verifier; Package I (Bro) pending.

## Custody
- Remote: github.com/jaitleystudio-cpu/system-prompt-engine
- Worktree: /Volumes/4TB-WD/spe-worktrees/spe-hostile-gym-r1, branch `grok/hostile-gym-r1`, created from `origin/main` = `3abe3df936082296b6a1ddc94923d757129cfdff` ("Fix WASM conformance job by installing wasm32 target").
- git log -5: 3abe3df9, 258c125e, 646d3765 (Merge PR #40), 59751793, 8066a2a0.
- DeepCoder checkout (/Volumes/4TB-WD/offloaded-mac-storage/home-projects/system-prompt-engine) inspected read-only: branch `repair/discovery-truth` @ 54abbeb2, many uncommitted modifications — NOT touched (only `git status`, `git fetch`, `git worktree add` metadata from it).
- candidate/2026-10-26 and release artifacts: not touched. ~100 other worktrees exist under /Volumes/4TB-WD/spe-worktrees (untouched).

## Directive-named components — existence on origin/main
| Name in directive | Found? | Real owner |
|---|---|---|
| geneticEvolver.ts | NO | none |
| promptSynthesizer.mjs | NO | real prompt renderer is `packages/web-runtime/src/render.ts` (`renderPromptArtifact`) + `envelope.ts` (`buildAbiFixture`) |
| multilingualDualPrompt.ts | NO | none (Multilingual is a render.ts recipe) |
| blindedJudgeArena.ts | NO | none |
| scripts/*.mjs tests | YES | `apps/web/scripts/{eval-fixture,egress-proof,copy-wasm,audit-deps,cache-shell,measure-assets}.mjs`; `tools/*.mjs` regressions; `tests/copy/golden-and-adversarial.mjs` |
| REAL_EVOLUTION_JOURNAL.jsonl | NO | nearest: `spe_runtime/storage/journal.py` (K7 execution journal, JSONL, `{kind, operation_id, data}`) |
| spe_wasm.wasm | YES | `apps/web/public/spe_wasm.wasm` (source `portable/spe-wasm` + kernel `portable/spe-core-rs`) |
| ProtectedIntent | NO (by that name) | equivalent: `portable/spe-core-rs/src/protected.rs` `PROTECTED_FIELDS` (15 fields: envelope_id, goal_identity, facts, provenance, uncertainties, hard_constraints, user_preferences, recommendation, authority_state, execution_grants, failures, taint_labels, sensitivity_labels, operation_id, outcome) |
| 16-law contract | NOT FOUND | nearest: `docs/ZERO_COST_PRODUCT_LAW.md` |

## WASM
- sha256 `95cf51ceab7b51ab2a459ec8a32d51e182749f8f3b51cf29c69de675a2fd0a80`, 237,900 bytes, matches `spe_wasm.sha256.json`; last changed in 8066a2a0.
- Imports: **0**. Exports: memory, spe_alloc, spe_evaluate, spe_free, __data_end, __heap_base.
- UI input limit: `maxLength={20000}` in apps/web/src/landing/Hero.tsx (no limit in WASM).

## Baseline tests at 3abe3df9 (logs in baseline/, full history in baseline/exit_codes.tsv)
| Command | Exit | Result |
|---|---|---|
| eval-fixture POS-001 / NEG-001 | 0 / 0 | ok |
| egress-proof.mjs | 0 | fetch=0, websocket=0 (in-process counters only) |
| tests/copy/golden-and-adversarial.mjs | 0 | passed (attempt 1 exit 1 = node_modules missing; fixed with `npm ci --ignore-scripts` in worktree) |
| tools/web04-prompt-regression.mjs | 0 | ok |
| tools/web04-worker-client-regression.mjs | 0 | ok |
| tools/web-integrity-regression.mjs | 0 | ok |
| tools/web-service-worker-regression.mjs | 0 | ok |
| cargo test spe-core-rs + spe-wasm | 0 / 0 | 29 passed, 0 failed (needs RUSTUP_TOOLCHAIN; no rustup default on the Mac) |
| tools/sprint5_conformance.py | 0 | ok (with PYTHONPATH=.) |
| tools/validate_repo.py | 1 | prints "stub: validate_repo.py not implemented yet" — a stub, not a gate |
| pytest tests (RUSTUP_TOOLCHAIN=1.98.1, own venv) | 1 | **501 passed, 1 failed**: `test_shipped_release_wasm_matches_kernel_artifact_hash` — local rebuild with rustc 1.98.1 gives f3b2e3f2…94584 ≠ shipped 95cf51ce…0a80. KNOWN_DEFECT/ENV: WASM build not reproducible across toolchains (CI uses dtolnay@stable, unpinned). |
Earlier pytest attempts (no pytest module; no jsonschema; no rust toolchain; wasm32 target missing on `stable`) are kept as logs and are environment failures, not code results.
