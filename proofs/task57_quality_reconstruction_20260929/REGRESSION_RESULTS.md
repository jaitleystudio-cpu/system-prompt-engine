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

## Task57R-F1

| Check | Result |
| --- | --- |
| Full-repo pytest | 999 passed, 0 failed, exit 0 |
| XCAT mutants M1–M23 | still inside that pytest run |
| Effect mutants M1–M11 | still inside that pytest run |
| `cargo test --offline` in `spe-core-rs` | 41 passed, 0 failed, exit 0 |
| `npm run build` | exit 0, reproduced `dfdad1270bb11e9325c3676c1ae9f00ae1df7f47071feb0b1ccda8ff96b78541` |
| listed web npm scripts, copy, egress, `tsc --noEmit` | exit 0 |
| `npm run audit:egress` | `zero_egress` true, `external_hosts` empty, `fetch_during_evaluate` 0 |
| Deployment safety gate | exit 2, `HOSTING=FORBIDDEN` |

## Task57R-F2

Kernel sources were not changed. Pytest stayed 999 passed, 0 failed. `cargo test --offline` was 41 passed, 0 failed. Web npm scripts, copy, egress, and `tsc --noEmit` exited 0. Egress remained `zero_egress` true.

The repaired browser script exits 2 on purpose. Chrome observed the fault, and the kernel did not accept the repair. That is `HOLD_LIVE_CREATE_REPAIR_NOT_ACCEPTED`, not a repaired PASS.

## Task57R-F3

| Check | Result |
| --- | --- |
| pytest | 1005 passed, 0 failed |
| cargo test --offline | 41 passed, 0 failed |
| WASM | `a2a2041b0c2b485b5e61347d6e2f13ce613f3a25c1e2dcccc0e178a7aad347bf`, 1275679 bytes, two builds byte-identical, imports 0 |
| npm run build | exit 0 |
| web scripts, copy, egress, tsc | exit 0; `zero_egress` true |
| repaired browser | exit 0; kept `repaired`, plan `ACCEPTED` |
