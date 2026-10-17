# Regression results — Task 56B

**Date:** 2026-09-29  
**Branch:** `cursor/spe-xcat-v1-closure-20260929`  
**BASE SHA:** `fc0838da6222106e98df9aa96b2f3b4b5be93a42`

## Filled

| Suite | Command / scope | Result |
|-------|-----------------|--------|
| XCAT domain | `tests/unit/test_xcat_domain_56b.py` | PASS |
| XCAT vectors | `tests/unit/test_xcat_vectors_56b.py` | PASS (60 normal / 56 adversarial) |
| XCAT mutations | `tests/unit/test_xcat_mutations_56b.py` | **16/16 killed** |
| XCAT parity | `tests/portability/test_xcat_parity_56b.py` | **0/0/0 mismatches** |
| XCAT core + integration | `test_xcat_core.py`, `test_xcat_c02_c06_c01_c03.py` | PASS |
| K3 runtime | `tests/unit/test_k3_runtime.py` | PASS |
| K3 effect | `tests/unit/test_k3_effect.py` + effect vectors | PASS; effect mutants **11/11** |
| Requirement Graph | unit + mutation | PASS |
| Full-repo pytest | `.venv/bin/pytest -q` | **946 passed**, 0 failed |
| Rust crate | `cargo test -q` in `portable/spe-core-rs` | **41 passed**, 0 failed |
| WASM rebuild | two-path (`target-canonical` + `/tmp/spe-wasm-measure-b`) | identical `d87a9d2c…` |
| WASM custody | sha256 / bytes / imports | `d87a9d2ce1b2e789e7cb2869c686e6f719b39bdc753df509cb5244a07034b75a` / 1022683 / **0** |
| Official web build | `npm run build` (apps/web) | PASS (exit 0) |
| Web engine/artifact/intent/exec | npm test scripts | PASS |
| Adversarial / craft / theme / SEO / truth-privacy / copy | npm scripts | PASS |
| Egress audit | `npm run audit:egress` | zero_egress=true |
| Typecheck | `npx tsc --noEmit` | PASS |
| Deployment safety gate | `node tools/deployment-safety-gate.mjs` | **exit 2**; HOSTING=FORBIDDEN |

## Out of scope / not claimed

| Item | Status |
|------|--------|
| Hero-story browser path | Not required when browser env unavailable; not claimed |
| Quality Delta / Plan B / VALIDATE_ONLY | **NOT RUN — out of scope** |
| Production hosting / DNS | **FORBIDDEN** |
| Task 57 | **NOT STARTED** |

Do not treat out-of-scope rows as pass.

## Task 56C (ownership repair)

| Suite | Result |
|-------|--------|
| Mutations M1–M23 | **23/23 killed** (full pytest includes this suite) |
| Parity including C01/C07 payload cases | **0 / 0 / 0** mismatches |
| Full pytest | **953 passed**, 0 failed |
| Rust `spe-core-rs` | **41 passed**, 0 failed |
| Official `npm run build` | PASS (exit 0) |
| Web regressions + `tsc --noEmit` + egress | PASS; zero_egress=true |
| Deployment safety gate | **exit 2**; HOSTING=FORBIDDEN |
| WASM | `077a4a399aaf598fd4ed3365f89cf6e32fcf64918a6c5f13319317823b4e3082` / 1023091 / imports=0; two-path identical |
| Prior 56B WASM | `d87a9d2c…` does not prove 56C allowlists |

