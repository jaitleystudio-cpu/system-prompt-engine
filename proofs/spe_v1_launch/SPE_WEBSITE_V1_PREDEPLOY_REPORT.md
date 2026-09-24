# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST)
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`
Start tip (custody this pass): `8502fcb78da873ee7d7a7099fe98a686fa1f9059`

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

This pass closed several evidence gaps without claiming production readiness:
- Browser ONNX STANDARD vs LITE bench now runs with **`onnxRuntimeInvoked: true`** (10/12 kinds improved; 2 no-gain / LITE fallback).
- Screenshot→Code emits landmark HTML/React structure (banner/main/rail/form/cards/dialog) plus numeric bounds on all 6 targets; fixtures for nav-hero / form / card-grid / modal / left-rail.
- Speech UX: permission messaging, start/stop cleanup, transcript edit, mixed speech+typing helpers + unit tests; founder device checklist added. Box dictation still FAIL (`audio-capture`); Safari/Android/iPhone remain **NOT_TESTED**.
- Video: scene keyframe + dedupe asserts on a representative sequence (no audio claim; no duplicate spam).

**PREDEPLOY_READY is not claimed** while Speech lacks real-device QUALIFIED rows and Screenshot→Code remains structure-faithful scaffolding (not pixel-perfect reconstruction). Apex DNS/hosting stays intentionally out of scope.

## 2. Custody

| Token | SHA |
| --- | --- |
| START_HEAD (this pass) | `8502fcb78da873ee7d7a7099fe98a686fa1f9059` |
| CURRENT_PR_HEAD | `TIP_PENDING` |
| MAIN | `646d3765153f66c3951d812b8adfd87fcbf766b1` |

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E + engine VALID |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Chrome headless API YES, fake-mic YES, dictation FAIL; checklist ready for founder devices; Safari/Android/iPhone NOT_TESTED |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY + BROWSER_BENCH | Browser ORT+MobileNet INT8: onnxRuntimeInvoked=true; 10 improve / 2 no-gain; LITE fallback preserved |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / STRUCTURE_SCAFFOLD+ | Landmarks + role-aware form/card/dialog hints; 6-target bounds; still not pixel-faithful |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE | Dedupe + scene keyframes on representative sequence; no audio transcription |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / XRAY_BRIEF | Site-class + UNTRUSTED; scripts never executed |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Shape/title alignment retained; reduced-motion contract asserted |

## 4. Speech matrix

| Platform | Browser | API | Mic | Dictation | Status |
| --- | --- | --- | --- | --- | --- |
| Linux box (agent) | Chromium headless | YES | YES (fake) | FAIL (audio-capture) | IMPLEMENTATION_PRESENT |
| Chrome desktop (real) | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Safari desktop | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Android | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| iPhone | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |

Artifacts:
- `proofs/spe_v1_launch/speech_chrome_probe.json`
- `proofs/spe_v1_launch/SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md` (founder-run procedure)

Probe summary: apiPresent=YES; dictation=FAIL; uiHonesty=PASS.

## 5. STANDARD vs LITE — browser evidence

Artifact: `proofs/spe_v1_launch/standard_vs_lite_browser_bench.json`

- **onnxRuntimeInvoked: True**
- improvedCount: **10**
- noGainCount: **2**
- kinds: people, product, interior, nature, screenshot, diagram, text-heavy, complex, dark, bright, unusual, ambiguous
- LITE path remains when STANDARD unavailable/fails

Prior Node synthetic bench retained at `standard_vs_lite_bench.json` (onnxRuntimeInvoked:false) for comparison only.

## 6. Screenshot→Code fidelity

Fixtures: nav-hero, form, card-grid, modal, left-rail (`test-screenshot-fidelity.mjs`).

- All 6 targets: HTML/CSS/JS, React, SwiftUI, Jetpack Compose, Flutter, React Native
- Asserts: banner/main landmarks, observed role strings in code, numeric/percent bounds, left-rail language
- Generators emit inferred form / card grid / dialog when structure hints fire
- Honest limit: structure scaffold + build prompt — not a pixel clone of arbitrary screenshots

## 7. Video

`test-video-scenes.mjs`: 5-frame representative sequence → dedupe collapses near-duplicates; scene keyframes keep first/last/changes; summary forbids audio transcription and duplicate-line spam.

## 8. Defects found / fixed this pass

| Defect | Test | Fix |
| --- | --- | --- |
| Speech error UX undifferentiated | test-speech-helpers | mapSpeechError + cleanupRecognition + mix helpers |
| No founder speech procedure | checklist artifact | SPEECH_DEVICE_QUALIFICATION_CHECKLIST.md |
| STANDARD only synthetic in Node | browser bench | ORT WASM + MobileNet in Chromium; onnxRuntimeInvoked:true |
| Screenshot scaffolds generic | fidelity fixtures | Landmark HTML/React + structure hints in IR |
| Privacy gate: literal `login` in source | test_web_privacy_pwa | Use `sign-in` in form heuristic |
| Video scene quality unasserted | test-video-scenes | Sequence/dedupe/summary asserts |

## 9. Fresh suite results

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** (after privacy fix) | 0 |
| python -m pytest tests/web -q | **53 passed** | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok (15 cases) | 0 |
| npm run test:speech | ok | 0 |
| npm run test:screenshot-fidelity | ok | 0 |
| npm run test:video-scenes | ok | 0 |
| npm run bench:vision-browser | onnxRuntimeInvoked true; 10/2 | 0 |
| npm run test:e2e:v1 | **10/10** | 0 |
| npm run test:engine | VALID | 0 |
| npm run test:copy | PASS | 0 |
| npm run build | PASS (reviewed-inventory refreshed for speech/screenshot/url strings) | 0 |

## 10. Visual / product-language

Prior predeploy screens retained under `proofs/spe_v1_launch/predeploy_screens/`. Visitor copy stays Rich Human English; ORT/MobileNet/IR jargon kept out of visitor chrome.

## 11. Remaining gaps (block PREDEPLOY_READY)

1. **Speech** — real Chrome desktop / Safari / Android / iPhone still NOT_TESTED (checklist ready; box dictation FAIL)
2. **Screenshot→Code** — still structure scaffold, not pixel-faithful reconstruction of complex real UIs
3. Hosting/DNS intentionally last (not an app-readiness gate)

## 12. Guardrails honored

- PR #41 not merged
- No spe_runtime/omega/
- No DNS / apex hosting changes
- No fabricated READY / World #1 claims
- ₹0 extra owner spend
- UI → Worker → spe_wasm.wasm → spe-core-rs preserved

## 13. Final token

**SPE_V1_REBUILD_REQUIRED**
