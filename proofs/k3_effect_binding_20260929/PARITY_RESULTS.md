# Parity results

| Pair | Mismatches |
|---|---|
| Python ↔ Rust | 0 |
| Rust ↔ WASM | 0 |
| Python ↔ WASM | 0 |

Coverage:

- Existing K3 selector vectors, now including `prompt_effect_plan`
- 30 normal effect vectors
- 20 adversarial effect vectors

`tests/portability/test_k3_cross_runtime.py` and `tests/portability/test_effect_vectors.py` both passed against `apps/web/public/spe_wasm.wasm`.
