# Regression results — Task 56B (partial fill)

**Date:** 2026-09-29  
**Branch:** `cursor/spe-xcat-v1-closure-20260929`

## Filled this session

| Suite | Command / scope | Result |
|-------|-----------------|--------|
| XCAT domain | `test_xcat_domain_56b.py` | 22 collected; passed in aggregate 148 |
| XCAT vectors | `test_xcat_vectors_56b.py` | 5 collected; passed |
| XCAT mutations | `test_xcat_mutations_56b.py` | 16/16 killed; 17 tests passed |
| XCAT parity | `test_xcat_parity_56b.py` | 0/0/0 mismatches; 3 passed |
| K3 runtime | `test_k3_runtime.py` | 68 collected; passed in aggregate |
| K3 effect | `test_k3_effect.py` | 33 passed; effect mutants 11/11 |
| Aggregate above | pytest -q (six files) | **148 passed** |
| Rust crate | `cargo test -q` in `portable/spe-core-rs` | **41 passed**, 0 failed (observed) |
| WASM custody | sha256 / bytes / imports | `623b7ac4…` / 1022578 / 0 |

## Placeholder / TBD (not run or not completed in this proof turn)

| Suite | Status |
|-------|--------|
| Full-repo `pytest` (entire tree) | **TBD** |
| Official web build / Playwright / browser regression | **TBD** |
| Deployment-safety-gate re-run | **TBD** (HOSTING FORBIDDEN; gate not weakened) |
| Independent WASM rebuild from clean tree in this turn | **TBD** (artifact hash accepted from prior 56B commit custody) |
| Quality Delta / Plan B / VALIDATE_ONLY | **NOT RUN — out of scope** |

Parent may fill TBD rows after longer suites complete. Do not treat TBD as pass.
