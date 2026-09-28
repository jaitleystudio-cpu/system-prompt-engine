# Parity

Vectors: 25 normal (`N01`–`N25`) and 15 adversarial (`A01`–`A15`) in `K3_VECTORS.json`.

Comparison is canonical JSON of the full K3 object, including `selection_id`.

| Pair | Mismatches |
|---|---|
| Python ↔ Rust `spe-core-eval` | 0 |
| Python ↔ WASM `spe_evaluate` on reproduced `8b49bf3c…` | 0 |
| Rust ↔ WASM | 0 (both matched Python) |

Rust crate test `frozen_vectors_match_technique_ids_and_disposition` also checked disposition and technique ids against the same file.
