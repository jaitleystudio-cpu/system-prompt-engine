# SPE master implementation audit

AUDITED SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`
BRANCH: `cursor/spe-master-implementation-audit-20260928`
PARENT VISUAL SHA: `670db9dfa9e61f4ef65ece4cf4e6a3fc88692ba2`
PR #45 head remains `e0497f79898689a00a30abeab67652d5f6a9193c` and was not modified.
GLOBAL_TASK_ROUTER: NOT_FOUND
MODE: audit only. No production code changes.

## Counts

| Status | Count |
| --- | --- |
| PROVEN | 69 |
| IMPLEMENTED_UNPROVEN | 41 |
| PARTIAL | 197 |
| SPECIFIED_ONLY | 6 |
| BLOCKED | 3 |
| EXTERNAL_VALIDATION_REQUIRED | 12 |
| NOT_FOUND | 42 |
| TOTAL | 370 |

| Severity | Count |
| --- | --- |
| P0 | 0 |
| P1 | 85 |
| P2 | 191 |
| P3 | 25 |

Founder ideas total: 370
Founder ideas PROVEN: 69
Founder ideas PARTIAL: 197
Founder ideas MISSING (NOT_FOUND + SPECIFIED_ONLY): 48

IMPLEMENTED_UNPROVEN, BLOCKED, and EXTERNAL_VALIDATION_REQUIRED are neither proven nor missing.

## Gates

| Gate | Value |
| --- | --- |
| CORE_ENGINE_COMPLETE | PARTIAL |
| CROSS_RUNTIME_COMPLETE | PARTIAL |
| CREATE_COMPLETE | PARTIAL |
| MULTIMODAL_COMPLETE | PARTIAL |
| SCREENSHOT_TO_CODE_COMPLETE | PARTIAL |
| URL_INTELLIGENCE_COMPLETE | PARTIAL |
| MASSIVE_INTENT_COMPLETE | NO |
| PORTABLE_SPE_COMPLETE | PARTIAL |
| EXECUTION_CONTRACT_COMPLETE | PARTIAL |
| PROVIDER_PORTABILITY_COMPLETE | PARTIAL |
| PRIVACY_LAWS_VERIFIED | PARTIAL |
| OFFLINE_VERIFIED | PARTIAL |
| SECURITY_QUALIFIED | PARTIAL |
| ACCESSIBILITY_AUTOMATED | PARTIAL |
| ACCESSIBILITY_HUMAN | NO |
| HUMAN_PREFERENCE_VALIDATED | NO |
| INDEPENDENTLY_REPLICATED | NO |
| FULL_BUILD_GREEN | NO |
| HOSTING_READY | NO |
| FOUNDER_PLAN_COMPLETE | PARTIAL |
| WORLD_1_PROVEN | NO |

## Judgment

The frozen Home line at this SHA builds with Vite, typechecks, and passes the hero, theme, copy, create-intent, artifact, execution-contract, engine-fixture, and Rust kernel suites that were run. The official `npm run build` stops before `tsc` because `copy-wasm` requires a gitignored `wasm32` artifact that is not on this machine. The committed `apps/web/public/spe_wasm.wasm` still evaluates the engine fixture and matches sha256 `8d482a17404d873a599b6804181d0637ae20a021ffe912ca19fdf99139c52830`.

Python's 51 test modules were not executed. `python3 -m pytest` failed with `ModuleNotFoundError`. Pytest was not installed.

No P0 was assigned. Declared privacy and observed network behavior differ on URL reading: the privacy page says reading a website contacts that address, while CSP `connect-src 'self'` is in force. That is blocked egress, not an undisclosed leak, so it is P1. Home `maxLength={20000}` drops overflow without an in-product notice. Create's idea field accepted 1,000,000 characters in Chromium. That is not a 100k-word or 1M-word product mode.

K3 is specified in design docs and is not a runtime selector. Category engines exist for C01, C02, C03, C06, and C07. Screenshot-to-code targets are prompt scaffolds. MCP and the inline assistant are not shipped. Human ratings are `NO_RATINGS_YET`. This machine is not an independent replication.

## Recommended next mission

Align URL reading with CSP: either a same-origin acquisition path that keeps the untrusted-content boundary, or stop saying the browser contacts the address. Do not edit the frozen Home.
