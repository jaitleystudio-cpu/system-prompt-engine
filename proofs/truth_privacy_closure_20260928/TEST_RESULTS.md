# TEST RESULTS

| Suite | Result |
|---|---|
| `npm run build` | PASS exit 0 |
| public WASM sha256 | `9325f9ec82815f1d3e5dbb3923997244e9190755168d23690140944575dbf6c6` |
| `used_ts_fallback` (engine) | false |
| `npm run test:engine` | PASS |
| `npm run test:artifact` | PASS |
| `npm run test:create-intent` | PASS |
| `npm run test:execution-contract` | PASS |
| `npm run test:adversarial` | PASS |
| `npm run test:final-craft` | PASS |
| `npm run test:theme-routes` | PASS |
| `npm run test:dot-pattern` | PASS |
| `npm run test:capabilities-seo` | PASS |
| `npm run test:media` | PASS |
| `npm run test:screenshot-fidelity` | PASS |
| `npm run test:screenshot-real` | PASS |
| `npm run test:predeploy-qa` | PASS |
| `npm run audit:egress` | PASS |
| `npm run test:truth-privacy` | PASS |
| `npm run test:home-bound` | PASS (silent_loss=NO) |
| `npm run test:copy` / copy-check | PASS |
| `node scripts/test-daily-hero.mjs` | PASS |
| `tsc --noEmit` | PASS |
| Python `pytest` | **704 passed** |
| Rust `spe-core-rs` cargo test | PASS |
| Rust `spe-wasm` cargo test (host) | PASS |
| `test:hero-story` | SKIP/FAIL env — expects macOS Chrome path; recorded separately |
| `node tools/deployment-safety-gate.mjs` | exit **2**, `HOSTING=FORBIDDEN` |

## Acceptance gates

| Gate | Status |
|---|---|
| URL_CSP_CONTRADICTION | CLOSED |
| REMOTE_FETCH_OVERCLAIM | CLOSED |
| HOME_SILENT_TRUNCATION | NO |
| HOME_20001_TEST | PASS |
| HOME_100K_OVERFLOW_TEST | PASS |
| DESIRED_OUTPUT_SILENT_TRUNCATION | NO |
| EXAMPLE_SILENT_TRUNCATION | NO |
| URL_SOURCE_TRUNCATION_DISCLOSED | YES |
| SCREENSHOT_TO_CODE_CLAIMS | TRUTHFUL |
| PRIVACY_COPY_MATCHES_RUNTIME | YES |
| UNEXPECTED_EGRESS | NONE |
| PRIVATE_PROMPT_TELEMETRY | NONE |
| PUBLIC WASM SHA | MATCH |
| OFFICIAL BUILD | PASS |
| SEMANTIC ENGINE CHANGES | NONE |
| HOME VISUAL REDESIGN | NONE |
| DEPLOYMENT GATE | 2 |
| HOSTING | FORBIDDEN |
