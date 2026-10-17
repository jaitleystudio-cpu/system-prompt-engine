# Rust results — XCAT portable core

**Date:** 2026-09-29  
**Crate:** `portable/spe-core-rs`  
**Primary module:** `src/xcat.rs` (~1001 lines)  
**Command:** `cargo test -q` (crate root)

## Summary

`cargo test` completed successfully this session. Observed suite results (aggregate of crate test binaries):

| Suite slice (representative) | Result |
|------------------------------|--------|
| lib / unit slices | ok |
| integration / protocol slices | ok |
| **Total tests observed across binaries** | **41 passed** (2+8+4+10+2+2+13; empty bins 0) |
| Failed | **0** |

Exact binary split may vary by feature flags; no failures recorded in the 56B proof run.

## XCAT surface

Rust implements taxonomy migration reject, mission-stage routing, and `apply_category_payload` / envelope validation parity with Python. WASM builds consume this crate (`spe_api=xcat`).

## Note

This document does not claim a full workspace `cargo test --workspace` result. Prefer crate-local evidence above.
