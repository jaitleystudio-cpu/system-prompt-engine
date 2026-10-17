# Task57R-F3E-R1V parity

**Base SHA:** `f07511d9e2def7aa7129fa2c718b76e4ec9f1407`
**Evidence SHA:** `ea116665599d9ff1317eeea83a05d649ecc21192`

## WASM

| Field | Value |
| --- | --- |
| sha256 | `b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b` |
| size | 1340112 |
| imports | 0 |
| exports | `memory`, `spe_alloc`, `spe_evaluate`, `spe_free` |
| reproducible | yes |
| rustc | 1.98.1 commit `48a229ceaefd4985c50990b14116b6d856af0985` |
| target | `wasm32-unknown-unknown` |

`npm run build` in `apps/web` ran `tools/wasm_canonical_build.mjs`. The measured artifact matched the pin. The build reported `promoted=no`. `apps/web/public/spe_wasm.sha256.json` matches those bytes. Supply-chain tests in the full pytest run also passed.

## AUTO routes

After `cargo build --locked --bin spe-core-eval`, these payloads agree on `primary_category` and `disposition` across Python `route_mission_stage`, the Rust binary, and `node tools/spe_wasm_node_host.js apps/web/public/spe_wasm.wasm`:

- closure goals `CAT:C01` through `CAT:C12` (R1V-10)
- `Help with this soon.` → `NEEDS_DISAMBIGUATION`, primary null
- research-and-write → primary `CAT:C02`

`parity_py_rs` = match
`parity_rs_wasm` = match
`parity_py_wasm` = match

## Frozen K3

`proofs/k3_runtime_closure_20260929/K3_VECTORS.json` sha256 remains `563bf5cc5b454c9cf453dfdf59b98b533932633195e23eb4a98eadbee9b286c2`. N01 expectation stays `SAFE_DEFAULT` with a null category. `select_prompt_techniques` on `Summarize the supplied notes.` with a null category stays `SAFE_DEFAULT` and `xcat_id` null (R1V-19). The full pytest run includes the existing K3 and XCAT portability tests.

## Suites

| Suite | Result |
| --- | --- |
| `python3 -m pytest -q` | 1018 passed, 0 failed, exit 0, 53.07s |
| `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --offline --locked` | 41 passed, 0 failed, exit 0 (2 + 8 + 4 + 10 + 2 + 2 + 13; doc-tests 0) |

## Egress and deploy gate

`node apps/web/scripts/egress-proof.mjs` on fixture `POS-001`: `zero_egress` true, `external_hosts` [], `fetch_during_evaluate` 0, `websocket_during_evaluate` 0, `used_ts_fallback` false. Exit 0.

`node tools/deployment-safety-gate.mjs` exit 2. `HOSTING` = `FORBIDDEN`. The gate's JSON rewrite under `proofs/spe_v1_gap_closure/` was reverted and is not part of this qualification.
