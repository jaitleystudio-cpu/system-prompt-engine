# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST) — rebuild pass: visitor jargon closed, instrument product repairs, fresh visual + suites
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`

## 1. Verdict

**SPE_V1_PREDEPLOY_READY**

Confirmed rebuild defects are closed with fresh evidence. Production hosting / DNS for `systempromptengine.com` remains the only founder step (intentionally out of scope here).

Speech stays **VERIFIED_GRACEFUL_FALLBACK** on launch platforms. Founder **QUALIFIED** dictation remains optional enrichment, not a predeploy blocker.

## 2. Custody (four SHAs — no ambiguous single CURRENT_PR_HEAD claim)

| Token | SHA | Meaning |
| --- | --- | --- |
| IMPLEMENTATION_TESTED_SHA | `d0808965a16ea03a30311698ce150f037c1b851f` | Jargon + instrument repairs; suites green |
| VISUAL_EVIDENCE_SHA | `ba6cea30740dca0bb79cae84593c0184bc269d93` | Fresh visual pass; manifest `testedSha` = implementation SHA |
| REPORT_AUTHORED_AT_SHA | `fe0af1a5d1671c7d420e6dd5ff678a7492ec7908` | Commit that authored this report |
| CURRENT_PR_HEAD | `0838530b95728772ab7c7ef0f64779c93193341c` | PR tip after custody bind |

BASE: `646d3765153f66c3951d812b8adfd87fcbf766b1`

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E + engine VALID |
| 2 | Speech→Prompt | VERIFIED_GRACEFUL_FALLBACK (launch platforms) | Visitor Rich Human English; unsupported/deny/error contracts automated |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / HUMAN_GROUNDED_BENCH | Preview + separate notes panel; human bench honest 4/4; invalid 10/2 DROPPED |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / REAL+SYNTHETIC | Source + structure + target + scaffold + compare; 6×6 real/synthetic |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE+ | Preview + timeline + scenes; no invented audio |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / HONEST_BRIEF | Visitor human copy; no CORS/proxy jargon in visitor chrome |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Dawn coil specimen improved; reduced-motion contract asserted |

## 4. Rebuild defects closed this pass

1. **Visitor jargon** — UnifiedComposer URL hint/note humanized; urlIngest visitor messages humanized; Privacy Proof proxy line humanized; inventory regenerated; copy gate green. Internal `urlIngest` comments may stay technical.
2. **Instrument / product** — Create framed as instrument deck; Image notes ≠ idea text; Video timeline/scenes + no-audio honesty; Code source/structure/target/scaffold/compare; My Work strong empty state + Start CTA; Dawn coil specimen + editorial; mobile ~44×44 hit targets + 393 capture.

## 5. Speech matrix (proof only — not visitor chrome)

| Platform | Status | Founder QUALIFIED needed? | Evidence |
| --- | --- | --- | --- |
| Chrome desktop | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Fallback contract automated |
| Safari desktop | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Product fallback + contract tests |
| Android Chrome | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Same |
| iPhone Safari | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Same |
| Linux Chromium (box) | VERIFIED_GRACEFUL_FALLBACK | no | API YES; dictation FAIL; fallback PASS |
| Linux Firefox/no-API | VERIFIED_GRACEFUL_FALLBACK | no | Unsupported path PASS |

Artifacts:
- `proofs/spe_v1_launch/speech_fallback_contract.json`
- `proofs/spe_v1_launch/SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md`

## 6. Fresh visual pass

Dir: `proofs/spe_v1_launch/fresh_visual/` — Home, Create, Code, Image/Video/URL flows, Daily Lab, My Work, Privacy, 393/390/360/320, reduced motion.

Manifest `testedSha`: `d0808965a16ea03a30311698ce150f037c1b851f` (IMPLEMENTATION_TESTED_SHA).

## 7. Suite results (fresh at IMPLEMENTATION_TESTED_SHA)

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** | 0 |
| python -m pytest tests/web -q | **53 passed** | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok | 0 |
| npm run test:speech | ok | 0 |
| npm run test:speech-fallback | VERIFIED_GRACEFUL_FALLBACK | 0 |
| npm run test:screenshot-fidelity | ok | 0 |
| npm run test:screenshot-real | ok (6×6) | 0 |
| npm run test:video-scenes | ok | 0 |
| npm run test:predeploy-qa | ok (incl. visitor_no_infra_jargon) | 0 |
| npm run bench:vision-human | ok; honest 4/4; invalid heuristic 8 | 0 |
| npm run test:e2e:v1 | all cases ok (url human fallbacks) | 0 |
| npm run test:engine | VALID | 0 |
| npm run test:copy | PASS | 0 |
| npm run build | PASS | 0 |

## 8. Remaining (non-app) gaps

1. **Hosting/DNS** — parkweb apex still not SPE; founder must serve `apps/web/dist` (wasm, `_headers`, `/models`, `/ort`)
2. Optional: founder QUALIFIED dictation on Chrome/Safari/Android/iPhone (enrichment only)

## 9. Guardrails honored

- PR #41 not merged
- No spe_runtime/omega/
- No DNS / apex hosting changes
- No fabricated World #1 / PRODUCTION / VERIFIED_SUCCESS claims
- Frozen G6-H human evidence untouched
- ₹0 extra owner spend
- UI → Worker → spe_wasm.wasm → spe-core-rs → ABI → PromptArtifact preserved
- Visitor copy = Rich Human English; jargon only in Inspect/Proof

## 10. Final token

**SPE_V1_PREDEPLOY_READY**

Production hosting is the only remaining step.
