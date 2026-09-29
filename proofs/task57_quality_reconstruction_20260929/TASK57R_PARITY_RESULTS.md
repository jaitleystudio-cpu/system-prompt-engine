# Task57R parity

`tests/portability/test_quality_parity_57.py` and `tests/portability/test_quality_parity_57r.py` passed inside the full pytest run.

- Python ↔ Rust: pass for Task57 quality ops and Task57R `from_k3`.
- Python ↔ WASM: pass against shipped `spe_wasm.wasm`.
- Rust ↔ WASM: the same payloads matched both, so the three-way JSON equality holds for those payloads.

Vector files are the shared input:

| File | count | normal | adversarial | padding rows |
| --- | --- | --- | --- | --- |
| QUALITY_VECTORS.json | 38 | 9 | 29 | 0 |
| RECONSTRUCTION_VECTORS.json | 18 | 6 | 12 | 0 |
| VALIDATE_ONLY_VECTORS.json | 21 | 1 | 20 | 0 |

`q-goal-*`, `r-normal-*`, `v-normal-*`, and `a-loop-*` padding ids are gone.
