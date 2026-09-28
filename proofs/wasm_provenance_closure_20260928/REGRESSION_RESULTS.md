# Regression results

Frozen source under test: `e0497f79898689a00a30abeab67652d5f6a9193c` plus the test-contract edit. Public WASM unchanged.

| Check | Result |
| --- | --- |
| pytest full suite | 693 collected, 692 passed, 1 failed, 0 skipped. Failure is the WASM byte-identity gate only. |
| `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked --offline` | exit 0. 38 tests passed (1+8+4+10+2+13), 0 failed, 0 ignored. |
| `cargo test --manifest-path portable/spe-wasm/Cargo.toml --locked --offline` | exit 0. 4 tests passed (2 context-protocol wrapper + 2 wrapper conformance). |
| `npm run test:engine` (default POS fixture) | exit 0. `used_ts_fallback=false`, imports 0, sha256 `8d482a17…`, disposition VALID. |
| `SPE_FIXTURE_ID=NEG-001 npm run test:engine` | exit 0. `used_ts_fallback=false`, imports 0, reason `P_PROVENANCE_REMOVED`, disposition INVALID. |
| `npm run test:artifact` | exit 0. PASS artifact round-trip. |
| `npm run test:create-intent` | exit 0. |
| `npm run test:execution-contract` | exit 0. |
| `npm run test:adversarial` | exit 0. `ok: true`. |
| `npm run test:final-craft` | exit 0. |
| `npm run test:theme-routes` | exit 0. |
| `npm run test:dot-pattern` | exit 0. |
| `npm run test:hero-story` | exit 0. 62 hero checks passed. |
| `npx tsc --noEmit` (apps/web) | exit 0. |
| `npm run build` | exit 1. `copy-wasm` missing the gitignored release artifact (moved aside so it could not overwrite the public file). |
| `node tools/deployment-safety-gate.mjs` | exit 2. `HOSTING: FORBIDDEN`. |

Hero and the deployment gate rewrite proof JSON as a side effect. Those two files were restored to their pre-run bytes:

- `proofs/hero_revision/tests.json`
- `proofs/spe_v1_gap_closure/deployment_safety_gate.json`

## Separate properties

- SEMANTIC_PARITY = PASS (110/110 stdout match, imports 0, runtime errors 0, across public and B1–B6)
- BYTE_REPRODUCIBILITY = FAIL
- SOURCE_PROVENANCE = PARTIAL (introducing commit and compiler string known; exact rustc command unknown)
- RELEASE_APPROVAL to replace the public WASM = not requested and not done
- TS_FALLBACK = false
- REAL_MUTATION_ENGINE = NO (`tools/run_mutations.py` still raises `stub: run_mutations.py not implemented yet`)
- Rust `tests/negative_mutations.rs` = 2 passed
- Frozen negative conformance rows executed in the WASM compare = 55

Aikido path scan was not completed. The Aikido MCP requires sign-in (`aikido_login`) and no API key is available in this environment.
