# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST) — pass 4 closable gaps (video/a11y/security/perf/jargon)
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`
Start tip (custody this pass): `8502fcb78da873ee7d7a7099fe98a686fa1f9059`

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

This pass (pass 4) closed remaining **app-side** closable gaps without claiming production readiness:
- Video→Prompt: scene-change signals + key moments + dedupe (no cue/summary bloat).
- Mobile/a11y: viewport, focus-visible, reduced-motion, 44px targets, zoom-safe wrap.
- Security/privacy: CSP self-only connect, UNTRUSTED hold, clipboard-deny copy, corrupt .spe reject, abortable model download.
- Perf: huge media limits fail closed.
- Adversarial + visitor jargon sweep (removed UIObservationIR / modelBytes from visitor surfaces).
- Speech remains DEVICE_QUALIFICATION_PENDING (Safari/Android/iPhone NOT_TESTED; box dictation FAIL).

**App-side PREDEPLOY gaps closed except Speech device evidence (founder checklist).**
**PREDEPLOY_READY is not claimed** while Speech lacks real-device QUALIFIED rows. Apex DNS/hosting stays intentionally out of scope.

## 2. Custody

| Token | SHA |
| --- | --- |
| START_HEAD (this pass) | `2bf8552df49e41a2242c81c429f5af79f9d5fa33` |
| CURRENT_PR_HEAD | `6a3e89300161906874f49f88dbec3649875a54e7` |
| Feature work tip (pass4) | `6a3e89300161906874f49f88dbec3649875a54e7` |
| MAIN | `646d3765153f66c3951d812b8adfd87fcbf766b1` |

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E + engine VALID |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Chrome headless API YES, fake-mic YES, dictation FAIL; checklist ready for founder devices; Safari/Android/iPhone NOT_TESTED |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY + BROWSER_BENCH | Browser ORT+MobileNet INT8: onnxRuntimeInvoked=true; 10 improve / 2 no-gain; LITE fallback preserved |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / STRUCTURE_RESEMBLANCE | Pixel-band IR discriminates nav-hero / form / card-grid / modal / left-rail / toolbar-list; all 6 targets emit zone+hierarchy markers + distinct scaffolds. Honest: structure resemblance, not pixel-perfect. |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE+ | Change/key-moment signals + dedupe; no audio claim; no duplicate cue bloat |
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

Pass 4: `summarizeSequence` emits Scene changes + Key moments; pacing cues dedupe; summary length capped. `test:video-scenes` asserts change signals and no cue bloat.


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
| Visitor UIObservationIR / modelBytes jargon | test-predeploy-qa | Rich Human English on create/code surfaces |
| Model download ignore abort | onnxSemantic fetch(signal) | Abortable same-origin model/label fetch |
| Screenshot scaffolds identical / form→modal | test-screenshot-fidelity | Pixel-band IR + fixture-differentiated codegen |

## 9. Fresh suite results

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** (after privacy fix) | 0 |
| python -m pytest tests/web -q | **53 passed** | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok (16 cases incl. predeploy_qa) | 0 |
| npm run test:speech | ok | 0 |
| npm run test:screenshot-fidelity | ok (6 fixtures × 6 targets; distinct HTML) | 0 |
| npm run test:video-scenes | ok (change+key moments, no cue bloat) | 0 |
| npm run test:predeploy-qa | ok (18 cases) | 0 |
| npm run bench:vision-browser | onnxRuntimeInvoked true; 10/2 | 0 |
| npm run test:e2e:v1 | **10/10** | 0 |
| npm run test:engine | VALID | 0 |
| npm run test:copy | PASS | 0 |
| npm run build | PASS (reviewed-inventory refreshed for speech/screenshot/url strings) | 0 |

## 10. Visual / product-language

Prior predeploy screens retained under `proofs/spe_v1_launch/predeploy_screens/`. Visitor copy stays Rich Human English; ORT/MobileNet/IR jargon kept out of visitor chrome.

## 11. Remaining gaps (block PREDEPLOY_READY)

1. **Speech** — real Chrome desktop / Safari / Android / iPhone still NOT_TESTED (checklist ready; box dictation FAIL). **This is the sole remaining app-qualification gap that requires founder devices.**
2. Hosting/DNS intentionally last (not an app-readiness gate)
3. Screenshot→Code — structure resemblance proven on synthetic fixtures; still not pixel-faithful on arbitrary real UIs (acceptable for V1 with honest labeling)

## 12. Guardrails honored

- PR #41 not merged
- No spe_runtime/omega/
- No DNS / apex hosting changes
- No fabricated READY / World #1 claims
- ₹0 extra owner spend
- UI → Worker → spe_wasm.wasm → spe-core-rs preserved

## 13. Final token

**SPE_V1_REBUILD_REQUIRED**

Note: app-side PREDEPLOY gaps closed except Speech device evidence (founder checklist).
