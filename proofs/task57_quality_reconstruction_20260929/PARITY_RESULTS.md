# Parity

`tests/portability/test_quality_parity_57.py` compares canonical JSON for every quality, reconstruction, and validation vector plus the compile-evaluate-repair-validate loop.

| Path | Result |
| --- | --- |
| Python ↔ Rust | pass |
| Rust ↔ WASM | pass, via Python ↔ WASM on the promoted artifact |
| Python ↔ WASM | pass |

Mismatches: 0.

The Rust entry is `spe_api=quality`. WASM uses the existing `spe_evaluate` export. No new WASM import was added.
