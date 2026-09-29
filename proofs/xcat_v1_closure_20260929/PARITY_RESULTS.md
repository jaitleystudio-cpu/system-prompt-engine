# Parity results — Python ↔ Rust ↔ WASM

**Date:** 2026-09-29  
**Suite:** `tests/portability/test_xcat_parity_56b.py`  
**Rust module:** `portable/spe-core-rs/src/xcat.rs`  
**WASM artifact:** sha256 `077a4a399aaf598fd4ed3365f89cf6e32fcf64918a6c5f13319317823b4e3082`

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
