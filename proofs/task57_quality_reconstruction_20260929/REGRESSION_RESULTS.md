# Regression

| Check | Result |
| --- | --- |
| Full-repo pytest | 975 passed, 0 failed, exit 0 |
| XCAT mutants M1–M23 | 23/23 killed |
| Effect mutants M1–M11 | 11/11 killed |
| `cargo test` in `spe-core-rs` | exit 0 |
| `npm run build` | exit 0 |
| `npm run test:engine` | exit 0, `used_ts_fallback` false, imports 0 |
| `npm run test:artifact` | exit 0 |
| `npm run test:create-intent` | exit 0 |
| `npm run test:execution-contract` | exit 0 |
| `npm run test:adversarial` | exit 0 |
| `npm run test:final-craft` | exit 0 |
| `npm run test:theme-routes` | exit 0 |
| `npm run test:dot-pattern` | exit 0 |
| `npm run test:capabilities-seo` | exit 0 |
| `npm run test:truth-privacy` | exit 0 |
| `npm run audit:egress` | exit 0, `zero_egress` true, `external_hosts` empty |
| `npm run test:copy` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| Deployment safety gate | exit 2, `HOSTING=FORBIDDEN` |

No hosting, DNS, or production publish was performed.
