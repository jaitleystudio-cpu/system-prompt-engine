# Supply-chain negatives

File: `tests/release/test_wasm_canonical_supply_chain.py` — **11 passed**.

| Case | Expected | Result |
| --- | --- | --- |
| A. wrong candidate hash → copy-wasm fails | non-zero; public unchanged | PASS |
| B. candidate missing → copy-wasm fails | non-zero; public unchanged | PASS |
| C. wrong/floating Rust toolchain → canonical build fails | exit 2 | PASS |
| D. candidate manifest must match reviewed hash | assert on committed manifest | PASS |
| E. arbitrary `portable/spe-wasm/target` cannot be publish path | copy-wasm source is target-canonical only; arbitrary target dir rejected by build | PASS |
| F. absolute path contamination rejected | markers checked in build + copy | PASS |
| G. imports unexpectedly nonzero | build + copy fail-closed | PASS (imports gate) |
| H. public hash mismatch → runtime fails closed | `SPE_TAMPER_SHA=1` → `WASM_INTEGRITY_MISMATCH` | PASS |
| I. TypeScript semantic fallback unavailable | engine fixture `used_ts_fallback=false`; tamper does not fall back | PASS |
| Wrong target triple rejected | exit 2 | PASS |
| Dirty planted candidate rebuilt | rebuild returns canonical hash; public untouched | PASS |
| package.json wires canonical before copy | build script order asserted | PASS |

No fallback to old public WASM. No fallback to TypeScript semantics.
