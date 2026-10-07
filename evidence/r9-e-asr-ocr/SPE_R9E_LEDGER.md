# SPE-R9-E — Local ASR/OCR product integration gaps

**Status:** `SPE_R9E_COMPLETE` (integration gaps closed where architecture already owned; product stamps remain honest HOLD / NOT_PASS)

**Date:** 2026-10-07 IST (Asia/Calcutta)  
**Base tip:** `895a3230d445089b3fdb48fbbb101e7b539f58c8` (`grok/r9-d-studio-runtime-journey`)  
**Branch:** `grok/r9-e-asr-ocr-gaps`  
**Tip:** `138e52691b4fdb05665997273de84a35163e954a`  
**Repo:** `jaitleystudio-cpu/system-prompt-engine`  
**Machine:** Prawins-Mac-mini.local (arm64 packs)

## What already owned (not invented)

| Path | Owner |
|---|---|
| ASR / Audio→Text local neural | `spe_runtime.media_product` → pinned `whisper-cli` + Telugu ggml via relative `media-pack` |
| Web ASR runtime | `pinnedWhisperRuntime` → `/api/media/transcribe` via `createLocalMediaHost` |
| OCR | `spe_runtime.ocr_product` → pinned Tesseract via relative `ocr-pack` |
| Web OCR runtime | `ocrLite.recognizeImageFile` → `/api/ocr/recognize` via `createLocalOcrHost` |
| Routes | `/media`, `/ocr` already in `App.tsx` / `routing.ts` |

**Not invented:** ResearchEngine2, second ASR/OCR engines, fake PASS stamps.

## Gaps closed (BUILD)

1. **OCR shell mount ledger** — added `OCR_MOUNT` in `apps/web/src/shell/mountStatus.ts` (parity with MEDIA/WEBSITE/RESEARCH/STUDIO).
2. **OCR mount contract** — added `apps/web/src/media/ocr-mount-contract.ts` (mirrors `media/mount-contract.ts`; `OCR_PRODUCT: "HOLD"`).
3. **OcrRoute health surface** — reads `/api/ocr/health` for `execution` / `missing` without ever promoting `OCR_PRODUCT` off HOLD; `data-shell-mount="ocr"`.
4. **Product static server disclosure** — `serve-local-product.mjs` logs `OCR_OWNER` alongside `MEDIA_OWNER`.
5. **Regression** — `test-r6-ocr-route.mjs` asserts mount contract, shell OCR_MOUNT, serve OCR_OWNER, and no PASS stamp in contract.
6. **Copy inventory** — reviewed R9-E OCR mount / host-execution strings only.

## Real inference receipts (required)

| Receipt | Result | Product stamp |
|---|---|---|
| `ocr_inference_receipt.json` | `LOCAL_OCR`, text `SPE OCR LANE R6 HOLDFAST`, egress 0 | `OCR_PRODUCT=HOLD` |
| `ocr_route_http_receipt.json` | route_host `/recognize` → `LOCAL_OCR`; health `execution=LOCAL_OCR` | `OCR_PRODUCT=HOLD` |
| `asr_inference_receipt.json` | `SPEECH` / `LOCAL_NEURAL` / `అమ్మా` / neuralSessionRan | `PRODUCT_MEDIA_V1=NOT_PASS` |
| `asr_route_http_receipt.json` | route_host `/transcribe` same neural result | `productMediaV1=NOT_PASS`, `remainingGap=JOURNEY_NOT_RECORDED` |

Pack digests used (pinned):

- whisper-cli `c52fa726…d2c40` / ggml-te-small `47369abd…d49e`
- tesseract `42ac364d…04e8` / eng.traineddata `7d4322bd…70b2`

## Honest non-claims

- **Audio→Text / Real ASR product qualification remains HOLD** (not flipped to PASS).
- **`PRODUCT_MEDIA_V1` remains `NOT_PASS`** — journey still requires absence-before-fetch + verified model ingress + verified CLI build + LOCAL_NEURAL + egress 0 recorded together; this run used pre-seeded relative packs (`cli_built=false`, `raw_download=false`).
- **`UI_INTEGRATED` / `UI_MOUNTED` remain `NO` in `product_gates`** — shell UI code exists; those gates require proven browser journey and stay unflipped by design.
- **`OCR_PRODUCT` remains `HOLD`** — `LOCAL_OCR` is execution evidence only (`missing=RELEASE_NOT_QUALIFIED`).
- No main merge, deploy, force-push, or weakened tests.
- No ResearchEngine2 / second engine.
- Browser Web Speech is not this path.

## Tests run

- `node --experimental-strip-types apps/web/scripts/test-r6-ocr-route.mjs` → PASS
- Live Python `LocalOcrSession.recognize` + `LocalMediaSession.transcribe_path` → receipts above
- Live `python3 -m spe_runtime.ocr_product.route_host` + `media_product.route_host` HTTP → receipts above

## Packs note

Relative `media-pack/` / `ocr-pack/` binaries remain gitignored. This machine hard-linked pinned binaries from prior R6 worktrees into the relative packs for inference. Manifests alone stay in git.
