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
| CURRENT_PR_HEAD | *(filled after push — see tip pointer commit)* |

## 3. Capability matrix (truthful)

| # | Capability | Status | Evidence notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | E2E compile path green; `npm run test:engine` VALID; `used_ts_fallback` false |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Chrome headless probe: API YES, fake-mic YES, dictation FAIL (`audio-capture`); Safari / Android Chrome / iPhone Safari **NOT_TESTED** |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY | LITE always; STANDARD = lazy MobileNet INT8. Synthetic bench: 6/12 kinds improved with subjects, 6/12 no-gain (LITE appropriate). Real ONNX not invoked in Node |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / STRUCTURE_SCAFFOLD | All 6 targets encode numeric bounds (SwiftUI GeometryReader + Compose BoxWithConstraints fixed). Not a pixel clone |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE | Dedupe + scene keyframes; no audio transcription claims; media unit green |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / XRAY_BRIEF | Site-class heuristics + landmarks/nav/forms/CSS; scripts never executed; UNTRUSTED_SOURCE; CORS honesty |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Shape/title misalignment fixed; 4 new geometries (modules/slabs/folds/table); Prompt Gallery separated |

## 4. Speech matrix

| Platform | Browser | API | Mic | Dictation | Status |
| --- | --- | --- | --- | --- | --- |
| Linux box (agent) | Chromium headless | YES | YES (fake) | FAIL (audio-capture) | IMPLEMENTATION_PRESENT |
| Chrome desktop (real) | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Safari desktop | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| macOS founder | Safari/Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Windows | Edge/Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| Android | Chrome | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |
| iOS | Safari | UNKNOWN | NOT_TESTED | NOT_TESTED | NOT_TESTED |

Probe artifact: `proofs/spe_v1_launch/speech_chrome_probe.json`

Permission allow/deny, start/stop, transcript edit, mixed speech+typing, mic cleanup: UI/implementation present; full matrix rows above remain NOT_TESTED on real devices.

## 5. STANDARD vs LITE evidence summary

Artifact: `proofs/spe_v1_launch/standard_vs_lite_bench.json`

- Mode: synthetic ImageData kinds (people, product, interior, nature, screenshot, diagram, text-heavy, complex, dark, bright, wide, ambiguous)
- `onnxRuntimeInvoked: false` (Node has no `window`; STANDARD subjects simulated)
- Improved (subject labels enrich prompt): **6**
- No-gain / LITE appropriate: **6**
- Cases where STANDARD does **not** help: text-heavy, complex, dark, bright, wide, ambiguous (no confident subjects)
- Production path: LITE always available; STANDARD lazy-loads ORT+MobileNet only when requested; homepage vision bytes stay 0 until then

## 6. Screenshot→Code 6-target evidence

Targets: HTML/CSS/JS, React, SwiftUI, Jetpack Compose, Flutter, React Native.

Defect found & fixed:
- SwiftUI / Compose scaffolds previously ignored region bounds (comments only) → **FAILING resemblance**
- Fix: SwiftUI `GeometryReader` frame+offset from bounds; Compose `BoxWithConstraints` offset/width/height
- Regression: media + adversarial assert numeric bounds in all 6 scaffolds; left-rail fixture expects rail/sidebar language

Honest limit: scaffolds are structure mirrors + build prompts, not verified pixel reconstructions of arbitrary screenshots.

## 7. Daily Lab — 14 specimen reviews

Shape/title scramble was a product defect (e.g. “Icosa seed” rendered as ribbon). Corrected + distinct shapes for soft machine / night ledger / paper fold / workshop table.

| ID | Title | Shape | Review |
| --- | --- | --- | --- |
| d3d-01 | Brushed orbit | torus | Want-to-build metal orbit hero — keep |
| d3d-02 | Glass chapters | ribbon | Frosted chapter panes — keep |
| d3d-03 | Icosa seed | icosa | Crystal idea seed — keep |
| d3d-04 | Pillar grid | pillars | Editorial columns — keep |
| d3d-05 | Orb constellation | orb-field | Product-beat orbs — keep |
| d3d-06 | Helix brief | helix | Process climb — keep |
| d3d-07 | Soft machine | modules | Was orb-field clone; now docking modules — upgraded |
| d3d-08 | Night ledger | slabs | Was pillars clone; now dark slabs — upgraded |
| d3d-09 | Paper fold | folds | Was pillars; now fold planes — upgraded |
| d3d-10 | Signal ring | torus | Privacy pulse ring — keep |
| d3d-11 | Workshop table | table | Was torus; now craft table still-life — upgraded |
| d3d-12 | Tide ribbon | ribbon | Narrative tide — keep |
| d3d-13 | Facet mirror | icosa | Intent facets — keep |
| d3d-14 | Dawn coil | helix | Finite-queue closer — keep |

Finite queue honesty preserved (14 days, not endless). Prompt Gallery remains separate.

## 8. Defects found / fixed (this pass)

| Defect | Repro | Test | Fix |
| --- | --- | --- | --- |
| SwiftUI/Compose no layout bounds | Inspect scaffolds | media + adversarial bounds asserts | GeometryReader / BoxWithConstraints |
| Daily Lab shapes mismatched titles | Compare id→shape | adversarial `daily_lab_14_distinct_shapes` | Remap + add modules/slabs/folds/table meshes |
| URL brief lacked site-class signal | Marketing/SPA/ecom HTML fixtures | media site-class loop | `classifySiteClass` + brief line |
| Speech matrix all UNKNOWN on box | Chrome probe | speech_chrome_probe.json | Record API/mic/dictation honestly |
| Prior report framed DNS as blocker | Mission brief | this report | DNS out of scope; quality gaps named |

## 9. Fresh suite results

| Suite | Result | Exit |
| --- | --- | --- |
| `python -m pytest -q` | **518 passed** | 0 |
| `python -m pytest tests/web -q` | **53 passed** | 0 |
| `npm run test:media` | ok | 0 |
| `npm run test:adversarial` | ok (13 cases) | 0 |
| `npm run test:e2e:v1` | **10/10** behavioral | 0 |
| `npm run test:engine` | VALID | 0 |
| `npm run test:copy` | PASS | 0 |
| `npm run build` | PASS (dist present) | 0 |
| `bench-standard-vs-lite.mjs` | ok (6 improve / 6 no-gain) | 0 |
| `speech-chrome-probe.mjs` | ok (dictation FAIL honest) | 0 |

## 10. Visual / product-language

Screens: `proofs/spe_v1_launch/predeploy_screens/` — home, create, code, lab, mywork, privacy, mobile-create, lab-reduced-motion.

Visitor-facing copy: Rich Human English; technical tokens (ORT WASM, MobileNet INT8, UIObservationIR, XRAY_BRIEF, etc.) kept out of visitor chrome (Proof/technical only).

## 11. Remaining gaps (block PREDEPLOY_READY)

1. **Speech** — real Chrome desktop / Safari / Android Chrome / iPhone Safari qualification still NOT_TESTED; box dictation FAIL
2. **Image STANDARD** — needs in-browser ONNX run on diverse real images with documented wins/misses (Node bench is simulated subjects)
3. **Screenshot→Code** — still scaffold-grade; no fixture proving generated UI visually resembles complex real screenshots beyond IR bounds
4. Hosting/DNS intentionally last (not counted as app readiness)

## 12. Guardrails honored

- PR #41 not merged
- No `spe_runtime/omega/`
- No DNS / apex hosting changes
- No fabricated READY / World #1 / production-qualified claims
- ₹0 extra owner spend
- UI → Worker → `spe_wasm.wasm` → spe-core-rs preserved

## 13. Final token

**SPE_V1_REBUILD_REQUIRED**
