# SPE Ω — Lane A10 Media UX Capability Preflight Specification

**Target Release:** 2026-10-10 22:10 IST  
**Status:** `PREFLIGHT ONLY` (Zero backend execution; UI contract specification)  
**Governing Backend Fact Base:** G12-C Offline Media Backend Qualification Receipt ([PR #85](https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/85) / Commit `2cbedf5`)

---

## 1. System Intent & Constraints

The Lane A10 Media Workspace provides a local, private media intake and inspection interface. In accordance with SPE Round-2 Implementation Law:
- **`LIVE_TRANSCRIPTION_STATUS = UNAVAILABLE`**: Real-time microphone audio streaming is strictly disabled.
- **`BACKEND_EXECUTION = GATED`**: Media compilation requires explicit user action on an offline batch file.
- **`HOST_FFMPEG_PRODUCT_PATH = PROHIBITED`**: The production decode pipeline relies exclusively on Symphonia 0.6.1 and whisper.cpp miniaudio. The UI must never rely on host ffmpeg fallback.
- **`NETWORK_EGRESS = 0`**: No telemetry, audio data, or transcription tokens may leave the local boundary.

---

## 2. Codec & Format Matrix (Client-Side Dropzone Enforcement)

The UI dropzone must perform immediate client-side MIME and container inspection. Unsupported formats must fail-closed with clear, non-technical feedback before allocating any memory buffers.

| Format / Codec | MIME Type | Decoder Engine | Dropzone Status | User-Facing Feedback |
|---|---|---|---|---|
| **WAV / PCM** | `audio/wav`, `audio/x-wav` | Symphonia / PCM | 🟢 **ACCEPTED** | "WAV PCM audio ready for offline analysis." |
| **MP3** | `audio/mpeg` | Symphonia / MP3 | 🟢 **ACCEPTED** | "MP3 audio ready for offline analysis." |
| **AAC / M4A** | `audio/aac`, `audio/mp4` | Symphonia / AAC | 🟢 **ACCEPTED** | "AAC/M4A audio ready for offline analysis." |
| **FLAC** | `audio/flac` | Symphonia / FLAC | 🟢 **ACCEPTED** | "Lossless FLAC audio ready for offline analysis." |
| **OGG / Vorbis** | `audio/ogg` | Symphonia / Vorbis | 🟢 **ACCEPTED** | "Ogg Vorbis audio ready for offline analysis." |
| **ALAC** | `audio/mp4` | Symphonia / ALAC | 🟢 **ACCEPTED** | "Apple Lossless audio ready for offline analysis." |
| **MKV / WebM** | `video/webm`, `video/x-matroska` | Symphonia / MKV | 🟢 **ACCEPTED** | "Video container audio track accepted." |
| **Opus** | `audio/opus`, `audio/ogg; codecs=opus` | Symphonia (Unsupported) | 🔴 **REJECTED** | "Opus codec is unsupported in offline mode. Please provide PCM, MP3, or AAC." |
| **AC-3 / E-AC-3** | `audio/ac3` | Symphonia (Unsupported) | 🔴 **REJECTED** | "Dolby AC-3 audio is unsupported. Please convert to stereo PCM or AAC." |
| **DTS** | `audio/vnd.dts` | Symphonia (Unsupported) | 🔴 **REJECTED** | "DTS audio is unsupported. Please provide standard PCM or MP3." |

---

## 3. Language & Model Transcription Capability Matrix

Based on empirical WER/CER measurements from `ggml-small.bin` (Model SHA-256 `1be3a9b2...`), the UI must display truthful language badges:

| Language | Empirical Metric | UI Status Tag | Explanatory Notice |
|---|---|---|---|
| **English** | `WER = 0.0` (JFK RTF ≈ 0.41) | 🟢 **QUALIFIED** | High-fidelity offline transcription available. |
| **Tamil** | `WER = 0.0` (CER = 0.05) | 🟢 **QUALIFIED** | Verified high-accuracy transcription in native script. |
| **Hindi** | `WER = 0.4` (CER = 0.10) | 🟡 **BETA** | High phonetic accuracy; manual editorial review recommended. |
| **Spanish** | `WER = 0.75` (CER ≈ 0.22) | 🟡 **EXPERIMENTAL** | Moderate error rate observed on complex syntax. |
| **Telugu** | `WER = 1.0` (CER = 1.00) | 🔴 **GATED** | Script Defect: ggml-small emits Devanagari rather than Telugu script. Language gated pending G12-F root-cause resolution. |

---

## 4. Hardware Headroom & Performance Indicators

The UI must reflect real hardware metrics recorded on Apple M2 Silicon:
1. **Memory Requirement:** Peak RSS is ~788 MiB (`826,294,272 bytes`). Prior to model invocation, the UI displays a memory advisory if browser available heap is $< 1.0 \text{ GiB}$.
2. **Cold Load Latency:** Initial load requires $\approx 3.81\text{ s}$ to map model weights into memory and compile Metal shaders. The UI displays an active progress indicator: `"Initializing local GGML Metal engine..."`.
3. **Warm Execution:** Warm median Real-Time Factor (RTF) is $\approx 3.23\text{x}$. A 10-second audio clip processes in $\approx 3.1\text{ s}$.
4. **Privacy Invariant:** A prominent, permanent badge states: `"🔒 Offline Processing: Zero Bytes Transmitted. Local Memory Cleared on Exit."`
