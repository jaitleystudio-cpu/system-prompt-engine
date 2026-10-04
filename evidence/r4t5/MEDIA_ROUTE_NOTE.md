# R4 task 5 /media loopback speech journey

privacy_qualification: HOLD
FIELD_CWV: UNKNOWN
This note is not a privacy qualification, not a field CWV result, and not a product pass.

Recorded: 2026-10-04 11:18 IST
Browser: Google Chrome 154.0.8037.97, playwright channel=chrome, headless
Server: frozen shell `apps/web/scripts/serve-local-product.mjs` on 127.0.0.1:4177
Shell: `/Volumes/4TB-WD/spe-worktrees/spe-lane-r3-e-shell`
Shell branch: `grok/r3-e-shell-20261003`
Shell HEAD: `ca0abf6d9a71d464369976da35cbabd5de9e7150`
SPE_MEDIA_ROOT for that process only: `/Volumes/4TB-WD/spe-worktrees/spe-g12h-te-indep-qual-20261001/proof/media-r1`
The shell worktree was not edited. The server was stopped after the journey. The model was not vendored onto this branch.

## Journey

Opened `http://127.0.0.1:4177/`, then `http://127.0.0.1:4177/media`.
`window.__speWhisper` was not planted and was still undefined.
The page's own route runtime (`pinnedWhisperRuntime`) was used.
Local speech fixture selected through the file input, not through a page global:

`fixtures/human/te_amma_16k.wav` (67694 bytes, sha256 `f255d15c0214d17090da28870209f0af40788322c0b2209f46f2903cb204abba`)

The panel reached `SPEECH` / `review` / `LOCAL_NEURAL`. Transcript length 5, sha256 `d4d25d9dd2e8b9cff472afd285894b75befb673ee0552ddd426a542ca390e8b5`.
The panel's own line said `Network sends for this file: 0`. That counter is the local engine's egressAttempts. It does not erase the same-origin POST recorded below.

A fixture transcription is not a privacy pass. Earlier whole-journey logs (185 loopback requests) stay not a pass. WASM on this privacy branch was not changed and is not the release pin.

## Requests

13 observed. External hosts: none. postBytes: 67694, all on 127.0.0.1. External postBytes: 0.
Loopback is not an external host.

| # | method | host | initiator | postBytes | payload class | class | allowed reason | url |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | 127.0.0.1 | other | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/ |
| 2 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/art/intent-core.webp |
| 3 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/index-D1P-XLMF.js |
| 4 | GET | 127.0.0.1 | script | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/r3f-CJQrfxy_.js |
| 5 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/index-CQOc9ce4.css |
| 6 | GET | 127.0.0.1 | other | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/icon.svg |
| 7 | GET | 127.0.0.1 | other | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/media |
| 8 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/art/intent-core.webp |
| 9 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/index-D1P-XLMF.js |
| 10 | GET | 127.0.0.1 | script | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/r3f-CJQrfxy_.js |
| 11 | GET | 127.0.0.1 | parser | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/assets/index-CQOc9ce4.css |
| 12 | GET | 127.0.0.1 | other | 0 | empty | loopback_asset | loopback_same_device | http://127.0.0.1:4177/icon.svg |
| 13 | POST | 127.0.0.1 | script | 67694 | raw_audio_bytes_loopback | loopback_asset | loopback_same_device | http://127.0.0.1:4177/api/media/transcribe |

Request 13 content-type was `application/octet-stream`. Its body length equals the fixture. It is raw audio bytes on loopback, not an external upload.

## Classification

USER-AUTHORIZED MODEL DOWNLOAD: none. The browser did not GET a model from an external host. The pinned ggml file was already on disk under SPE_MEDIA_ROOT and was not downloaded by this page. A model download would not be a raw media upload. None was observed.

RAW USER DATA EGRESS: none. No request host was outside 127.0.0.1. No raw prompt, audio, transcript, or image bytes were observed on an external host. The audio bytes in request 13 stayed on this machine. The transcript was shown from the loopback response. The webp GET is a loopback asset, not a user image upload.

judgeEgress pass: false. Its qualification was not adopted as a pass. Product privacy verdict remains HOLD. FIELD_CWV remains UNKNOWN.

Full receipt: `evidence/r4t5/media-route-journey.json`.
