# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST) — pass 5: speech fallback, human vision bench, real screenshot fidelity, custody, fresh visual
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`

## 1. Verdict

**SPE_V1_PREDEPLOY_READY**

App-side pre-deploy gaps are closed. Production hosting / DNS for `systempromptengine.com` is the only remaining founder step (intentionally out of scope here).

Speech is **not** gated on “every device must dictate successfully.” Launch platforms ship as **VERIFIED_GRACEFUL_FALLBACK** with automated contract evidence. Founder **QUALIFIED** dictation runs remain optional enrichment, not a predeploy blocker.

## 2. Custody (four SHAs — no ambiguous single CURRENT_PR_HEAD claim)

| Token | SHA | Meaning |
| --- | --- | --- |
| IMPLEMENTATION_TESTED_SHA | `3d50f162c441dfcfa6f6ddd1b7f8e5c30b2e5eb5` | Gap-closure implementation green (speech/vision/screenshot/tests) |
| VISUAL_EVIDENCE_SHA | `9a19bcf90a1713e2eae9a005af8b81ca0458f6dd` | Fresh visual pass + hero/privacy polish; screenshot manifest records this build |
| REPORT_AUTHORED_AT_SHA | `2a708329ce409d31ef218f21923394c6d31e0601` | Commit that authored this report |
| CURRENT_PR_HEAD | `be49d267296da764097f54b8d0f3aeda731ffb5d` | PR tip at review time |

MAIN: `646d3765153f66c3951d812b8adfd87fcbf766b1`

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E + engine VALID |
| 2 | Speech→Prompt | VERIFIED_GRACEFUL_FALLBACK (launch platforms) | Visitor Rich Human English only; unsupported/deny/error contracts automated; founder QUALIFIED dictation optional |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / HUMAN_GROUNDED_BENCH | Real-photo bench; invalid 10/2 length heuristic **DROPPED** |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / REAL+SYNTHETIC | 6 synthetic + 6 real UI fixtures × 6 targets; structure usefulness, not pixel-perfect |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE+ | Change/key-moment signals + dedupe |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / HONEST_BRIEF | Site-class + UNTRUSTED; scripts never executed |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Reduced-motion contract asserted |

## 4. Speech matrix (proof only — not visitor chrome)

| Platform | Status | Founder QUALIFIED needed? | Evidence |
| --- | --- | --- | --- |
| Chrome desktop | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Fallback contract automated; no mic on box |
| Safari desktop | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Product fallback + contract tests |
| Android Chrome | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Same |
| iPhone Safari | VERIFIED_GRACEFUL_FALLBACK | YES (optional) | Same |
| Linux Chromium (box) | VERIFIED_GRACEFUL_FALLBACK | no | API YES; dictation FAIL; fallback PASS |
| Linux Firefox/no-API | VERIFIED_GRACEFUL_FALLBACK | no | Unsupported path PASS |

Artifacts:
- `proofs/spe_v1_launch/speech_fallback_contract.json` — status VERIFIED_GRACEFUL_FALLBACK
- `proofs/spe_v1_launch/SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md`
- `apps/web/src/engine/speechQualification.ts`

Visitor UI contains **no** `DEVICE_QUALIFICATION_PENDING` / `NOT_TESTED` / `IMPLEMENTATION_PRESENT`.

## 5. STANDARD vs LITE — human-grounded (invalid metric dropped)

Artifact: `proofs/spe_v1_launch/standard_vs_lite_human_bench.json`

- Real photos under `proofs/spe_v1_launch/vision_fixtures/` + `expected_labels.json`
- onnxRuntimeInvoked: **true**
- Invalid prior metric (conf≥0.05 AND STANDARD chars > LITE+40): **DROPPED** (would have falsely claimed improve on **8/8** fixtures)
- Honest summary: STANDARD more useful on **4**; harmful/noisy on **4**; does **not** reliably beat LITE
- Longer ≠ better

Prior browser/synthetic benches retained for history only; do not cite 10/2 as readiness.

## 6. Screenshot→Code fidelity

Synthetic (kept): nav-hero, form, card-grid, modal, left-rail, toolbar-list — `npm run test:screenshot-fidelity`

Real UI (≥6): desktop landing, mobile app, form, dashboard/sidebar, card/grid, dark difficult — `proofs/spe_v1_launch/screenshot_real_fixtures/` + `screenshot_real_fidelity.json` (6×6 targets useful scaffolds).

Honesty: structure resemblance / observation scaffold — not pixel-perfect.

## 7. Fresh visual pass

Dir: `proofs/spe_v1_launch/fresh_visual/` (Home, Create, Code, Image/Video/URL flows, Daily Lab, My Work, Privacy, 390/360/320, reduced motion).

Product Design notes + fixes:
- Hero headline was partially occluded by the 3D stage → narrowed copy column + text-shadow + stronger stage mask
- Privacy speech line rewritten to Rich Human English (typing always works)
- No visitor engineering tokens observed in chrome

## 8. Suite results (at IMPLEMENTATION_TESTED_SHA / follow-on green)

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** | 0 |
| python -m pytest tests/web -q | **53 passed** (after speech matrix assert update) | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok | 0 |
| npm run test:speech | ok | 0 |
| npm run test:speech-fallback | VERIFIED_GRACEFUL_FALLBACK | 0 |
| npm run test:screenshot-fidelity | ok | 0 |
| npm run test:screenshot-real | ok (6 real × 6 targets) | 0 |
| npm run test:video-scenes | ok | 0 |
| npm run test:predeploy-qa | ok | 0 |
| npm run bench:vision-human | ok; honest 4/4 split; invalid heuristic 8 | 0 |
| npm run test:e2e:v1 | all cases ok | 0 |
| npm run test:engine | VALID | 0 |
| npm run test:copy | PASS | 0 |
| npm run build | PASS | 0 |

## 9. Remaining (non-app) gaps

1. **Hosting/DNS** — parkweb apex still not SPE; founder must serve `apps/web/dist` (wasm, `_headers`, `/models`, `/ort`)
2. Optional: founder QUALIFIED dictation on Chrome/Safari/Android/iPhone (enrichment only)

## 10. Guardrails honored

- PR #41 not merged
- No spe_runtime/omega/
- No DNS / apex hosting changes
- No fabricated World #1 claims
- ₹0 extra owner spend
- UI → Worker → spe_wasm.wasm → spe-core-rs preserved
- Visitor copy = Rich Human English

## 11. Final token

**SPE_V1_PREDEPLOY_READY**

Production hosting is the only remaining step.
