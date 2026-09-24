# SPE WEBSITE V1 PRE-DEPLOY QUALIFICATION REPORT

Date: 2026-09-24 (Asia/Calcutta / IST)
Branch: `grok/spe-v1-launch-20260924`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`
Start tip (custody): `454c57d3c7194a4e5fa7e3c02d80044f15e145ae`

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

Application quality improved in this pass (Screenshot bounds fidelity, Daily Lab shape/title alignment, URL site-class signals, STANDARD vs LITE synthetic evidence, Chrome speech probe honesty, expanded adversarial coverage). **PREDEPLOY_READY is not claimed**: Speech remains DEVICE_QUALIFICATION_PENDING / NOT_TESTED on real Safari / Android / iPhone devices; STANDARD MobileNet quality is only synthetically evidenced in Node (browser ONNX path exists but was not run on a diverse real-image corpus in-browser this session); Screenshot→Code remains structure-faithful scaffolding, not pixel-faithful reconstruction. Apex DNS/hosting is intentionally out of scope (parked lander; founder deploys last) and is **not** the readiness narrative.

## 2. Custody

| Token | SHA |
| --- | --- |
| START_HEAD | `454c57d3c7194a4e5fa7e3c02d80044f15e145ae` |
| CURRENT_PR_HEAD | `c805f6b0016ce79ebf2300aa180d86ee7fdce7ca` |
| MAIN | `646d3765153f66c3951d812b8adfd87fcbf766b1` |

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E compile path green; engine VALID; no TS fallback |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Chrome headless: API YES, fake-mic YES, dictation FAIL (audio-capture); Safari / Android / iPhone **NOT_TESTED** |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY | LITE always; STANDARD lazy MobileNet INT8. Synthetic bench 6 improve / 6 no-gain. Real ONNX not invoked in Node |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / STRUCTURE_SCAFFOLD | All 6 targets encode numeric bounds (SwiftUI GeometryReader + Compose BoxWithConstraints fixed). Not a pixel clone |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE | Dedupe + scene keyframes; no audio transcription claims |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / XRAY_BRIEF | Site-class heuristics; scripts never executed; UNTRUSTED_SOURCE; CORS honesty |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Shape/title scramble fixed; modules/slabs/folds/table added; Prompt Gallery separated |

## 4. Speech matrix

| Platform | Browser | API | Mic | Dictation | Status |
| --- | --- | --- | --- | --- | --- |
| Linux box (agent) | Chromium headless | YES | YES (fake) | FAIL (audio-capture) | IMPLEMENTATION_PRESENT |
| Chrome desktop (real) | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Safari desktop | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Android | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| iOS | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Windows | Edge/Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| macOS founder | Safari/Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |

Artifact: `proofs/spe_v1_launch/speech_chrome_probe.json`

## 5. STANDARD vs LITE evidence summary

Artifact: `proofs/spe_v1_launch/standard_vs_lite_bench.json`

- Synthetic kinds: people, product, interior, nature, screenshot, diagram, text-heavy, complex, dark, bright, wide, ambiguous
- onnxRuntimeInvoked: false (Node); subjects simulated for prompt-delta measurement
- Improved: **6** — people, product, interior, nature, screenshot, diagram
- No-gain: **6** — text-heavy, complex, dark, bright, wide, ambiguous (LITE remains appropriate)
- Production: LITE always; STANDARD lazy; homepage vision bytes 0 until requested

## 6. Screenshot→Code 6-target evidence

Targets: HTML/CSS/JS, React, SwiftUI, Jetpack Compose, Flutter, React Native.

- Defect: SwiftUI/Compose ignored bounds (comments only)
- Fix: GeometryReader frame+offset; BoxWithConstraints offset/width/height
- Tests: media + adversarial numeric-bounds asserts; left-rail fixture
- Limit: structure scaffolds + build prompts — not verified pixel clones

## 7. Daily Lab — 14 specimen reviews

| ID | Title | Shape | Review |
| --- | --- | --- | --- |
| d3d-01 | Brushed orbit | torus | Keep — premium metal orbit |
| d3d-02 | Glass chapters | ribbon | Keep — frosted panes |
| d3d-03 | Icosa seed | icosa | Keep — crystal seed |
| d3d-04 | Pillar grid | pillars | Keep — editorial columns |
| d3d-05 | Orb constellation | orb-field | Keep — product beats |
| d3d-06 | Helix brief | helix | Keep — process climb |
| d3d-07 | Soft machine | modules | Upgraded from orb-field clone |
| d3d-08 | Night ledger | slabs | Upgraded from pillars clone |
| d3d-09 | Paper fold | folds | Upgraded from pillars |
| d3d-10 | Signal ring | torus | Keep — privacy pulse |
| d3d-11 | Workshop table | table | Upgraded from torus |
| d3d-12 | Tide ribbon | ribbon | Keep — narrative tide |
| d3d-13 | Facet mirror | icosa | Keep — intent facets |
| d3d-14 | Dawn coil | helix | Keep — finite-queue closer |

## 8. Defects found / fixed

| Defect | Test | Fix |
| --- | --- | --- |
| SwiftUI/Compose no bounds | media + adversarial | GeometryReader / BoxWithConstraints |
| Lab shapes mismatched titles | adversarial daily_lab_14 | Remap + 4 new meshes |
| URL brief lacked site class | media site-class loop | classifySiteClass |
| Speech matrix all UNKNOWN | speech_chrome_probe | Honest Chrome probe rows |
| Prior DNS-as-blocker narrative | this report | DNS out of scope |

## 9. Fresh suite results

| Suite | Result | Exit |
| --- | --- | --- |
| python -m pytest -q | **518 passed** | 0 |
| python -m pytest tests/web -q | **53 passed** | 0 |
| npm run test:media | ok | 0 |
| npm run test:adversarial | ok (13 cases) | 0 |
| npm run test:e2e:v1 | **10/10** | 0 |
| npm run test:engine | VALID | 0 |
| npm run test:copy | PASS | 0 |
| npm run build | PASS | 0 |
| bench-standard-vs-lite | 6 / 6 | 0 |
| speech-chrome-probe | dictation FAIL honest | 0 |

## 10. Visual / product-language

`proofs/spe_v1_launch/predeploy_screens/` — home, create, code, lab, mywork, privacy, mobile-create, lab-reduced-motion.

Visitor copy: Rich Human English. Technical tokens kept in Proof/technical views only.

## 11. Remaining gaps (block PREDEPLOY_READY)

1. Speech — real Chrome desktop / Safari / Android / iPhone qualification NOT_TESTED; box dictation FAIL
2. Image STANDARD — needs in-browser ONNX on diverse real images with documented wins/misses
3. Screenshot→Code — scaffold-grade; no visual resemblance proof beyond IR bounds
4. Hosting/DNS intentionally last (not an app-readiness gate)

## 12. Guardrails honored

- PR #41 not merged
- No spe_runtime/omega/
- No DNS / apex hosting changes
- No fabricated READY / World #1 / production-qualified claims
- Zero extra owner spend
- UI → Worker → spe_wasm.wasm → spe-core-rs preserved

## 13. Final token

**SPE_V1_REBUILD_REQUIRED**
