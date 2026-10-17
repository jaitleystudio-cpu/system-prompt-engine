# Parity results

Candidate sha256: `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` (671621 bytes).

Legacy sha256: `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830` (671614 bytes).

Byte equality: NO.

Semantic parity is not byte reproduction.

## Module surface

Both modules import nothing. Both export `memory`, `spe_alloc`, `spe_evaluate`, `spe_free`.

## Conformance vectors

Command: `python tools/wasm_candidate_vectors.py <artifact>`.

The harness does not call `ensure_wasm_artifact` and does not read the public hash manifest. Positive cases use protected-field equivalence. Negative cases use exact reason codes and `INVALID` disposition. That is the same split the existing WASM suite uses.

| Comparison | Candidate | Legacy public module |
| --- | --- | --- |
| Positive vectors | 55 | 55 |
| Negative vectors | 55 | 55 |
| Python ↔ Rust mismatches | 0 | 0 |
| Rust ↔ WASM mismatches | 0 | 0 |
| Python ↔ WASM mismatches | 0 | 0 |
| Negative reason mismatches | 0 | 0 |
| Authority mismatches | 0 | 0 |
| Protocol / operation_id mismatches | 0 | 0 |
| Semantic mismatches | 0 | 0 |
| Runtime errors | 0 | 0 |
| Result | 110 / 110 | 110 / 110 |

## Engine fixtures

Legacy fixture uses `npm run test:engine` against the tracked public module.

Candidate fixture uses `node tools/wasm_candidate_engine_fixture.mjs` and passes the candidate's own sha256 as `expectedSha256`. It does not consult `apps/web/public/spe_wasm.sha256.json`.

| Fixture | Module | used_ts_fallback | imports | status | reason |
| --- | --- | --- | --- | --- | --- |
| POS-001 | legacy | false | 0 | VALID | none |
| NEG-001 | legacy | false | 0 | INVALID | P_PROVENANCE_REMOVED |
| POS-001 | candidate | false | 0 | VALID | none |
| NEG-001 | candidate | false | 0 | INVALID | P_PROVENANCE_REMOVED |

SEMANTIC_PARITY = PASS.
