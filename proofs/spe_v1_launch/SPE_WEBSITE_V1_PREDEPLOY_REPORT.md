# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST) — pass 3 Screenshot→Code structure fidelity
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`
Start tip (custody this pass): `8502fcb78da873ee7d7a7099fe98a686fa1f9059`

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

This pass (pass 3) closed the Screenshot→Code structure-resemblance gap for representative fixtures without claiming pixel-perfect reconstruction or production readiness:
- IR discriminates nav-hero / form / card-grid / modal / left-rail / toolbar-list with zone annotations.
- All 6 codegen targets emit structure-specific scaffolds (distinct HTML; landmarks; hierarchy markers).
- Speech remains DEVICE_QUALIFICATION_PENDING (Safari/Android/iPhone NOT_TESTED; box dictation FAIL).

**PREDEPLOY_READY is not claimed** while Speech lacks real-device QUALIFIED rows. Apex DNS/hosting stays intentionally out of scope.

## 2. Custody

| Token | SHA |
| --- | --- |
| START_HEAD (this pass) | `3d7556e54240a9659532a540bdb2caaf9882a695` |
| CURRENT_PR_HEAD | `TIP_PENDING` |
| Feature work tip (pass2) | `643c20c6c0cd769a48d6a400b73b363bbc0e0234` |
| MAIN | `646d3765153f66c3951d812b8adfd87fcbf766b1` |

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E + engine VALID |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Chrome headless API YES, fake-mic YES, dictation FAIL; checklist ready for founder devices; Safari/Android/iPhone NOT_TESTED |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY + BROWSER_BENCH | Browser ORT+MobileNet INT8: onnxRuntimeInvoked=true; 10 improve / 2 no-gain; LITE fallback preserved |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / STRUCTURE_RESEMBLANCE | Pixel-band IR discriminates nav-hero / form / card-grid / modal / left-rail / toolbar-list; all 6 targets emit zone+hierarchy markers + distinct scaffolds. Honest: structure resemblance, not pixel-perfect. |
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

Pass 3 closed the “generic identical scaffold” gap for representative fixtures:

Fixtures (synthetic but structure-representative): `nav-hero`, `form`, `card-grid`, `modal`, `left-rail`, `toolbar-list`.

IR (`uiObservation.ts`):
- Pixel-band probes (not only 3×3 grid) discriminate form vs modal, nav-hero vs card-grid, toolbar+list striping, left rail.
- Regions carry roleGuess + evidence + confidence; structure hints recorded in uncertainty.
- Layout zones annotated (`zone=top-center` etc.).

Codegen (`screenshotToCode.ts`) — all 6 targets:
- HTML/CSS/JS, React, SwiftUI, Jetpack Compose, Flutter, React Native
- Landmark order (banner → main → contentinfo), `data-structure` / structure comments per fixture
- Relative bounds + zone markers; hierarchy depth attributes
- Fixtures produce **distinct** HTML (asserted); no collapse to one generic shell
- Honesty string: structure resemblance / OBSERVATION scaffold — **not** pixel-perfect reconstruction

Test: `npm run test:screenshot-fidelity` (fail-closed on wrong structure / identical scaffolds).

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
| Screenshot scaffolds identical / form→modal | test-screenshot-fidelity | Pixel-band IR + fixture-differentiated codegen |

## 9. Fresh suite results

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** (after privacy fix) | 0 |
| python -m pytest tests/web -q | **53 passed** | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok (15 cases) | 0 |
| npm run test:speech | ok | 0 |
| npm run test:screenshot-fidelity | ok (6 fixtures × 6 targets; distinct HTML) | 0 |
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
2. **Screenshot→Code** — structure resemblance proven on synthetic fixtures; still not pixel-faithful reconstruction of arbitrary real screenshots
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
