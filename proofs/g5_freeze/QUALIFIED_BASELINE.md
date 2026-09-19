# SPE Ω v2.4.1 — QUALIFIED BASELINE

**Pack:** G5-FREEZE  
**Qualification HEAD:** `99173c2f700508c6c958b5d79e8bc17418f9bfd6`  
**Git tag:** `spe-v2.4.1-g5-qualified`  
**Manifest:** `proofs/g5_freeze/QUALIFICATION_MANIFEST.json`  
**Verify:** `python tools/verify_g5_checkpoint.py`

---

## Qualified within recorded scopes

| Gate | Status |
|------|--------|
| G1 | BOUND_AND_PASS |
| G2 | MODEL_CHECKED_WITHIN_DECLARED_FINITE_SCOPE |
| G3 | DURABLE_RING1_VERIFIED_WITHIN_TESTED_LOCAL_SCOPE |
| G4 | ZERO_COST_CORE_ENGINE_VERIFIED_WITHIN_TESTED_SCOPE |
| G5 | ZERO_COST_LOCAL_FAULT_RESILIENCE_VERIFIED_WITHIN_TESTED_SCOPE |
| G4X | OPTIONAL / DEFERRED |

## Zero-cost / vendor boundary (tested scope)

| Requirement | Value |
|-------------|-------|
| Mandatory paid providers | 0 |
| Mandatory cloud | 0 |
| Mandatory API keys | 0 |
| Core vendor dependency | none within tested scope |
| Additional owner spend for G5/G5-E | ₹0 / $0 |

## Recorded regression

| Suite | Result |
|-------|--------|
| `python -m pytest` (repository-wide) | 986/986 PASS · exit 0 |
| Targeted WASM qualification | 120/120 PASS · exit 0 |
| G5 chaos mutants | 12/12 killed |
| Prior RED (preserved) | 986 / 871 / 115 / exit 1 — toolchain-prerequisite chain (`wasm32` → `/usr/bin/node`) |

## Custody

| Artifact | Value |
|----------|-------|
| Working contract SHA-256 | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |
| G2 model SHA-256 | `15b20a8532d3375c2d59dc8608c9c8854ff5ec7ecfcdefdb32902f0e6127e562` |
| PR #6 | OPEN @ `4e6c694` — UNTOUCHED / UNMERGED |

## Not qualified

- production deployment
- physical power loss
- security red team
- real-user product value (G6)
- competitive leadership / World #1
- all OS / filesystem equivalence
- universal fault tolerance

**SIGKILL PASS ≠ physical power-loss proof.**

## STOP (binding until explicitly lifted)

- NO G6
- NO G4X paid provider requirement
- NO PR #6 merge
- NO `spe_runtime/omega/`

## Exact earned claim (G5)

The zero-cost SPE core preserved the tested semantic, artifact-integrity, offline, fail-closed, concurrency, and bounded-execution properties under the recorded local input, storage, process-crash, resource, network-loss, and corruption scenarios, with the complete repository regression passing after satisfying the recorded zero-cost local toolchain prerequisites.
