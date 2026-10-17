# Regression results

## Engine fixtures

| Fixture | Result |
| --- | --- |
| POS-001 | VALID; `used_ts_fallback=false`; sha256=`9325f9ec…`; imports=0 |
| NEG-001 | INVALID; reason=`P_PROVENANCE_REMOVED`; `used_ts_fallback=false` |
| Tamper integrity | `WASM_INTEGRITY_MISMATCH`; no TS fallback |

## Web npm scripts

| Script | Exit |
| --- | ---: |
| test:engine | 0 |
| test:artifact | 0 |
| test:create-intent | 0 |
| test:execution-contract | 0 |
| test:adversarial | 0 |
| test:final-craft | 0 |
| test:theme-routes | 0 |
| test:dot-pattern | 0 |
| test:capabilities-seo | 0 |
| test:lab-acquisition | 0 |
| test:media | 0 |
| test:speech | 0 |
| test:video-scenes | 0 |
| test:screenshot-fidelity | 0 |
| test:screenshot-real | 0 |
| test:predeploy-qa | 0 |
| test:copy | 0 |
| daily-title (`test-daily-hero.mjs`) | 0 |
| `npx tsc --noEmit` | 0 |
| test:hero-story | 1 — environment: hardcoded macOS Chrome path; no UI change attempted |
| test:e2e:v1 | failed — known unrelated Create-nav timeout (`#spe-primary-nav` Create button). Not repaired in Task C. |

## Accessibility / visual freeze

Non-mutating a11y/source gates in `test:predeploy-qa` passed (viewport,
focus-visible, reduced-motion, touch targets, landmarks, CSP headers).
No visual/CSS/Home files changed. Screenshot regeneration not required.

## Path independence

| Build | SHA |
| --- | --- |
| External target A `/tmp/spe-promo-path-a` | `9325f9ec…` |
| External target B `/tmp/spe-promo-path-b` | `9325f9ec…` |
| Second absolute checkout `/tmp/spe-promo-checkout-b/repo` | `9325f9ec…` |

## Deployment gate

```
node tools/deployment-safety-gate.mjs
```

exit **2**, `HOSTING: FORBIDDEN`. BUILDABLE ≠ AUTHORIZED_TO_DEPLOY.
