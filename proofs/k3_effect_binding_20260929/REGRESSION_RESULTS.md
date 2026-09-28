# Regression results

| Command | Result |
|---|---|
| `python3 -m pytest` | 900 passed, 0 failed |
| Rust core `cargo test` | 40 passed, 0 failed |
| Rust WASM `cargo test` | 4 passed, 0 failed |
| Effect vectors | 30 normal, 20 adversarial, 0 mismatches |
| `npm run build` | exit 0 |
| `npm run test:engine` | exit 0 |
| `npm run test:artifact` | exit 0 |
| `npm run test:create-intent` | exit 0 |
| `npm run test:execution-contract` | exit 0 |
| `npm run test:adversarial` | exit 0 |
| `npm run test:final-craft` | exit 0 |
| `npm run test:theme-routes` | exit 0 |
| `npm run test:dot-pattern` | exit 0 |
| `npm run test:capabilities-seo` | exit 0 |
| `npm run test:truth-privacy` | exit 0 |
| `npm run audit:egress` | exit 0, `zero_egress: true` |
| `npm run test:copy` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `node apps/web/scripts/test-k3-effect-prompt.mjs` | pass |
| `npm run test:hero-story` | exit 1. Chromium launch looks for `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, which is not present here. Not repaired. |
| `node tools/deployment-safety-gate.mjs` | exit 2, HOSTING FORBIDDEN |

The deployment gate was not weakened. Its timestamped proof file under `proofs/spe_v1_gap_closure/` was left unchanged.
