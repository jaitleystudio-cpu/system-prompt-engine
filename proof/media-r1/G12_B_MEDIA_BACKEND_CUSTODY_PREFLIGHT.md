# G12-B media backend custody preflight

Read-only discovery. No transcription implementation. No product media V1 claim.

| Field | Value |
| --- | --- |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` |
| I1_TOUCHED | NO |
| Product media V1 | not PASS |
| FINAL | HOLD |

## TREE_NOTES

This commit is `fix: refuse non-boolean raw-video explicit need`. It descends from donor `32f1ae20347ca728a6a7b062107289b64ed88eed` (`feat: add speech and video observation custody`). F4 branch lineage is not media lineage and is not used here.

`spe_runtime/media` is an observation IR. It stores envelopes, speaker-neutral transcript custody, scene/keyframe/alignment IR, and `MediaIntentContract`. It does not decode bytes and does not run speech recognition.

- Raw audio retention is OFF only.
- Raw video retention is ON only when `explicitly_needed` is boolean True. Non-booleans are refused in `spe_runtime/media/privacy.py`.
- Network authority is NONE.
- Observation status stays UNVERIFIED. Semantic authority stays NONE.
- Digests are caller-supplied `sha256:` strings. Raw samples, frames, and waveforms are rejected keys.
- `tests/unit/test_media_r1_qualification.py` forbids `whisper`, `ffmpeg`, `torch`, `transformers`, `speech_recognition`, and HTTP clients inside `spe_runtime/media`.
- `tests/qualification/qualify_media_r1.py` records `stt_implemented: NO` and `video_model_implemented: NO`.
- `proof/media-r1/c2-media-r1-evidence.json` still says `final: HOLD` for the non-boolean retention bug. That JSON was not regenerated on this SHA. This preflight does not rescore C2. UNKNOWN is not a pass.

No filename in the tree matches ffmpeg, whisper, vosk, or ggml weights. There is no `import wave` decoder. Python dependencies in `pyproject.toml` are `jsonschema` plus dev `pytest`.

What exists and is not STT custody:

| Surface | What it is | Custody |
| --- | --- | --- |
| `apps/web/src/media/videoSample.ts` | Browser `HTMLVideoElement` keyframes. Copy says audio is not transcribed. Caps in `limits.ts`: 120 MB, 180 s, 8 frames. | Host browser decoder. Not owned. |
| `apps/web/src/input/SpeechInput.tsx` | `SpeechRecognition` / `webkitSpeechRecognition`. UI says the browser may send audio to its speech service. Languages: en-IN, en-US, hi-IN, te-IN, ta-IN, es-ES. | Host/browser speech. Not offline. Not owned. |
| `apps/web/public/models/mobilenetv2-12-int8.onnx` (3,655,033 bytes) plus `ort-wasm-simd-threaded.wasm` (11,246,032 bytes) | ImageNet vision pack. `LICENSE.md`: Apache-2.0 weights, MIT ONNX Runtime. | Vision only. Not an STT model. |
| PR #73 context | WAV stdlib and host ffmpeg were already refused as V1 custody. Those artifacts are not this tree. | Not reused. |

## CANDIDATE_DECODER

Two owned pieces. Host `ffmpeg` is not one of them.

### Audio files, after a WAV/PCM handoff

| Item | Pin |
| --- | --- |
| Name | miniaudio, compiled into whisper.cpp `examples/common-whisper.cpp` |
| Version | miniaudio v0.11.24 (2026-01-17), header at the whisper.cpp commit below |
| License | Public domain or MIT-0, as stated at the top of that header |
| How it is used | `read_audio_data` tries miniaudio first and resamples to `WHISPER_SAMPLE_RATE` 16000. The memory-buffer overload never calls ffmpeg. |
| ffmpeg gate | `WHISPER_COMMON_FFMPEG` must stay undefined. The ffmpeg branch is compile-out, not a fallback. |
| Offline | Yes, once the pinned source is built. |
| Platforms | Same Linux and macOS targets as the STT runtime below. Not built in this run. |

### Video audio extraction

| Item | Pin |
| --- | --- |
| Name | symphonia |
| Version | 0.6.1 (crates.io, 2026-08-13) |
| Registry checksum | `a7edef6a96b696d4e0cab5ee9ebb7ca155ed95f30a6b45bbb8b97d2727f02424` |
| Source | `https://github.com/pdeljanov/Symphonia` tag `v0.6.1` |
| License | MPL-2.0 (`license = "MPL-2.0"` in that tag's `Cargo.toml`). Commercial use and static linking are allowed. Modifications to MPL files must be published. No paid license. |
| Required features | `isomp4`, `mkv`, `wav`, `aac`, `mp3`, `pcm`, `flac`, `vorbis`, `alac`. AAC and MP3 are not default features. |
| Role | Demux audio from MP4/M4A and MKV/WebM and decode the codecs above to PCM. Skip video pictures. Write PCM/WAV into the whisper.cpp memory-buffer reader. |
| Offline | Yes. Pure Rust for those codecs. No C library and no host ffmpeg. |
| Not covered | Opus is not in symphonia 0.6.1. AC-3, E-AC-3, and DTS are not covered. Those inputs fail closed. |

A future media crate must not be added under `portable/spe-core-rs`.

## CANDIDATE_STT_RUNTIME

| Item | Pin |
| --- | --- |
| Name | whisper.cpp |
| Version | tag `v1.9.4` (published 2026-09-11) |
| Annotated tag object | `7d75b14994ae7f59623e2471445e2355fe506ed2` |
| Commit | `927cfce34f31707e17f2bff35c349632fb9e2c3a` |
| Tag signature | unsigned (`verified: false`). Pin the commit, not the floating tag name. |
| License | MIT. Copyright 2023-2026 The ggml authors. `https://github.com/ggml-org/whisper.cpp` |
| Build | CPU. Linux cloud and Mac mini (Apple Silicon Metal may be compiled in and stays offline). Do not define `WHISPER_COMMON_FFMPEG`. No CUDA requirement. No paid API. |
| Offline | Inference is local after the binary and weights are present. |
| Supply status | Source not vendored. Binary not built. SHA256 of a built `whisper-cli` is not recorded. |

Surveyed and not selected:

| Option | Why it is not the pin |
| --- | --- |
| faster-whisper / CTranslate2 | MIT and offline, but a Python wheel stack. Broader supply chain than one C/C++ commit. |
| Vosk | Apache-2.0 runtime and offline, but separate per-language model packs for Hindi, Telugu, Tamil, and Spanish. |
| Cloud STT or the browser Speech API | Conflicts with `NetworkAuthority.NONE` and with offline custody. |
| ONNX Runtime already in `apps/web` | Vision WASM only. No Whisper ONNX weights in the tree. |

## CANDIDATE_MODEL

English-only `.en` weights do not cover the existing language list (Hindi, Telugu, Tamil, Spanish). The candidate is the multilingual small model.

| Item | Value |
| --- | --- |
| File | `ggml-small.bin` |
| Upstream disk / memory class | 466 MiB disk, ~852 MB resident, from the README at commit `927cfce34f31707e17f2bff35c349632fb9e2c3a` |
| Hugging Face repo commit | `5359861c739e955e79d9a303bcbc70fb988958b1` |
| URL | `https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-small.bin` |
| Linked size from HEAD | 487,601,967 bytes |
| Expected SHA256 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` |
| SHA256 source | Hugging Face response header `x-linked-etag` on 2026-09-30. The file was not downloaded. The digest was not recomputed. |
| Xet hash (not the SPE pin) | `edd29d67e70b000132af65205b99bb774b77abc13d10103e14f80ce2242913e1` |
| Upstream table digest | `55356645c2b361a969dfd0ef2c5a50d530afd8d5` in `models/README.md` at tag `v1.9.4`. That cell is 40 hex digits and the README does not name the algorithm. It is not the SHA256 above. |
| Weight license | MIT, OpenAI Whisper, Copyright (c) 2022 OpenAI. ggml conversion does not add a paid license. |
| In-repo status | Weights are absent. Checksum is not pinned in-tree. |

Checksum plan for a later execution lane, not done here:

1. Download only `ggml-small.bin` from the commit-pinned URL.
2. Recompute SHA256 and require an exact match to `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` and size 487,601,967.
3. Record algorithm, digest, byte length, URL, and HF commit in a lockfile next to the weights.
4. Refuse inference if the file is missing or the digest mismatches.

Memory fallback, not the quality candidate: `ggml-base.bin`, HF size 147,951,465, `x-linked-etag` `60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe`, upstream class ~388 MB. Same HF commit. Also not byte-verified. Upstream README class for small is the one that matches Hindi/Telugu/Tamil/Spanish better than base. Neither WER was measured here.

## VIDEO_AUDIO_EXTRACTION_PATH

Owned path:

1. Read the container with symphonia 0.6.1 using the features listed above.
2. Select the audio track. Do not decode pictures.
3. Decode AAC-LC, MP3, PCM, FLAC, Vorbis, or ALAC to PCM.
4. Pass that PCM or a WAV wrapper to whisper.cpp `read_audio_data(buffer, size, ...)`, which resamples to 16 kHz through vendored miniaudio.
5. If the codec is Opus, AC-3, E-AC-3, DTS, or anything else symphonia does not open, stop. Do not call host `ffmpeg`.

Host `ffmpeg`, a system `ffmpeg` on `PATH`, and the browser element decoder are outside custody. A static ffmpeg binary is not pinned and is not the recommended path.

The current website path (`videoSample.ts`) grabs up to 8 canvas frames and states that audio is not transcribed. That path stays a vision observation. It is not this extraction path.

## MEMORY_LATENCY_BOUNDS

Measured on this cloud VM: none. Measured on a Mac mini: none. Latency is UNKNOWN. UNKNOWN is not a pass.

Upstream memory class, README at `927cfce34f31707e17f2bff35c349632fb9e2c3a`, not a SPE measurement:

| Model | Disk | Resident |
| --- | --- | --- |
| tiny | 75 MiB | ~273 MB |
| base | 142 MiB | ~388 MB |
| small (candidate) | 466 MiB | ~852 MB |
| medium | 1.5 GiB | ~2.1 GB |
| large | 2.9 GiB | ~3.9 GB |

Planning arithmetic from pins already in tree and upstream, not a profile:

- Product video cap is 180 s (`MAX_VIDEO_DURATION_SEC`).
- whisper.cpp decodes to 16 kHz mono f32.
- 180 × 16000 × 4 = 11,520,000 bytes of PCM (~11 MB) plus the ~852 MB small-model class.
- Working set for a max-length clip is therefore about 1 GB before allocator overhead, decoder buffers, and the rest of the SPE process.
- Mac mini RAM generation is not identified here. An 8 GB machine can hold the small model. A tighter budget would drop to `ggml-base.bin` (~388 MB class) and would need a separate quality decision.
- No tokens-per-second or wall-time number is claimed for Linux cloud or Mac mini.

## BLOCKERS

Exact missing custody:

1. symphonia 0.6.1 is not vendored or lockfiled in this repo.
2. whisper.cpp `927cfce34f31707e17f2bff35c349632fb9e2c3a` is not vendored. No Linux or macOS binary SHA256 exists.
3. `ggml-small.bin` is not in the repo. The SHA256 above is an HTTP header value, not a hash of bytes held here.
4. The v1.9.4 tag is unsigned.
5. Opus, AC-3, E-AC-3, and DTS have no owned decoder pin. WebM/Opus fails closed until a later lane pins an Opus decoder and its checksum. `symphonia-adapter-libopus` was not pinned, because bundling libopus adds a second source that this run did not checksum.
6. Word-error rate for en-IN, hi-IN, te-IN, ta-IN, and es-ES was not measured.
7. Latency on Linux cloud and on Mac mini was not measured.
8. `proof/media-r1/c2-media-r1-evidence.json` is stale relative to this SHA. It is not evidence that C2 qualification passed.

## RECOMMENDED_NEXT_EXECUTION_BASE

`dd626973185708c46eee59fe2360887a42d330ba`

Next execution, still not this lane: vendor the three pins above, build whisper.cpp with ffmpeg support off, hash `ggml-small.bin` before use, and fail closed on codecs outside the symphonia feature list. Do not start from the F4 branch. Do not treat host ffmpeg as custody. Do not mark media V1 complete.

## I1_TOUCHED

NO

## FINAL

HOLD
