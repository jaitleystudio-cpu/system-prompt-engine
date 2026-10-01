# G12-G Telugu-Specific Human Bench Report (SPE Ω)

MODE: Local ₹0 Telugu-specialized challenger evaluation vs multilingual small baseline.
No UI. No live transcription. No merge/deploy/host. No I1/I2/WASM touch. No PR #85/#86 touch.
G12-F push is a sibling task — this gate is G12-G bench only.

| Field | Value |
| --- | --- |
| DATE_LOCAL | 2026-10-01 Asia/Calcutta (IST) |
| MACHINE | Prawins-Mac-mini.local Apple M2 arm64 8 GB |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-g12g-te-human-bench-20261001` |
| BRANCH | `grok/spe-g12g-te-human-bench-20261001` |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` |
| PRIOR_G12_C | frozen @ `2cbedf5` / PR #85 — **not mutated** |
| PRIOR_G12_D | TE=`MODEL_CAPABILITY_TELUGU_SCRIPT` (wrong-script HOLD) |
| PRIOR_G12_E | `OVERALL=NO_MODEL_MEETS_GATE`; medium script-only |
| PRIOR_G12_F | recommended TE-specific small ggml (research); founder authorized G12-G |
| SOURCE_PIN | whisper.cpp `927cfce34f31707e17f2bff35c349632fb9e2c3a` (**unchanged**) |
| BINARY_SHA256 | `784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7` |
| NETWORK_EGRESS (inference) | **0** (offline after one-time HF custody download) |

## 0. Preserve

- G12-F worktree/branch left alone (sibling).
- No product code changes; proof-only artifacts under `proof/media-r1/`.

## 1. Custody BEFORE download (PASS)

Documented in `proof/media-r1/models/CUSTODY_BEFORE_DOWNLOAD.md` **before** any download.

```
UPSTREAM_REPO=https://huggingface.co/ukta-app/indic-whisper-ggml
UPSTREAM_COMMIT=a3d637b81797a1d680e6933b71058ac9e00681fd
UPSTREAM_FILE_INTRODUCED_COMMIT=4168702a4120ab864413cd6f61d0baba89352cec
MODEL_FILE=ggml-te-small.bin
MODEL_BYTES=190085487
SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
LICENSE=Apache-2.0
WHISPER_CPP_COMPATIBILITY=YES
FINE_TUNE_SOURCE=vasista22/whisper-telugu-small@717212f9c4c16a78a86ddcb98f93c7f73ef8a5cc (Apache-2.0)
QUANT=q5_1
CROSS_CUSTODY_SECONDARY=bhaskaro/ainotes-whisper-telugu-q5_1@11bb1860bf271666c5f3ae709b7414cf993608b4 file=ggml-model.bin identical LFS oid
ARBITRARY_MIRROR=NO
CUSTODY_PRECHECK=PASS
```

Post-download local recompute: `sha256` + bytes match expected → `verify=PASS` in `models/ggml-te-small.lock.json`.

Baseline reused from G12-C custody (symlink): `ggml-small.bin` SHA256=`1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` (487601967 bytes, MIT).

## 2. Human fixture gate (PASS)

Reuse of G12-D lawful Wikimedia Commons Telugu human fixtures (see `fixtures/human/G12_G_HUMAN_FIXTURE_CATALOG.md`).

| Fixture | Speaker ID | Duration | Quality | Dialect | Ref | License |
| --- | --- | --- | --- | --- | --- | --- |
| te_namaskaramu_16k | TE-SPK-COMMONS-01 | 1.998 s | clean single-word | UNKNOWN | నమస్కారము (manual verify) | Wikimedia Commons |
| te_amma_16k | TE-SPK-COMMONS-02 | 2.113 s | clean single-word | UNKNOWN | అమ్మ (manual verify) | Wikimedia Commons |
| te_dengue_intro_30s | TE-SPK-COMMONS-03 | 30.016 s | spoken medical intro | UNKNOWN | NO_VERIFIED_FULL_REF (WER=N/A; script+content qualitative) | Wikimedia Commons |

TTS `te_pcm16` is **supplementary only** (not product cert). No unnecessary identity retained.

`HUMAN_FIXTURE_GATE=PASS` — multiple lawful human TE fixtures with verified short refs present.

## 3. Controlled comparison

Identical across models:

- whisper.cpp pin `927cfce34f31707e17f2bff35c349632fb9e2c3a`
- same `whisper-cli` binary SHA256 above
- hardware: Apple M2 8 GB
- same audio bytes (SHA256 recorded per case)
- decode: `-tp 0 -bs 5 -bo 5 -t 4 -p 1 -fa -nt`
- `-nt` applied to **both** (TE fine-tune requires no timestamps; fairness)
- language: explicit `-l te` **and** `-l auto` separately
- NFC normalization for WER/CER; whitespace-token WER; character CER

Differed: **model file only** (`ggml-small.bin` vs `ggml-te-small.bin`).

## 4. Results

### 4.1 Script gate (human)

| Model | Fixture | lang | dominant_script | TELUGU_SCRIPT_CORRECT |
| --- | --- | --- | --- | --- |
| baseline small | namaskaramu | te | Devanagari | **NO** |
| baseline small | namaskaramu | auto | Tamil | **NO** |
| baseline small | amma | te | None (dots) | **NO** |
| baseline small | amma | auto | Latin | **NO** |
| baseline small | dengue 30s | te/auto | Latin | **NO** |
| **TE challenger** | namaskaramu | te/auto | **Telugu** | **YES** |
| **TE challenger** | amma | te | **Telugu** | **YES** |
| TE challenger | amma | auto | None (decode garble) | NO (anomaly) |
| **TE challenger** | dengue 30s | te/auto | **Telugu** | **YES** |

**SCRIPT_GATE (human + explicit `-l te`) = PASS** for challenger (3/3). Baseline = **FAIL_SCRIPT_GATE** (0/3).

### 4.2 Content / WER / CER (human)

| Model | Fixture | lang | hyp (abbrev) | WER | CER | notes |
| --- | --- | --- | --- | --- | --- | --- |
| baseline | namaskaramu | te | नमस्कारम | 1.0 | 1.0 | wrong script |
| **challenger** | namaskaramu | te | నమస్కారం | 1.0* | **0.222** | Telugu; spoken orthography vs ref నమస్కారము |
| baseline | amma | te | `.. .. ..` | 11.0 | 5.5 | garbage |
| **challenger** | amma | te | అమ్మా | 1.0* | **0.250** | Telugu; lengthened vowel vs అమ్మ |
| baseline | dengue 30s | te | `2. Dengue Jvaram` | n/a | n/a | Latin; unusable |
| **challenger** | dengue 30s | te | డెంగ్యూ జ్వరం … (fluent TE medical) | n/a | n/a | Telugu; **no repetition loop**; CONTENT qualitative **PASS** |

\*Single-token refs: any orthographic variant yields WER=1.0 even when CER≪1. CER is the informative metric here.

TTS supplementary (not cert): challenger auto CER≈0.056 (`నమస్కారం నా పేరు గీత` vs ref); baseline Devanagari/Latin FAIL_SCRIPT.

**CONTENT_GATE:** Challenger human explicit = **PASS** (CER material win + dengue usable TE). Baseline = **FAIL_CONTENT_GATE**.

Anomaly: challenger `amma` + `auto` emitted replacement bytes once (not used as promotion evidence; explicit `-l te` is the product-relevant path for monolingual TE).

### 4.3 Hallucinations / omissions / insertions

- Baseline dengue: severe omission + wrong-script Latin stub.
- Challenger dengue explicit/auto: coherent multi-word Telugu; `bad_hallucination=false` (no trigram loop).
- Short refs: challenger near-matches; no insert loops.

### 4.4 Resources (human explicit mean / max)

| Model | mean RTF (3 human explicit) | max peak RSS | model bytes |
| --- | --- | --- | --- |
| ggml-small.bin | ~1.91 | ~750 MB | 487601967 |
| ggml-te-small.bin (q5_1) | ~0.54 | ~499 MB | 190085487 |

Challenger is **lighter and faster** on this harness (not merely script-only).

## 5. Win law

| Axis | Result |
| --- | --- |
| Script improves | **YES** (FAIL→PASS on human explicit) |
| Human WER/CER materially improves | **YES** (CER 1.0/5.5 → 0.22/0.25; dengue content usable) |
| No bad hallucination | **YES** on human explicit TE path |
| Memory/latency OK | **YES** (RSS↓ ~33%, RTF↓) |
| Custody clean | **YES** |
| Speed alone / script alone? | N/A — content+CER also improved |

→ Advance to **next qualification** earned. **Not** product promote / live / UI.

## 6. Product gates (unchanged)

```
LIVE_TRANSCRIPTION=UNAVAILABLE
UI_INTEGRATED=NO
PRODUCT_MEDIA_V1=NOT_PASS
PRODUCT_INTEGRATION=FORBIDDEN
AUTO_PROMOTION=NO
```

## 7. Artifacts

- Report: `proof/media-r1/G12_G_TELUGU_HUMAN_BENCH_REPORT.md`
- Cases: `proof/media-r1/bench/g12g/metrics/G12_G_CASES.json`
- Summary: `proof/media-r1/bench/g12g/metrics/G12_G_SUMMARY.json`
- Custody: `proof/media-r1/models/CUSTODY_BEFORE_DOWNLOAD.md`, `ggml-te-small.lock.json`
- Fixtures catalog: `proof/media-r1/fixtures/human/G12_G_HUMAN_FIXTURE_CATALOG.md`
- Harness: `proof/media-r1/bench/g12g/scripts/run_te_human_bench.py`
- Large `.bin` gitignored (lock + SHA)

## 8. Machine-readable footer

```
UPSTREAM_REPO=https://huggingface.co/ukta-app/indic-whisper-ggml
UPSTREAM_COMMIT=a3d637b81797a1d680e6933b71058ac9e00681fd
MODEL_FILE=ggml-te-small.bin
MODEL_BYTES=190085487
SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
LICENSE=Apache-2.0
WHISPER_CPP_COMPATIBILITY=YES
CUSTODY_VERIFY=PASS
BASELINE_MODEL=ggml-small.bin
BASELINE_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
CHALLENGER_MODEL=ggml-te-small.bin
CHALLENGER_SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
SOURCE_PIN=927cfce34f31707e17f2bff35c349632fb9e2c3a
BINARY_SHA256=784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7
HUMAN_FIXTURE_TE=YES
HUMAN_FIXTURE_GATE=PASS
TTS_SUPPLEMENTARY_ONLY=YES
TE_BASELINE_SCRIPT_CORRECT=NO
TE_CHALLENGER_SCRIPT_CORRECT=YES
SCRIPT_GATE=PASS_CHALLENGER
CONTENT_GATE=PASS_CHALLENGER
TE_BASELINE_WER_NAMASKARAMU=1.0
TE_BASELINE_CER_NAMASKARAMU=1.0
TE_CHALLENGER_WER_NAMASKARAMU=1.0
TE_CHALLENGER_CER_NAMASKARAMU=0.222
TE_BASELINE_WER_AMMA=11.0
TE_BASELINE_CER_AMMA=5.5
TE_CHALLENGER_WER_AMMA=1.0
TE_CHALLENGER_CER_AMMA=0.250
TE_DENGUE_BASELINE=FAIL_SCRIPT_LATIN
TE_DENGUE_CHALLENGER=PASS_TE_CONTENT_QUALITATIVE
BAD_HALLUCINATION_HUMAN_EXPLICIT=NO
RTF_COMPARISON=baseline_human_explicit_mean≈1.91;challenger_human_explicit_mean≈0.54
RSS_COMPARISON=baseline_max≈750.5MB;challenger_max≈499.4MB
NETWORK_EGRESS=0
RECOMMENDATION=PROMOTE_TO_NEXT_QUALIFICATION
TE_WINNER=ggml-te-small.bin
OVERALL=TELUGU_CHALLENGER_BEATS_BASELINE_ON_HUMAN_TE
I1_TOUCHED=NO
I2_STARTED=NO
PIN_MODIFIED=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
PRODUCT_INTEGRATION=FORBIDDEN
LIVE_TRANSCRIPTION=UNAVAILABLE
UI_INTEGRATED=NO
PRODUCT_MEDIA_V1=NOT_PASS
G12_G_STATUS=TELUGU_CHALLENGER_EVALUATED
FINAL=TELUGU_CHALLENGER_EVALUATED
```
