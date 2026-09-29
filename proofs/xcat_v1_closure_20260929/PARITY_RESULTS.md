# Parity results — Python ↔ Rust ↔ WASM

**Date:** 2026-09-29  
**Suite:** `tests/portability/test_xcat_parity_56b.py`  
**Rust module:** `portable/spe-core-rs/src/xcat.rs`  
**WASM artifact:** sha256 `d87a9d2ce1b2e789e7cb2869c686e6f719b39bdc753df509cb5244a07034b75a`

## Mismatches

| Pair | Mismatches |
|------|------------|
| Python ↔ Rust | **0** |
| Python ↔ WASM | **0** |
| Rust ↔ WASM | **0** |

**Parity: Python↔Rust↔WASM = 0 mismatches**

Observed this session: **3 passed** in `test_xcat_parity_56b.py`.

## Scope

Parity covers DOMAIN taxonomy migration reject, route dispositions, and `apply_category_payload` / validate paths exposed through the portable `spe_api=xcat` surface. Historical WASM `48ad95f5…` is pre-XCAT effect-binding and does **not** prove this parity set (`WASM_PROVENANCE.md`).
