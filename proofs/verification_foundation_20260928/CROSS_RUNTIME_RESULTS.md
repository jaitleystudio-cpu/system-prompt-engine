# Cross-runtime results

Semantic comparison was executed. Byte identity of the WASM file was not.

## Python ↔ Rust

**PASS**

Executed inside the canonical pytest suite:

- `tests/portability/test_cross_language_determinism.py`
- `tests/portability/test_rust_reference_conformance.py`
- `tests/portability/test_context_protocol_vectors.py::test_rust_matches_frozen_vectors_zero_mismatch`
- `tests/portability/test_sprint5_merge_gate_differential.py` (Python oracle, native Rust, and Node WebAssembly)

These tests were among the 690 passed. They were not in the three failures.

## Rust ↔ WASM

**PASS** (semantic)

- The differential suite above runs `run_wasm_case()` against the gitignored release artifact built on this machine (rustc 1.83.0, sha256 `27c73e90…`).
- A separate Node host comparison (`tools/spe_wasm_node_host.js`) evaluated all 55 positive and 55 negative `data/conformance` cases on three binaries:
  - tracked public wasm, rustc 1.98.1, `8d482a17…`
  - local rustc 1.83.0 build, `27c73e90…`
  - remapped rustc 1.98.1 build, `55d61171…`
- Result: 110 cases, 0 runtime errors, 0 stdout mismatches.

Byte hash of those three binaries still differs. Semantic agreement is not byte reproducibility.

## Python ↔ WASM

**PASS** (semantic)

Same differential suite and the same 110-case three-binary comparison. Python oracle output was already required to match the 1.83.0 WASM by the passing portability tests. That WASM's stdout matched the tracked public WASM on all 110 cases.

## Engine fixture

`apps/web` `npm run test:engine` (`node scripts/eval-fixture.mjs`) loads the tracked public file and checks it against `apps/web/public/spe_wasm.sha256.json`.

POS-001: disposition VALID, authority NONE level 0, phases through `evaluating`, imports 0, sha256 `8d482a17…`, `used_ts_fallback` false. Exit 0.

NEG-001 (`SPE_FIXTURE_ID=NEG-001`): disposition INVALID, reason `P_PROVENANCE_REMOVED`, `used_ts_fallback` false. Exit 0.

`loadAndEvaluate` refuses to instantiate on SHA-256 mismatch and has no TypeScript semantic fallback. The new binaries were compared with `spe_wasm_node_host.js`, which also rejects host imports and does not synthesize protocol fields.

USED_TS_FALLBACK = false

## Not claimed

No executable comparison was treated as parity for K3, missing XCAT categories, Massive Intent, or a real mutation engine. `tools/run_mutations.py` remains a stub.
