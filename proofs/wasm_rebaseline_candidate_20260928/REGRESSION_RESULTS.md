# Regression results

Qualification date: 2026-09-28. Public wasm and `apps/web/public/spe_wasm.sha256.json` were hashed before and after. Both stayed at legacy sha256 `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` and manifest sha256 `c5d4c55574a2077bc02cbd5df8356e589e94bd5984583d11623ebc0b1e6e126d`.

## Python

Collected 700. Passed 699. Failed 1. Skipped 0.

The only failure is `tests/web/test_web_architecture_gates.py::test_shipped_release_wasm_matches_kernel_artifact_hash`. It compares the tracked public module with the gitignored default-target wasm when that file exists. That default-target file is not the canonical candidate. The assertion was not weakened.

`PYTHON_NON_HASH_FAILURES = 0`.

Two frozen-copy tests were realigned to the already-shipped Daily Lab kicker and Privacy nav label (`1a8ec2e`). That is the same test-only contract closed on the provenance branch. No UI source was edited.

## Rust

`cargo test --manifest-path portable/spe-core-rs/Cargo.toml --offline`: 38 passed, 0 failed.

`cargo test --manifest-path portable/spe-wasm/Cargo.toml --offline`: 4 passed, 0 failed.

## Cross-runtime and fixtures

Candidate and legacy modules: 55 positive and 55 negative, 0 mismatches, 0 runtime errors. See `PARITY_RESULTS.md`.

Engine fixture POS-001 and NEG-001 passed on the legacy public module (`used_ts_fallback=false`, imports 0) and on the candidate (same, candidate sha256 `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6`).

## Web checks

| Command | Exit |
| --- | --- |
| `npm run test:artifact` | 0 |
| `npm run test:create-intent` | 0 |
| `npm run test:dot-pattern` | 0 |
| `npm run test:execution-contract` | 0 |
| `npm run test:adversarial` | 0 |
| `npm run test:final-craft` | 0 |
| `npm run test:theme-routes` | 0 |
| `npm run test:hero-story` | 0 (62 hero checks) |
| `npx tsc --noEmit` | 0 |

Hero and the deployment gate rewrite proof JSON as a side effect. Those files were restored to their pre-run bytes.

## Official build

`npm run build` exit 1. Copy-check passed. `copy-wasm` then stopped because the gitignored default target wasm was absent. That is the expected Stage A blocker. The canonical candidate lives under `portable/spe-wasm/target-canonical/` and is not an input to `copy-wasm`.

`OFFICIAL_BUILD = EXPECTED_BLOCKED_PENDING_PROMOTION`.

## Deployment gate

`node tools/deployment-safety-gate.mjs` exit 2. `HOSTING = FORBIDDEN`.

## Aikido

Path scan of the new first-party build files was attempted. The scanner requires an interactive sign-in on this machine and did not run. No API key was present. This is recorded as not completed, not as a clean scan.
