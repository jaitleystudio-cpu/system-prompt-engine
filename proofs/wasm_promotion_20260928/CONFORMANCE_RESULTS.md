# Conformance results

## Canonical promoted public WASM

Artifact: `apps/web/public/spe_wasm.wasm`

Command:

```
python3 tools/wasm_candidate_vectors.py apps/web/public/spe_wasm.wasm
```

| Metric | Value |
| --- | --- |
| positive | 55 |
| negative | 55 |
| total | 110 |
| semantic_mismatches | 0 |
| runtime_errors | 0 |
| imports | 0 |
| exports | memory, spe_alloc, spe_evaluate, spe_free |
| sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| pass | true |

## Parity

| Pair | Mismatches |
| --- | ---: |
| Python ↔ Rust | 0 |
| Rust ↔ WASM | 0 |
| Python ↔ WASM | 0 |

## Pytest portability suite

`tests/portability/test_wasm_reference_conformance.py`: 117 passed
(includes helper/meta tests beyond the 110 vectors).
