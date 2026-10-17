# 55R regression

Rust and WASM semantics were not changed. Public WASM remained `48ad95f5873bd7fb7933354d93fbbe732c57bc6f85956f64762fe1f5f44f2c33`.

| Command | Result |
|---|---|
| `python3 -m pytest` | 900 passed, 0 failed |
| Rust core `cargo test` | 40 passed, 0 failed |
| Rust WASM `cargo test` | 4 passed, 0 failed |
| `node apps/web/scripts/test-k3-effect-prompt.mjs` | pass, including null, missing, unbound, and transport cases |
| `npm run build` | exit 0 after the copy gate |
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
| `npm run audit:egress` | exit 0 |
| `npm run test:copy` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `node tools/deployment-safety-gate.mjs` | exit 2, HOSTING FORBIDDEN |

Hero-story was not run. This environment does not provide the Chrome binary that script launches.

Effect mutants: 11 defined, 11 killed, 0 survived.
