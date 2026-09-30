# G12-C Offline Media Backend Qualification Report

Local Mac mini qualification. ₹0. Draft branch/PR only. NO MERGE. NO DEPLOY. NO HOST ffmpeg product path. No UI integration. LIVE_TRANSCRIPTION = UNAVAILABLE.

| Field | Value |
| --- | --- |
| DATE_LOCAL | 2026-10-01 Asia/Calcutta (IST) |
| MACHINE | Prawins-Mac-mini.local Apple M2 arm64, 8 GB RAM, 8 CPU, macOS 27.2 (26B5091g) |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` |
| BRANCH | `grok/spe-g12c-media-backend-qual-20261001` |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-g12c-media-backend-qual-20261001` |
| G12_B_PRIOR | PR #77 @ `6cdcdddfd692a349ea78472bb3082d16b4075b68` |
| I1_TOUCHED | NO |
| I2_STARTED | NO |
| PIN_MODIFIED | NO |
| LIVE_TRANSCRIPTION | UNAVAILABLE |
| UI_INTEGRATED | NO |
| HOST_FFMPEG_PRODUCT_PATH | NO |
| FINAL | MEDIA_BACKEND_FOUNDATION_PASS |

## Required field block

```
SOURCE_PIN=927cfce34f31707e17f2bff35c349632fb9e2c3a
MODEL_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
MODEL_BYTES=487601967
BINARY_SHA256=784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7
BUILD=Release AppleClang 21.0.0 (clang-2100.3.34.2); Metal ON; WHISPER_COMMON_FFMPEG=UNDEFINED; -DCMAKE_BUILD_TYPE=Release; WHISPER_FFMPEG deprecated alias OFF
DECODERS=WAV/PCM=PASS MP3=PASS AAC/M4A=PASS FLAC=PASS Vorbis/OGG=PASS ALAC=PASS MKV/WebM(Vorbis)=PASS; Opus=UNSUPPORTED AC-3=UNSUPPORTED E-AC-3=UNSUPPORTED DTS=UNSUPPORTED (fail closed, no ffmpeg fallback)
ENGLISH_WER=0.0 (en_tts controlled); also JFK WER=0.0
HINDI_WER=0.4 (hi_tts; CER=0.1; लेखा→लेका)
TELUGU_WER=1.0 (te_tts; hyp emitted Devanagari not Telugu script; CER=1.0)
TAMIL_WER=0.0 (ta_tts; CER=0.05 punctuation-only)
SPANISH_WER=0.75 (es_tts; CER≈0.222; "me llamo Mónica"→"media monónica")
PEAK_RSS=826294272 bytes (~788 MiB) across warm STT runs
RTF≈3.23 warm median (wall/audio); JFK warm MP3 RTF≈0.41; cold first JFK wall 41.97s includes Metal shader compile
MODEL_LOAD_MS=3808.41
NETWORK_EGRESS=0
RAW_AUDIO_RETENTION=OFF
UNSUPPORTED_CODECS=Opus, AC-3, E-AC-3, DTS
I1_TOUCHED=NO
I2_STARTED=NO
PIN_MODIFIED=NO
FINAL=MEDIA_BACKEND_FOUNDATION_PASS
```

## 1. SUPPLY-CUSTODY

### whisper.cpp

| Item | Value |
| --- | --- |
| SOURCE_PIN | `927cfce34f31707e17f2bff35c349632fb9e2c3a` |
| Upstream | https://github.com/ggml-org/whisper.cpp |
| Local path | `proof/media-r1/vendor/whisper.cpp` (cloned at pin; gitignored from PR blob; rebuild from pin) |
| License | MIT |
| WHISPER_COMMON_FFMPEG | UNDEFINED (cmake option default OFF; never enabled; no ffmpeg symbols/dylibs on whisper-cli) |

### ggml-small.bin

| Item | Value |
| --- | --- |
| URL | `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin` |
| HF commit | `5359861c739e955e79d9a303bcbc70fb988958b1` |
| MODEL_BYTES | 487601967 |
| Expected SHA-256 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| Local SHA-256 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` (recomputed with `shasum -a 256`) |
| Verify | PASS (fail-closed on mismatch) |
| Lockfile | `proof/media-r1/models/ggml-small.lock.json` |
| Note | Digests are local recompute, not trusted from `x-linked-etag` alone. |

### Symphonia 0.6.1

| Item | Value |
| --- | --- |
| Registry checksum | `a7edef6a96b696d4e0cab5ee9ebb7ca155ed95f30a6b45bbb8b97d2727f02424` |
| Local `.crate` SHA-256 | match |
| License | MPL-2.0 |
| Features used | `isomp4`, `mkv`, `wav`, `aac`, `mp3`, `pcm`, `flac`, `vorbis`, `alac`, `ogg` |
| Lock | `proof/media-r1/vendor/symphonia/SYMPHONIA_0_6_1_LOCK.json` + decoder-proof `Cargo.lock` |

Host `ffmpeg` exists on PATH for fixture baking only (`FIXTURE_GEN_NOTE.txt`). Product decode path is Symphonia + whisper.cpp miniaudio. No ffmpeg fallback.

## 2. BUILD

| Item | Value |
| --- | --- |
| BUILD_SHA / SOURCE_PIN | `927cfce34f31707e17f2bff35c349632fb9e2c3a` |
| COMPILER | Apple clang version 21.0.0 (clang-2100.3.34.2) |
| BUILD_FLAGS | `-DCMAKE_BUILD_TYPE=Release`; Metal backend included; BLAS/Accelerate; `WHISPER_COMMON_FFMPEG` UNDEFINED |
| BINARY | `proof/media-r1/build/whisper-cmake/bin/whisper-cli` (local; not committed) |
| BINARY_SHA256 | `784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7` |
| Platform | arm64 Apple M2 |
| CPU | Apple M2 |
| RAM | 8589934592 bytes (8 GB) |
| OS | macOS 27.2 (26B5091g) |
| Provenance JSON | `proof/media-r1/build/BUILD_PROVENANCE.json` |

## 3. DECODER PROOF (Symphonia 0.6.1)

Harness: `proof/media-r1/decoder-proof/` (Rust, pinned `symphonia = "=0.6.1"`). Results: `proof/media-r1/decoder-proof/DECODER_RESULTS.txt`.

| Fixture class | Result |
| --- | --- |
| WAV/PCM | PASS |
| MP3 | PASS |
| AAC/M4A | PASS |
| FLAC | PASS |
| Vorbis (OGG / MKV / WebM) | PASS |
| ALAC | PASS |
| Opus (WebM) | UNSUPPORTED (fail closed) |
| AC-3 | UNSUPPORTED |
| E-AC-3 | UNSUPPORTED |
| DTS | UNSUPPORTED |

whisper.cpp miniaudio path confirmed for WAV/MP3/FLAC (`trying to decode with miniaudio`; no `trying to decode with ffmpeg`).

## 4. STT BENCHMARK

Controlled fixtures: macOS `say` TTS → 16 kHz mono WAV via `afconvert`, plus whisper.cpp `samples/jfk.wav` / `jfk.mp3`. Metrics: `proof/media-r1/bench/STT_METRICS.json`.

| Tag | Lang | Duration s | Wall s | RTF | Peak RSS MiB | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| jfk_en | en | 11.0 | 41.97 | 3.82 | 680 | cold Metal compile + model load |
| jfk_mp3 | en | 11.0 | 4.55 | 0.41 | 716 | warm; miniaudio MP3 |
| en_tts | en | 2.67 | 5.08 | 1.90 | 716 | |
| hi_tts | hi | 1.93 | 4.56 | 2.36 | 788 | |
| te_tts | te | 1.92 | 6.23 | 3.24 | 715 | |
| ta_tts | ta | 1.67 | 5.41 | 3.23 | 788 | |
| es_tts | es | 1.26 | 4.74 | 3.76 | 717 | |

Timed print (`whisper_print_timings`):

- MODEL_LOAD_MS = 3808.41
- encode time ≈ 283.81 ms (en_tts 2.7 s audio)
- total time ≈ 5014.50 ms (includes load)

CPU util: user/wall is low (~0.03–0.05) because Metal GPU does the work; do not treat user-CPU fraction as “idle fail”.

## 5. WER / CER (fixture-local only)

No universal accuracy claim. Values are for these fixtures only.

| Language | Fixture | WER | CER | Ref → Hyp note |
| --- | --- | --- | --- | --- |
| EN | en_tts | 0.0 | 0.0 | exact |
| EN | jfk | 0.0 | ~0.036 | punctuation only |
| HI | hi_tts | 0.4 | 0.1 | लेखा → लेका |
| TE | te_tts | 1.0 | 1.0 | Telugu script ref; hyp Devanagari |
| TA | ta_tts | 0.0 | 0.05 | punctuation |
| ES | es_tts | 0.75 | ~0.222 | “me llamo Mónica” → “media monónica” |

## 6. PRIVACY

| Check | Result |
| --- | --- |
| NETWORK_EGRESS during inference | 0 — `lsof` on whisper-cli PID showed no TCP/UDP; only local model/dylibs/Metal cache |
| Cloud STT | not used |
| Browser SpeechRecognition | not used in this lane; not wired |
| Telemetry | none added |
| RAW_AUDIO_RETENTION | OFF (`spe_runtime/media/privacy.py` unchanged; RawAudioRetentionPolicy refuses non-OFF) |
| NetworkAuthority | NONE (unchanged) |

## 7. NON-GOALS / UNTOUCHED

- I1 runtime / WASM pin / XCAT / K3 / Quality / Core-B / main / G10/G11/G13 trees: not touched
- UI: not integrated
- LIVE_TRANSCRIPTION: UNAVAILABLE
- Product media V1 claim: not asserted (foundation only)
- Opus/AC-3/E-AC-3/DTS product support: HOLD until a later pin; fail closed now

## 8. FINAL

Foundation pins built, checksums verified locally, offline STT runs on Mac mini with network egress 0, supported codecs decode without host ffmpeg, unsupported codecs fail closed.

**FINAL=MEDIA_BACKEND_FOUNDATION_PASS**

Language-quality gaps (TE script, ES phrasing, HI one-character) are recorded as measured WER/CER, not PASS claims.
