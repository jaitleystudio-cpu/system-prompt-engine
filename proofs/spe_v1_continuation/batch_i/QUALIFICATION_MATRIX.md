# Batch I — Cross-runtime / Mutation / a11y / Perf Qualification Matrix

**Date:** 2026-09-26 (IST)  
**Base tip (Batch H PASS):** `9de22495414b530f74535423be5137d324dcce90`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44  
**HOSTING=FORBIDDEN. WORLD#1 / INDEPENDENTLY_REPLICATED=NOT_PROVEN.**

Legend: **PRESENT** / **PARTIAL** / **MISSING** / **BLOCKED**  
Scope: qualification of continuation stack A–H — not a new product feature; no hosting unlock.

| # | Area | Requirement | Pre-I | Post-I | Owner(s) / evidence path | Notes |
|---|------|-------------|-------|--------|--------------------------|-------|
| 1 | Cross-runtime | Python XCAT core invariants X01–X10 + handoff | PRESENT | PRESENT | `tests/unit/test_xcat_core.py`; logs/`python_core_mutation.txt` | 47 XCAT cases in core battery |
| 2 | Cross-runtime | Python ↔ `.spe` / context-protocol round-trip | PRESENT | PRESENT | `tests/portability/test_spe_context_protocol_roundtrip.py` | In core battery |
| 3 | Cross-runtime | Web/TS `tsc` + Vite build + cache-shell (shipped WASM) | PRESENT | PRESENT | `apps/web`; logs/`tsc.txt`, `vite_build.txt`, `cache_shell.txt` | No local WASM rebuild; F/G/H residual kept |
| 4 | Cross-runtime | WASM Node host EXECUTE conformance | PARTIAL | **PRESENT** | `tests/portability/test_wasm_reference_conformance.py`; `tools/spe_wasm_node_host.js`; existing `portable/spe-wasm/target/.../spe_wasm.wasm` | 55+/55+ via Node WASM; logs/`python_cross_runtime.txt` |
| 5 | Cross-runtime | Rust reference CLI parity + cross-language mutations | PARTIAL | **PRESENT** | `tests/portability/test_cross_language_*.py`; `test_rust_reference_conformance.py`; `portable/spe-core-rs/target/debug/spe-core-eval` | 198 passed with existing CLI |
| 6 | Mutation | Constraint/provenance/authority laundering detectors | PRESENT | PRESENT | `test_round_trip_attacks.py`; `test_mutation_controls.py`; `test_merge_gate_adversarial.py` | Detectors not weakened |
| 7 | Mutation | Batch E adversarial | PRESENT | PRESENT | `tests/unit/test_batch_e_adversarial.py` | 9 passed |
| 8 | Mutation | Batch H env adapter adversarial | PRESENT | PRESENT | `tests/unit/test_batch_h_environment_adapters.py` | 13 passed |
| 9 | Mutation | Security context-protocol adversarial | PRESENT | PRESENT | `tests/security/test_context_protocol_adversarial.py` | Included in core battery |
| 10 | Mutation | `tools/run_mutations.py` stub | BLOCKED | BLOCKED | `tools/run_mutations.py` | Stub only — not treated as suite |
| 11 | a11y | WCAG-oriented verifier | PRESENT | PRESENT | `proofs/spe_v1_gap_closure/a11y_verify.mjs`; batch_i `A11Y_CHECKLIST.md` + logs | Mac `CHROME_PATH`; 15/15 PASS |
| 12 | a11y | Theme routes + predeploy a11y_* | PRESENT | PRESENT | `test-theme-routes.mjs`; `test-predeploy-qa.mjs` | PASS |
| 13 | Perf | Bounded local asset / shell budget | PRESENT | PRESENT | `measure-assets.mjs`; logs/`measure_assets.json` | within_budget=true; **not** WORLD#1 |
| 14 | Perf | Lighthouse / external ranking | BLOCKED | BLOCKED | N/A | Not a release gate here |
| 15 | Safety | Deployment safety gate fail-closed | PRESENT | PRESENT | `tools/deployment-safety-gate.mjs` → exit **2** | HOSTING FORBIDDEN |
| 16 | Focused B–G | Hero / create / artifact / lab / execution-contract | PRESENT | PRESENT | apps/web npm scripts | All PASS |
| 17 | Copy | Reviewed inventory gate | PRESENT | PRESENT | `tools/copy-check.mjs` | 0 unreviewed / 0 violations |
| 18 | Claims | Independent replication / WORLD#1 | BLOCKED | BLOCKED | — | **NOT_PROVEN** |
| 19 | Hosting | Deploy / DNS / unlock | BLOCKED | BLOCKED | — | **FORBIDDEN** |

## Gaps closed this batch

| Gap | Action taken |
|-----|----------------|
| No `batch_i/` evidence | Matrix + report + logs under `proofs/spe_v1_continuation/batch_i/` |
| Tip not re-qualified after H | Coherent battery on `9de2249…` → green |
| WASM/Rust cross-runtime PARTIAL | Re-ran existing suites against present artifacts → PRESENT |
| a11y Mac Chrome path | `CHROME_PATH` → Google Chrome.app |

## Non-goals (unchanged)

- New runtime / second brain / Tailwind / shadcn / redesign
- Workflow edits, merge, deploy, DNS, hosting unlock
- Weakening mutation/adversarial detectors
- Claiming WORLD#1 or production perf/hosting readiness
