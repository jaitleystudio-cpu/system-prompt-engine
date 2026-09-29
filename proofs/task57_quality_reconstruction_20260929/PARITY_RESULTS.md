# Parity

`tests/portability/test_quality_parity_57.py` compares canonical JSON for every quality, reconstruction, and validation vector plus the compile-evaluate-repair-validate loop.

| Path | Result |
| --- | --- |
| Python ↔ Rust | pass |
| Rust ↔ WASM | pass, via Python ↔ WASM on the promoted artifact |
| Python ↔ WASM | pass |

Mismatches: 0.

The Rust entry is `spe_api=quality`. WASM uses the existing `spe_evaluate` export. No new WASM import was added.

## Task57R-F1

`tests/portability/test_quality_parity_57r.py` compares the full `from_k3` object, including `reconstruction`, for caller-flag, witnessed, execute, accepted-repair, protected-regression, no-deficit, and unrepairable cases.

| Path | Result |
| --- | --- |
| Python ↔ Rust | 0 mismatch |
| Rust ↔ WASM | 0 mismatch |
| Python ↔ WASM | 0 mismatch |

F2 does not change the kernel. Those parity figures stay the F1 result. The F2 browser fault is a product observation, not a new semantic payload.
