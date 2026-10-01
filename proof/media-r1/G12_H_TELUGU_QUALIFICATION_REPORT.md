# G12-H Telugu Challenger Independent Qualification Report (SPE Ω)

MODE: Independent local ₹0 qualification of `ggml-te-small.bin` vs multilingual `ggml-small.bin` for **media backend** Telugu path.
No UI. No live STT. No merge/deploy/host. No I1/I2/WASM. No Cursor cloud. **Do not touch PR #85–87.**
G12-G earned NEXT QUAL only — this gate re-verifies independently and applies WIN LAW for media-backend model qualification.

| Field | Value |
| --- | --- |
| DATE_LOCAL | 2026-10-01 Asia/Calcutta (IST) |
| MACHINE | Prawins-Mac-mini.local Apple M2 arm64 8 GB |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-g12h-te-indep-qual-20261001` |
| BRANCH | `grok/spe-g12h-te-indep-qual-20261001` |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` |
| PRIOR_G12_G | Telugu challenger beats baseline on human TE → NEXT QUAL only |
| SOURCE_PIN | whisper.cpp `927cfce34f31707e17f2bff35c349632fb9e2c3a` (**unchanged**) |
| BINARY_SHA256 | `784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7` |
| NETWORK_EGRESS (inference) | **0** (fixtures download one-time; decode offline) |

## 1. Supply custody (independent re-verify) — PASS

Recomputed on G12-H worktree symlinks (not trust G12-G alone). Evidence: `models/G12_H_INDEPENDENT_CUSTODY_VERIFY.json`.

```
MODEL_SOURCE=https://huggingface.co/ukta-app/indic-whisper-ggml/resolve/a3d637b81797a1d680e6933b71058ac9e00681fd/ggml-te-small.bin
SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
BYTES=190085487
LICENSE=Apache-2.0 (HF README front-matter independently fetched 2026-10-01)
WHISPER_CPP_COMPAT=YES (library_name=whisper.cpp; q5_1 ggml; requires -nt; loads in pinned whisper-cli)
QUANT=q5_1
FINE_TUNE_SOURCE=vasista22/whisper-telugu-small@717212f9c4c16a78a86ddcb98f93c7f73ef8a5cc
CROSS_CUSTODY_SECONDARY=bhaskaro/ainotes-whisper-telugu-q5_1@11bb1860bf271666c5f3ae709b7414cf993608b4 identical SHA/bytes
BASELINE_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b BYTES=487601967
SUPPLY_CUSTODY=PASS
```

Mismatch→HOLD was **not** triggered.

## 2. Human TE fixture set — PASS

Catalog: `fixtures/human/G12_H_HUMAN_FIXTURE_CATALOG.md`. Multiple lawful human speakers; TTS supplementary only; no unnecessary PII.

| ID | Variation | Ref | Notes |
| --- | --- | --- | --- |
| te_namaskaramu | clean short | నమస్కారము | Commons |
| te_amma | clean short | అమ్మ | Commons |
| te_kaalu | clean short | కాలు | Commons (new for G12-H) |
| te_araka | clean short | అరక | Commons (new) |
| te_kurupam | short place-name | కురూపం | Commons (new) |
| te_dengue_30s / 45s | long | NO_VERIFIED_FULL_REF | same speaker slice |
| te_vizag_pa_20s | PA/device | NO_VERIFIED_FULL_REF | Commons Vizag dengue PA |
| te_amma_light_noise | light noise (derived) | అమ్మ | lawful derivative |
| te_namaskaramu_fast | rate +15% (derived) | నమస్కారము | lawful derivative |
| te_pcm16 | TTS supplementary | present | **not** product cert |

**Robustness coverage:** clean/short=YES; long=YES; light noise=YES; rate=YES; device/PA=YES; names=PARTIAL (kurupam); numbers=UNKNOWN; mixed TE-EN=UNKNOWN; dialect=UNKNOWN.

`HUMAN_FIXTURES=10` human/derived primary (+1 TTS supp).

## 3. Controlled comparison

Identical across models:

- whisper.cpp pin `927cfce…`
- same `whisper-cli` binary SHA256 above
- hardware Apple M2 8 GB
- same audio bytes (SHA256 per case in `G12_H_CASES.json`)
- decode: `-tp 0 -bs 5 -bo 5 -t 4 -p 1 -fa -nt`
- `-nt` on **both** (TE fine-tune requires no timestamps; fairness)
- language: explicit `-l te` (product-relevant) and `-l auto` (diagnostic)
- NFC normalization; whitespace-token WER; character CER; ops for I/D/S

Differed: **model file only**.

## 4. Metrics (human/derived, explicit `-l te`)

| Axis | Baseline ggml-small | Candidate ggml-te-small |
| --- | --- | --- |
| Telugu script correct | **0/10** | **10/10** |
| Content gate (CER≤0.5 or qualitative long) | 0/10 | **9/10** |
| Bad hallucination (trigram loop / extreme length) | 3/10 | **0/10** |
| Mean WER (7 ref fixtures) | 3.571 | **1.143** |
| Mean CER (7 ref fixtures) | 1.833 | **0.349** |
| Mean RTF | 5.075 | **0.869** |
| Max peak RSS | 713.3 MB | **507.3 MB** |
| Load time (probe, no `-np`) | 3357.25 ms | **1381.60 ms** |
| Model size (whisper load) | 487.01 MB | **189.49 MB** |

### Pairwise CER (explicit)

| Fixture | Base WER/CER | Cand WER/CER |
| --- | --- | --- |
| namaskaramu | 1.0 / 1.0 (Devanagari) | 1.0 / **0.222** (నమస్కారం) |
| amma | 11.0 / 5.5 (garbage) | 1.0 / **0.250** (అమ్మా) |
| kaalu | 1.0 / 1.0 (Devanagari) | 1.0 / **0.500** (కాళ్లు) |
| araka | 1.0 / 1.333 (Devanagari) | 2.0 / **0.667** (ఆ రకా) — residual; still Telugu |
| kurupam | 9.0 / 1.5 (Latin loop) | 1.0 / **0.333** (కురుపాం) |
| amma+noise | 1.0 / 1.5 (Latin) | 1.0 / **0.250** (అమ్మా) |
| namaskaramu fast | 1.0 / 1.0 (Devanagari) | 1.0 / **0.222** (నమస్కారం) |

Long/PA (no full ref): candidate emits fluent multi-word Telugu medical/PA content; baseline Latin/Kannada-script loops / stubs. Qualitative **PASS** candidate.

**Note on WER:** single-token refs yield WER=1.0 on orthographic near-matches; **CER is the informative short-ref metric**. Candidate CER is still materially better on every ref fixture.

### Auto-mode diagnostic (not product path)

Candidate `auto` shows residual garble on some short clips (amma/kaalu/araka/vizag) — same class of anomaly noted in G12-G. **Product-relevant path for monolingual TE is explicit `-l te`**, which is consistently clean.

## 5. Robustness (candidate explicit)

| Category | Result |
| --- | --- |
| clean/short | SCRIPT PASS; content 3/4 CER≤0.5 (araka residual CER 0.667) |
| long | PASS (Telugu, no loop) |
| light noise | PASS |
| rate | PASS |
| device/PA | PASS (Telugu content, no loop) |
| numbers | **UNKNOWN** |
| mixed TE-EN | **UNKNOWN** |
| dialect | **UNKNOWN** |

## 6. WIN LAW

| Criterion | Result |
| --- | --- |
| Script consistently PASS | **YES** (10/10 explicit human/derived) |
| Content acceptable | **YES** (9/10 strict CER gate; araka still Telugu + better than baseline; long/PA usable) |
| WER/CER materially better | **YES** (CER 1.833→0.349; WER 3.571→1.143) |
| No serious hallucination | **YES** (0/10 bad hall explicit) |
| Memory/latency OK | **YES** (RSS↓, RTF↓, load↓, bytes↓) |
| Custody clean | **YES** |

→ **FINAL=TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND**

This qualifies the **model candidate for media-backend Telugu decode** under explicit `-l te` + `-nt`. It does **not** integrate UI, enable live transcription, merge, deploy, or flip product media v1.

## 7. Product gates (unchanged)

```
LIVE_TRANSCRIPTION=UNAVAILABLE
UI_INTEGRATED=NO
PRODUCT_MEDIA_V1=NOT_PASS
PRODUCT_INTEGRATION=FORBIDDEN
AUTO_PROMOTION=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
I1_TOUCHED=NO
I2_STARTED=NO
PR_85_86_87_TOUCHED=NO
```

## 8. Artifacts

- Report: `proof/media-r1/G12_H_TELUGU_QUALIFICATION_REPORT.md`
- Cases: `proof/media-r1/bench/g12h/metrics/G12_H_CASES.json`
- Summary: `proof/media-r1/bench/g12h/metrics/G12_H_SUMMARY.json`
- Custody: `proof/media-r1/models/G12_H_INDEPENDENT_CUSTODY_VERIFY.{json,md}`
- Fixtures catalog: `proof/media-r1/fixtures/human/G12_H_HUMAN_FIXTURE_CATALOG.md`
- Harness: `proof/media-r1/bench/g12h/scripts/run_te_indep_qual.py`
- Large `.bin` gitignored (locks + SHA retained)

## 9. Machine-readable footer

```
CANDIDATE_SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
HUMAN_FIXTURES=10
BASELINE_WER=3.571
CANDIDATE_WER=1.143
BASELINE_CER=1.833
CANDIDATE_CER=0.349
SCRIPT_GATE=PASS
HALLUCINATION_GATE=PASS
RTF=0.869
RSS=507.3MB
LOAD_TIME=1381.60ms
SUPPLY_CUSTODY=PASS
QUALITY_GATE=PASS
PERFORMANCE_GATE=PASS
FINAL=TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND
LIVE_TRANSCRIPTION=UNAVAILABLE
PRODUCT_MEDIA_V1=NOT_PASS
MERGED=NO
SOURCE_PIN=927cfce34f31707e17f2bff35c349632fb9e2c3a
BINARY_SHA256=784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7
BASELINE_MODEL=ggml-small.bin
BASELINE_SHA256=1be3a9b2063867b937e64e2ec7483364a79917e157fa98c5d94b5c1fffea987b
CANDIDATE_MODEL=ggml-te-small.bin
LICENSE=Apache-2.0
WHISPER_CPP_COMPAT=YES
BYTES=190085487
TTS_SUPPLEMENTARY_ONLY=YES
PRODUCT_PATH_LANG=explicit_-l_te
AUTO_MODE_ANOMALY=YES_SHORT_CLIPS_NOT_PRODUCT_PATH
NUMBERS=UNKNOWN
MIXED_TE_EN=UNKNOWN
DIALECT=UNKNOWN
I1_TOUCHED=NO
I2_STARTED=NO
PIN_MODIFIED=NO
DEPLOYED=NO
HOSTED=NO
PR_85_86_87_TOUCHED=NO
G12_H_STATUS=TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND
```
