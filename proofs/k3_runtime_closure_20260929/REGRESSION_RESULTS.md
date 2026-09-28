# Regression

| Command | Exit |
|---|---|
| `python3 -m pytest -q` | 0 (776 passed) |
| `cargo test` spe-core-rs | 0 (40 passed) |
| `cargo test` spe-wasm | 0 (4 passed) |
| `npm run test:engine` | 0 |
| `npm run test:artifact` | 0 |
| `npm run test:create-intent` | 0 |
| `npm run test:execution-contract` | 0 |
| `npm run test:adversarial` | 0 |
| `npm run test:final-craft` | 0 |
| `npm run test:theme-routes` | 0 |
| `npm run test:dot-pattern` | 0 |
| `npm run test:capabilities-seo` | 0 |
| `npm run test:truth-privacy` | 0 |
| `npm run audit:egress` | 0, `zero_egress: true`, `external_hosts: []` |
| `npm run test:copy` | 0 |
| `npx tsc --noEmit` | 0 |
| `npm run build` | 0 |
| `npm run test:hero-story` | 1 — Playwright asked for `/Applications/Google Chrome.app/...`, which this Linux environment does not have |
| `node tools/deployment-safety-gate.mjs` | 2, `HOSTING: FORBIDDEN` |

The deployment gate rewrote only the timestamp in `proofs/spe_v1_gap_closure/deployment_safety_gate.json`. That file was restored so this mission does not churn an unrelated proof.

No E2E timeout was repaired.
