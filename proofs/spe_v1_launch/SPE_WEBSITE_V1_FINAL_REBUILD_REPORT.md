# SPE WEBSITE V1 FINAL REBUILD REPORT

Date: 2026-09-24 (Asia/Calcutta / IST)
Branch: `grok/spe-v1-launch-20260924`
Base main: `646d3765153f66c3951d812b8adfd87fcbf766b1`
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**
Start HEAD: `20c8d9710f41c537ee0a969e27869f73eb8849fd`

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

Product rebuild closed the named QUALITY_GAP / PRODUCT_DIRECTION_MISMATCH work for Image, Screenshot, Video, URL X-Ray, and Daily 3D Lab on this branch with fresh tests and three visual rounds. **LAUNCH_CANDIDATE_READY remains blocked** because apex `https://systempromptengine.com` still serves a parked lander (Content-Length 114, `lander_type=parkweb`), not SPE. Speech device rows stay **NOT_TESTED** on this box.

## 2. Custody SHAs

| Token | Meaning | SHA |
| --- | --- | --- |
| MAIN | origin/main | `646d3765153f66c3951d812b8adfd87fcbf766b1` |
| START_HEAD | branch tip at mission start | `20c8d9710f41c537ee0a969e27869f73eb8849fd` |
| IMPLEMENTATION_TESTED_SHA | Suites green through rebuild (fill at commit) | _(post-commit tip)_ |
| VISUAL_EVIDENCE_SHA | final_visual round-1..3 | _(same tip)_ |
| REPORT_SHA | this report body | _(tip-pointer commit; avoid self-hash chase)_ |
| CURRENT_PR_HEAD | PR #41 tip after push | _(post-push)_ |

## 3. Capability matrix (truthful)

| # | Capability | Status | Notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | Browser E2E + engine fixture VALID; UI→Worker→wasm→spe-core-rs |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Matrix in `engine/speechQualification.ts`; all rows NOT_TESTED here; no false on-device claim |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / STANDARD_LAZY | LITE pixel + structure semantics; lazy MobileNet V2 INT8 ONNX (Apache-2.0) when STANDARD loads; LITE fallback; human summaries |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / IR_READY | UIObservationIR (regions/text/controls/layout/palette/typography + evidence); 6 targets sync; scaffolds reflect bounds |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / SCENE_AWARE | Scene-change keyframes + dedupe + sequence/pacing; bounded; no audio transcription; no 8× dumps |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / XRAY_BRIEF | Landmarks/nav/forms/CSS vars/fonts/grid-flex/animation clues; scripts not executed; bounded stream; UNTRUSTED_SOURCE; CORS fallbacks honest |
| 7 | Daily 3D Lab | IMPLEMENTATION_PRESENT / FINITE_QUEUE_14 | Large Three stage + editorial + specimen schema; Prompt Gallery separated; honest 14-day queue |

## 4. Semantic media architecture

| Layer | Tech | Size (approx) | License | When loaded |
| --- | --- | --- | --- | --- |
| LITE | Canvas pixel sampling | 0 download | SPE | Always |
| Structure | composition/style/lighting/projection | 0 | SPE | With media observe |
| OCR-likeness | HF projection bands | 0 | SPE | With media; UNTRUSTED_SOURCE |
| STANDARD | onnxruntime-web WASM + MobileNet V2 INT8 | ~11 MB ORT + ~3.5 MB model | MIT + Apache-2.0 | Lazy on Image/Screenshot STANDARD only |
| Homepage | — | **VISION_MODEL_BYTES = 0** | — | Until media invoke |

Docs: `apps/web/public/models/LICENSE.md`. No silent media egress; `connect-src 'self'`. Vision = OBSERVATION / MODEL_JUDGMENT only — never second K3 / ProtectedIntent / VERIFIED_FACT.

## 5. P0 regression status

Reran first; all green before rebuild continued:

- `python -m pytest tests/web -q` → 53 passed (post-rebuild)
- `node apps/web/scripts/test-media-observe.mjs` → ok
- `npm run test:engine` → VALID, `used_ts_fallback: false`
- `npm run test:copy` → PASS
- Intent / Daily Lab open / codeTarget / AbortController / .spe / URL bounds / UNTRUSTED preserved

## 6. Fresh test commands (this session)

| Suite | Command | Result | Exit |
| --- | --- | --- | --- |
| Full pytest | `python -m pytest -q` | **518 passed** | 0 |
| Web gates | `python -m pytest tests/web -q` | **53 passed** | 0 |
| Media unit | `node apps/web/scripts/test-media-observe.mjs` | ok (IR, 6 scaffolds, scene, X-Ray, vision 0) | 0 |
| Adversarial | `node apps/web/scripts/test-adversarial-v1.mjs` | ok | 0 |
| E2E 7 caps | `node apps/web/scripts/e2e-v1-capabilities.mjs` | **10/10 behavioral** | 0 |
| Engine fixture | `cd apps/web && npm run test:engine` | VALID | 0 |
| Copy golden | `cd apps/web && npm run test:copy` | PASS | 0 |
| Production build | `cd apps/web && npm run build` | PASS (copy gate 0 violations) | 0 |
| Asset budget | `node apps/web/scripts/measure-assets.mjs` | within shell budget (lazy ORT/R3F excluded) | 0 |

## 7. Visual evidence

Three genuine rounds **after** rebuild:

`proofs/spe_v1_launch/final_visual/round-{1,2,3}/` — 8 PNGs + `review.md` each (27 files).

## 8. Production blocker — ONE founder action

**Blocker:** Apex does not serve SPE.

Evidence (`proofs/spe_v1_launch/apex_headers.txt`):

```
HTTP/1.1 200 OK
Content-Type: text/html
Content-Length: 114
```

`/lander` sets `lander_type=parkweb` cookies (`lander_headers.txt`).

### Exact founder action

1. Remove the parkweb / parking-page configuration for `systempromptengine.com` at the DNS/hosting registrar (or CDN) so apex is no longer a lander.
2. Point the apex host to a static origin that serves this repo’s `apps/web/dist` (including `spe_wasm.wasm`, `_headers`, `/models`, `/ort`).
3. Verify:

```bash
curl -sI https://systempromptengine.com | head -20
# Expect: large HTML (not Content-Length: 114), no lander_type=parkweb
curl -s https://systempromptengine.com | head -c 200
# Expect: SPE app shell (title/SPE), not a parking page
```

Render MCP was unauthorized in this session; no alternate production origin was claimed.

## 9. Remaining gaps

1. Apex not serving SPE (blocks READY)
2. Speech device qualification still NOT_TESTED (hardware)
3. STANDARD ONNX quality varies by device; LITE always available
4. OCR is text-likeness (not full Tesseract) by default — honest UNTRUSTED bands

## 10. Guardrails honored

- Did not merge PR #41
- Did not create `spe_runtime/omega/` or WEB-04
- Did not spend ₹ on paid vision/proxy APIs
- Did not fabricate apex READY / on-device speech

## 11. Final token

**SPE_V1_REBUILD_REQUIRED**
