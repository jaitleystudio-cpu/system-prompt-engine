# PARITY

Subject: independently built candidate  
`9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` (671621 bytes)

Recorded separately from the same harness run as CONFORMANCE.md (`tools/wasm_candidate_vectors.py`).

## Cross-runtime

| Comparison | Mismatches | Result |
| --- | --- | --- |
| Python ↔ Rust | 0 | PASS |
| Rust ↔ independent candidate WASM | 0 | PASS |
| Python ↔ independent candidate WASM | 0 | PASS |

Additional counters from the same run:

| Counter | Value |
| --- | --- |
| negative_reason_mismatches | 0 |
| authority_mismatches | 0 |
| protocol_mismatches | 0 |
| semantic_mismatches | 0 |
| runtime_errors | 0 |

## Notes

- Candidate was the only WASM subject under test.
- Tracked legacy public module was not substituted.
- No undeclared production Python dependencies were installed.

PARITY = PASS
