# Regression

| Check | Result |
|---|---|
| Full Python `PYTHONPATH=/workspace python3 -m pytest` | 865 passed, 0 failed |
| Rust `spe-core-rs` | 40 passed, 0 failed |
| Rust `spe-wasm` | 4 passed, 0 failed |
| Requirement graph vectors | 50, mismatches 0 |
| K3 vectors | 40, mismatches 0 |
| K3 mutants | 7/7 killed |
| Graph mutants | 10/10 killed |
| Cross-runtime parity | 0 / 0 / 0 |
| `npm run build` in `apps/web` | exit 0 |
| `test:engine` | exit 0 |
| `test:artifact` | exit 0 |
| `test:create-intent` | exit 0 |
| `test:execution-contract` | exit 0 |
| `test:adversarial` | exit 0 |
| `test:final-craft` | exit 0 |
| `test:theme-routes` | exit 0 |
| `test:dot-pattern` | exit 0 |
| `test:capabilities-seo` | exit 0 |
| `test:truth-privacy` | exit 0 |
| `audit:egress` | exit 0, `zero_egress` true, external hosts empty |
| copy check and `test:copy` | exit 0 |
| `tsc --noEmit` | exit 0 |
| `test:hero-story` | exit 1, Chromium missing at `/Applications/Google Chrome.app/...` (environment path, not a graph failure) |
| `node tools/deployment-safety-gate.mjs` | exit 2, `HOSTING=FORBIDDEN` |

The gate rewrites a timestamp in `proofs/spe_v1_gap_closure/deployment_safety_gate.json`. That file was restored.
