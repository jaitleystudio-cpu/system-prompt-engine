# G12-E Multilingual Model Challenger Report (SPE Ω)

MODE: Local ₹0 benchmark / challenger evaluation. READ/BENCHMARK only.
No UI integration. No live transcription enablement. No merge. No deploy. No host.
PRODUCT_MEDIA_V1 is NOT claimed. LIVE_TRANSCRIPTION remains UNAVAILABLE.

| Field | Value |
| --- | --- |
| DATE_LOCAL | 2026-10-01 Asia/Calcutta (IST) |
| MACHINE | Prawins-Mac-mini.local Apple M2 arm64 8 GB |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-g12e-alt-model-trial-20261001` |
| BRANCH | `grok/spe-g12e-alt-model-trial-20261001` |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` |
| PRIOR_G12_C | worktree `@ 2cbedf5` / PR #85 — **not mutated** |
| PRIOR_G12_D | TE=`MODEL_CAPABILITY_TELUGU_SCRIPT`; ES=`TTS_FIXTURE_VALIDITY`; HI minor |
| SOURCE_PIN | `927cfce34f31707e17f2bff35c349632fb9e2c3a` (**unchanged**) |
| BINARY_SHA256 | `784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7` (symlink to G12-C build) |
| NETWORK_EGRESS (inference) | **0** (offline after HF weight download for custody) |
| I1_TOUCHED | NO |
| I2_STARTED | NO |
| PIN_MODIFIED | NO |
| MERGED | NO |
| DEPLOYED | NO |
| HOSTED | NO |

## 1. Challenger selection (custody)

Isolated **MODEL CAPACITY only**: same whisper.cpp pin, same `whisper-cli` binary, same decode params (`-tp 0 -bs 5 -bo 5 -t 4 -p 1 -fa`), same audio bytes. Differed **model file only**.

| Role | MODEL_NAME | SOURCE_COMMIT (HF weights) | MODEL_BYTES | SHA256 | LICENSE | EXPECTED_MEMORY_CLASS |
| --- | --- | --- | --- | --- | --- | --- |
| BASELINE | `ggml-small.bin` | `5359861c739e955e79d9a303bcbc70fb988958b1` | 487601967 | `1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b` | MIT (OpenAI Whisper via ggerganov/whisper.cpp ggml) | ~0.5–1.5 GB RSS |
| CHALLENGER_1 | `ggml-medium.bin` | same HF commit | 1533763059 | `6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208` | MIT (same) | ~1.5–3.5 GB RSS (8 GB tight) |
| CHALLENGER_2 | `ggml-medium-q5_0.bin` | same HF commit | 539212467 | `19fea4b380c3a618ec4723c3eef2eb785ffba0d0538cf43f8f235e7b3b34220f` | MIT (same) | ~0.8–2.0 GB RSS |

Custody: lock JSON under `proof/media-r1/models/*.lock.json` with local SHA256 recompute = expected; `verify=PASS`. Skipped larger models (large/turbo) as unfit for 8 GB safety margin without further proof.

## 2. Fixtures

| Lang | HUMAN_FIXTURE | Path / note | Controlled also run? |
| --- | --- | --- | --- |
| TE | YES | Commons: `te_namaskaramu_16k.wav`, `te_amma_16k.wav`, `te_dengue_intro_30s.wav` (refs for short words only; dengue qualitative) | YES TTS short (not for product cert) |
| ES | YES | Commons contamination podcast 30s + whisper.cpp-aligned opening ref | YES short TTS (known invalid for cert) |
| HI | YES | Commons dengue intro 30s; **no verified full ref → WER=N/A** | YES TTS short (WER allowed as controlled only) |
| EN | YES | JFK human + TTS short preserved | YES |
| TA | TTS only | `ta_pcm16` controlled preserved | YES |

Provenance: `fixtures/human/HUMAN_FIXTURE_PROVENANCE.md` (symlinked from G12-D). TTS-only cannot certify product quality.

## 3. Fixed experiment

- Cases JSON: `proof/media-r1/bench/g12e/metrics/G12_E_CASES.json` (66 runs = 3 models × 11 fixtures × {auto, explicit})
- Timestamps on for multi-segment fairness (G12-D `-nt` truncation lesson)
- Explicit: `-l te|es|hi|en|ta`; auto recorded independently
- Peak RSS from macOS `/usr/bin/time -l` (post-parsed from logs)
- WER/CER: whitespace token / character Levenshtein after NFC; **not invented** — `null` when no verified ref

## 4. Results

### 4.1 Telugu — script gate (primary G12-D HOLD)

| Model | Fixture | `-l te` script | TELUGU_SCRIPT_CORRECT | WER vs ref | Notes |
| --- | --- | --- | --- | --- | --- |
| small | namaskaramu human | Devanagari | NO | 1.0 | Reproduces G12-D |
| small | amma human | Devanagari | NO | 1.0 | |
| small | dengue 30s human | Telugu | YES | n/a | Script yes; **content hallucination repetition** |
| small | TTS short | Devanagari | NO | 1.0 | G12-C/G12-D hyp family |
| **medium** | namaskaramu human | **Telugu** | **YES** | 2.0 | Script fixed; content wrong (`నిమాసక కారం`) |
| **medium** | amma human | **Telugu** | **YES** | 4.0 | Script fixed; repetition hallucination |
| **medium** | dengue 30s human | **Telugu** | **YES** | n/a | Script yes; content still garbage loop |
| medium | TTS short | Devanagari | NO | 1.0 | TTS still wrong script |
| medium-q5_0 | namaskaramu human | Devanagari | NO | 1.0 | Partial challenger |
| medium-q5_0 | amma human | Telugu | YES | 2.0 | |
| medium-q5_0 | dengue 30s human | Telugu | YES | n/a | Hallucination |
| medium-q5_0 | TTS short | Devanagari | NO | 1.0 | |

**TE_SCRIPT_CORRECT (aggregate):** PARTIAL — `ggml-medium.bin` + explicit `-l te` emits Telugu script on **all 3 human** fixtures (fixes G12-D Devanagari failure mode on short human), but **transcription content remains unusable** (high WER / loops). TTS TE still Devanagari on all models. Auto-detect on short TE remains weak across models.

### 4.2 Spanish (human 30s)

| Model | lang | WER | CER | RTF | peak RSS |
| --- | --- | --- | --- | --- | --- |
| small | es | **0.4426** | 0.4521 | **0.167** | ~792 MB |
| medium | es | **0.4262** | 0.4315 | 0.499 | ~2096 MB |
| medium-q5_0 | es | 0.4426 | 0.4486 | 0.280 | ~1105 MB |

Material accuracy gain from medium is **tiny** (~0.016 WER) against ~3× RTF and ~2.6× RSS. **ES winner = BASELINE_SMALL.**

### 4.3 Hindi

- Human 30s: all models emit correct **Devanagari**; fluent dengue content (no full ref → WER N/A). Qualitative usable on small.
- Controlled TTS explicit WER: small **0.0** / medium 0.4 / q5_0 0.2 (this run; small best).
- **HI winner = BASELINE_SMALL.**

### 4.4 EN / TA (preserved)

EN JFK human WER=0.0 all models; TA TTS WER=0.0 all models. Medium/q5 pay large RTF/RSS with no accuracy need.

### 4.5 Resources (mean over 6 primary human explicit runs)

| Model | mean RTF | max peak RSS | mean load ms |
| --- | --- | --- | --- |
| ggml-small.bin | 0.876 | 825 MB | 2766 |
| ggml-medium.bin | 2.924 | 2112 MB | 9828 |
| ggml-medium-q5_0.bin | 1.860 | 1133 MB | 3474 |

Medium load/RSS is uncomfortable on 8 GB (safety margin thin under concurrent desktop load).

## 5. Win law application

Challenger wins only with **material quality improvement** without unacceptable memory/latency regression — not WER-only.

| Axis | medium vs small | q5_0 vs small |
| --- | --- | --- |
| TE script (human + explicit) | **Material fix** of G12-D script HOLD | Partial only |
| TE content / usable ASR | **Still FAIL** | Still FAIL |
| ES accuracy | Negligible | None |
| HI | No win | No win |
| Latency / RTF | **Unacceptable regression** for parity tasks | Moderate regression |
| RSS / model size | ~2.6× / ~3.1× | ~1.4× / ~1.1× |
| Privacy / custody | Same local offline | Same |

**Per-language winners**

- TE winner = **none for usable transcription**; script-only note → `ggml-medium.bin`
- ES winner = **BASELINE_SMALL**
- HI winner = **BASELINE_SMALL**
- OVERALL = **NO_MODEL_MEETS_GATE** (no challenger delivers product-credible TE content + acceptable cost; ES/HI should keep small)

`PROMOTE_CHALLENGER_FOR_NEXT_QUALIFICATION` is **not** selected: medium’s TE script change is real evidence for a future TE-specialized lane, but content+latency fail the win law for promotion even into next product qualification.

## 6. Product gates (unchanged)

```
LIVE_TRANSCRIPTION=UNAVAILABLE
UI_INTEGRATED=NO
PRODUCT_MEDIA_V1=NOT_PASS
PRODUCT_INTEGRATION=FORBIDDEN
```

## 7. Artifacts

- Report: `proof/media-r1/G12_E_MODEL_CHALLENGER_REPORT.md`
- Cases: `proof/media-r1/bench/g12e/metrics/G12_E_CASES.json`
- Models meta: `proof/media-r1/bench/g12e/metrics/MODELS.json`
- Locks: `proof/media-r1/models/ggml-medium.lock.json`, `ggml-medium-q5_0.lock.json` (+ small from G12-C)
- Harness: `proof/media-r1/bench/g12e/scripts/run_challenger_matrix.py`
- Large `.bin` weights gitignored (custody via lock JSON + SHA)

## 8. Machine-readable footer

```
BASELINE_MODEL=ggml-small.bin
CHALLENGERS=ggml-medium.bin,ggml-medium-q5_0.bin
TE_BASELINE_WER=1.0 (human short explicit; dengue n/a)
TE_BEST_WER=1.0 (no usable TE WER win; medium script-fixed but WER>=2 on short human refs)
TE_SCRIPT_CORRECT=PARTIAL
ES_BASELINE_WER=0.4426
ES_BEST_WER=0.4262
HI_BASELINE_WER=N/A_HUMAN_NO_FULL_REF (TTS_controlled_small_WER=0.0)
HI_BEST_WER=N/A_HUMAN (TTS_controlled_small_WER=0.0)
BEST_MODEL=ggml-small.bin
BEST_MODEL_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
BEST_MODEL_FOR_TE_SCRIPT=ggml-medium.bin
BEST_MODEL_FOR_TE_SCRIPT_SHA256=6c14d5adee5f86394037b4e4e8b59f1673b6cee10e3cf0b11bbdbee79c156208
RTF_COMPARISON=small_mean=0.876;medium_mean=2.924;q5_mean=1.860
RSS_COMPARISON=small_max=825MB;medium_max=2112MB;q5_max=1133MB
LOAD_TIME_COMPARISON=small_mean_ms=2766;medium_mean_ms=9828;q5_mean_ms=3474
HUMAN_FIXTURE_TE=YES
HUMAN_FIXTURE_ES=YES
HUMAN_FIXTURE_HI=YES
NETWORK_EGRESS=0
RECOMMENDATION=KEEP_SMALL_DOCUMENT_TE_HOLD
TE_WINNER=NONE_USABLE (script_only=ggml-medium.bin)
ES_WINNER=BASELINE_SMALL
HI_WINNER=BASELINE_SMALL
OVERALL=NO_MODEL_MEETS_GATE
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
G12_E_STATUS=MODEL_CHALLENGER_EVALUATED
FINAL=MODEL_CHALLENGER_EVALUATED
```
