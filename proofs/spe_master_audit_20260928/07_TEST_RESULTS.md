# Test results

SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`
Working directory: `/workspace` unless noted.
Python oracle: blocked. Rust online tests: passed. Official full build: blocked. Vite build: passed.

| Command | Exit | Result | Duration | Notes |
| --- | --- | --- | --- | --- |
| apps/web npm run test:adversarial | 0 | PASS | 1.3s | source cases |
| apps/web npm run test:artifact | 0 | PASS | 0.4s | round-trip + bounded reconstruction |
| apps/web npm run test:capabilities-seo | 0 | PASS | 0.2s | robots, sitemap, FAQPage, honest wording |
| apps/web npm run test:copy | 0 | PASS | 1.4s | 2361 candidates, 0 unreviewed, 0 violations |
| apps/web copy-check via official build | 0 | PASS | inside build | same copy gate, then build failed later |
| apps/web npm run test:create-intent | 0 | PASS | 0.3s | Desired Output + Example |
| node apps/web/scripts/test-daily-hero.mjs | 0 | PASS | 0.1s | not an npm script name |
| node tools/deployment-safety-gate.mjs | 2 | FAIL closed | <1s | HOSTING FORBIDDEN; expected |
| apps/web npm run audit:deps | 0 | PASS | 0.2s | free_deps_only, banned_hits [] |
| apps/web npm run test:dot-pattern | 0 | PASS | 0.2s | |
| apps/web npm run test:e2e:v1 | 1 | FAIL | 31.8s | homepage vision bytes zero passed; Create button timeout |
| apps/web npm run audit:egress | 0 | PASS | 0.2s | zero_egress true |
| apps/web npm run test:engine | 0 | PASS | 0.2s | wasm fixture VALID |
| apps/web npm run test:execution-contract | 0 | PASS | 0.3s | |
| apps/web npm run test:final-craft | 0 | PASS | 0.2s | |
| apps/web npm run test:lab-acquisition | 0 | PASS | 0.3s | |
| apps/web npm run test:media | 0 | PASS | 0.4s | |
| apps/web npm run test:predeploy-qa | 0 | PASS | 0.5s | a11y source, csp, sw, speech |
| apps/web npm run test:screenshot-fidelity | 0 | PASS | 0.5s | |
| apps/web npm run test:screenshot-real | 0 | PASS | 0.8s | |
| apps/web npm run test:speech | 0 | PASS | 0.2s | |
| speech fallback contract | 0 | PASS | | VERIFIED_GRACEFUL_FALLBACK |
| apps/web npm run test:theme-routes | 0 | PASS | 0.2s | |
| apps/web npx tsc --noEmit first | 2 | FAIL | 1.7s | race with CopyGateProbe.tsx |
| apps/web npx tsc --noEmit rerun | 0 | PASS | | TSC2_EXIT:0 |
| apps/web npm run test:video-scenes | 0 | PASS | 0.2s | |
| python3 -m pytest | 1 | BLOCKER | | No module named pytest |
| cargo test --offline spe-core-rs | 101 | FAIL | | serde_json not in local registry |
| cargo test spe-core-rs online | 0 | PASS | ~8.5s compile + tests | 38 tests |
| hero story first | 1 | FAIL | | preview HTTP failure while dist was rebuilt |
| hero story second | 0 | PASS | | 62 checks |
| apps/web npm run build | 1 | BLOCKER | | missing wasm32 release artifact |
| apps/web npx vite build | 0 | PASS | 5.31s | dist gitignored |
| Chromium massive baseline | 0 | PASS as measurement | | not a product harness |

Logs: `proofs/spe_master_audit_20260928/logs/`.

Hero proof JSON and deployment-gate JSON were restored after those commands dirtied them. They are not part of the audit commit.
