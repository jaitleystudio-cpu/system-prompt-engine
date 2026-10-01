# G12-F Multilingual Recovery Strategy (SPE Ω) — Telugu-first

MODE: READ-ONLY RESEARCH / BENCHMARK PLANNING.
NO MODEL DOWNLOAD. NO PRODUCT CODE. NO BUILD of challenger weights.
₹0 local/web research only. No Cursor cloud agents.

| Field | Value |
| --- | --- |
| DATE_LOCAL | 2026-10-01 Asia/Calcutta (IST) |
| MACHINE | Prawins-Mac-mini.local Apple M2 arm64 8 GB (research); box web reads OK |
| WORKTREE | `/Volumes/4TB-WD/spe-worktrees/spe-g12f-te-recovery-strategy-20261001` |
| BRANCH | `grok/spe-g12f-te-recovery-strategy-20261001` |
| BASE_SHA | `dd626973185708c46eee59fe2360887a42d330ba` (same media family as G12-C/D/E) |
| PRIOR_G12_C | frozen separately @ `2cbedf5` / PR #85 — **do not touch** |
| PRIOR_G12_D | TE=`MODEL_CAPABILITY_TELUGU_SCRIPT`; ES=`TTS_FIXTURE_VALIDITY`; HI minor |
| PRIOR_G12_E | `OVERALL=NO_MODEL_MEETS_GATE`; `RECOMMENDATION=KEEP_SMALL_DOCUMENT_TE_HOLD` |
| SOURCE_PIN | whisper.cpp `927cfce34f31707e17f2bff35c349632fb9e2c3a` (**unchanged**) |
| BASELINE | `ggml-small.bin` (G12-C/E custody) |
| LIVE_TRANSCRIPTION | UNAVAILABLE |
| PRODUCT_INTEGRATION | FORBIDDEN this gate |

## Immutable evidence (do not re-litigate)

From G12-D + G12-E on the same pin / same `whisper-cli`:

- **small** (`ggml-small.bin`): TE wrong-script failure (Devanagari / Latin / misdetect) on short human + TTS; content unusable.
- **medium** (`ggml-medium.bin`): TE script **partially** improves on human+explicit `-l te`, but transcript remains unusable (WER≥2 / hallucination loops); ~**3×** slower (mean RTF 2.92 vs 0.88); ~**2.6×** memory (peak RSS ~2112 MB vs ~825 MB).
- **medium-q5_0**: weaker TE-script fix than f16 medium; still content-fail; still slower/heavier than small.
- **OVERALL = NO_MODEL_MEETS_GATE**. Brute-force **multilingual** model scaling has **not** earned promotion.
- ES/HI winners remain **BASELINE_SMALL** (human fixtures). TTS alone cannot certify product quality.

Therefore the recovery path must be **Telugu-specialized** (and/or fixture+routing), not “try larger OpenAI Whisper multilingual again.”

---

## Product capability matrix principle (A10 later)

| State | Meaning | UI / API implication |
| --- | --- | --- |
| **SUPPORTED** | Language tested on human fixtures **and** gate earned | May advertise / enable |
| **REVIEW** | Partial evidence; not yet gate-earned | Do not claim; keep experimental |
| **HOLD / UNAVAILABLE** | Known bad or untested with known failure mode | Explicitly refuse / hide |

**Rule:** backend runs ≠ all languages. A10 UI consumes the matrix; never imply “Whisper loaded ⇒ TE works.”

### Provisional matrix after G12-C/D/E (no promotion this report)

| Lang | Status | Basis |
| --- | --- | --- |
| EN | REVIEW→near SUPPORTED (foundation) | JFK human WER=0 on small; G12-C/E |
| ES | REVIEW | Human 30s usable on small; TTS short invalid — do not cert from TTS |
| HI | REVIEW | Human Devanagari usable; full WER refs thin |
| TE | **HOLD / UNAVAILABLE** | Known wrong-script + unusable content on small; medium script-only |
| TA | REVIEW (insufficient) | TTS-only so far |
| others | UNAVAILABLE | Untested |

---

## Investigation axes

### 1) Whisper-compatible multilingual / Indic-optimized models

Focus: models that can run under **whisper.cpp** (same pin family) or are Whisper-architecture fine-tunes with published ggml conversions.

#### Candidate A — `vasista22/whisper-telugu-small` → ggml q5_1 (PRIMARY)

```
MODEL/RUNTIME=vasista22/whisper-telugu-small → ggml-te-small.bin (q5_1) via whisper.cpp pin 927cfce…
TELUGU_EVIDENCE=Upstream FLEURS te_in WER 11.59% (self-reported, transformers). Third-party whisper.cpp score on 24 FLEURS clips: WER 45.8% / CER 30.7% with -nt greedy (bhaskaro). Monolingual TE fine-tune on CSTD/ULCA/Shrutilipi/MS Speech/FLEURS/Babel. Directly addresses G12-D MODEL_CAPABILITY_TELUGU_SCRIPT failure mode that multilingual small/medium did not fix for content.
LICENSE=Apache-2.0 (fine-tune); Whisper arch MIT
SIZE=190085487 bytes (~181 MiB)
EXPECTED_RSS=~0.3–0.8 GB peak (class: below G12-E small; q5_1 measured ~2.6× smaller than f16 on sibling Hindi conversion)
EXPECTED_RTF=faster than real-time on M2 expected (phone Snapdragon 720G cited >1×; Mac M2 should be comfortably <1 RTF)
OFFLINE=YES (after one-time custody download)
WHISPER_COMPATIBLE=YES (ggml for whisper.cpp; MUST use -nt / no_timestamps — fine-tunes trained without timestamp tokens; timestamps cause fluent unrelated text)
SUPPLY_CUSTODY_AVAILABLE=YES — identical LFS blob in two public repos:
  - ukta-app/indic-whisper-ggml / ggml-te-small.bin
  - bhaskaro/ainotes-whisper-telugu-q5_1 / ggml-model.bin
  LFS SHA256 (content oid)=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
  size=190085487
```

Also available: `ggml-te-base.bin` (ukta) size=59707625; LFS oid=`574b09d7c61b6b0fd92d85f919bb8d8d6a0b62a57f776f1a3a7644ecad8ff889` — cheaper smoke test, weaker expected quality.

#### Candidate B — `vasista22/whisper-telugu-medium` → ggml q5_1

```
MODEL/RUNTIME=vasista22/whisper-telugu-medium → ggml q5_1 via whisper.cpp
TELUGU_EVIDENCE=Upstream FLEURS WER 9.47%. whisper.cpp 32-clip FLEURS compare: medium q5_1 WER 39.8% / CER 24.2% vs small q5_1 45.8% / 30.7% (same harness). Material but modest ggml WER gain vs TE-small; still far better expected than multilingual medium’s unusable TE content in G12-E.
LICENSE=Apache-2.0
SIZE=586572019 bytes (~560 MiB)
EXPECTED_RSS=~0.8–1.5 GB (should fit 8 GB Mac with margin; lighter than G12-E f16 medium ~2.1 GB)
EXPECTED_RTF=~1–2× small-TE class; better than G12-E multilingual medium mean RTF 2.92 expected but unmeasured on SPE harness
OFFLINE=YES
WHISPER_COMPATIBLE=YES (ggml; -nt required)
SUPPLY_CUSTODY_AVAILABLE=YES — bhaskaro/ainotes-whisper-telugu-medium-q5_1 / ggml-model.bin
  LFS SHA256=f4f9165742a187ee8d9bba5c76e81f47374d8bfa051ed36232a07e216c5b0881
  size=586572019
```

#### Candidate C — `vasista22/whisper-telugu-large-v2` (HF / optional ggml convert)

```
MODEL/RUNTIME=vasista22/whisper-telugu-large-v2 (transformers/JAX today; ggml convert possible via convert-h5-to-ggml.py — NOT pre-published in ukta pack)
TELUGU_EVIDENCE=FLEURS WER 9.65% (self-reported). Strong published TE evidence; used as base for Praxy LoRA entity-dense work. ~1.5B params — convert+quantize would be a separate custody build (out of scope for G12-F; no download now).
LICENSE=Apache-2.0
SIZE=~3 GB f16 class (HF pytorch); quantized ggml unknown until built
EXPECTED_RSS=likely 2–4+ GB — tight on 8 GB Mac under desktop load; fail-closed until measured
EXPECTED_RTF=slower than medium; unmeasured SPE
OFFLINE=YES after download
WHISPER_COMPATIBLE=PARTIAL (architecture yes; no ready public ggml TE-large in ukta pack as of research date)
SUPPLY_CUSTODY_AVAILABLE=PARTIAL (HF weights yes; SPE ggml SHA custody not yet minted)
```

#### Candidate D — BuzzASR/telugu (Whisper-large-v3 full FT)

```
MODEL/RUNTIME=BuzzASR/telugu (transformers Whisper-large-v3 fine-tune, ~2B, F16)
TELUGU_EVIDENCE=Combined FLEURS+CV25: CER 13.03 / WER 45.49 vs zero-shot large-v3 CER 74.67 (~5.7× CER reduction). Monolingual. Strong paper evidence (EMNLP 2026 Findings suite) but domain/eval != SPE fixtures yet.
LICENSE=check card before any future use (research cite: BuzzASR docs)
SIZE=~2B params F16 (~3–4 GB class)
EXPECTED_RSS=unsafe default on 8 GB without aggressive quant + proven ggml path
EXPECTED_RTF=slow on CPU/Metal without turbo-style decoder cut
OFFLINE=YES after download
WHISPER_COMPATIBLE=PARTIAL (Whisper arch; no SPE ggml custody yet)
SUPPLY_CUSTODY_AVAILABLE=NO (no SPE lock; no ggml SHA yet)
```

**Rank among Whisper-family TE specialists by evidence × 8 GB fit × whisper.cpp readiness:** A ≻ B ≻ C ≻ D.

---

### 2) Quantized large-v3 / turbo — ONLY if RAM-safe + TE evidence

| Candidate | Size (bytes) | LFS SHA256 | Fits 8 GB? | TE evidence | Authorize? |
| --- | --- | --- | --- | --- | --- |
| `ggml-large-v3-turbo-q5_0.bin` | 574041195 | `394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2` | Likely YES (~0.55–1.0 GB RSS class) | **Weak / negative for TE** — turbo trades quality on underrepresented languages; OpenAI Whisper zero-shot TE remains poor (BuzzASR cites large-v3 zero-shot CER 74.67–82.65 on TE sets). G12-E already showed multilingual **medium** fixes script not content. | **NO** |
| `ggml-large-v3-turbo-q8_0.bin` | 874188075 | `317eb69c11673c9de1e1f0d459b253999804ec71ac4c23c17ecf5fbe24e259a1` | Borderline YES (~0.9–2.3 GB RSS cited elsewhere) | Same weak TE case | **NO** |
| `ggml-large-v3-q5_0.bin` | 1081140203 | `d75795ecff3f83b5faa89d1900604ad8c780abd5739fae406de19f23ecd98ad1` | Risky on 8 GB (full large decoder; ~2–3+ GB RSS class + OS) | Zero-shot TE still weak vs TE fine-tunes | **NO** |

```
MODEL/RUNTIME=ggerganov/whisper.cpp ggml-large-v3-turbo-q5_0 | q8_0 | large-v3-q5_0
TELUGU_EVIDENCE=INSUFFICIENT_FOR_PROMOTION — provenance/checksums exist, RAM may fit for turbo-q5/q8, but no SPE or public evidence that multilingual large/turbo fixes TE content where medium failed. Literature: fine-tunes beat zero-shot TE by large margins.
LICENSE=MIT (OpenAI Whisper via whisper.cpp packs)
SIZE=see table
EXPECTED_RSS=turbo-q5 ~0.55–1.0 GB; turbo-q8 ~0.9–2.3 GB; large-v3-q5 higher / riskier
EXPECTED_RTF=turbo often <1 on Apple Silicon Metal; large-v3 slower
OFFLINE=YES
WHISPER_COMPATIBLE=YES
SUPPLY_CUSTODY_AVAILABLE=YES (HF LFS oids above) — custody alone does not justify trial
```

**Explicit decision:** **Do not authorize larger Whisper multilingual (large-v3 / turbo) yet.** Evidence does not justify it after G12-E. Prefer TE fine-tune ggml of small/medium class.

---

### 3) Telugu-specific ASR alternatives (local/offline, non–whisper.cpp)

#### Candidate E — AI4Bharat IndicConformer (TE hybrid CTC/RNNT)

```
MODEL/RUNTIME=ai4bharat/indicconformer_stt_te_hybrid_ctc_rnnt_large (NeMo) OR indic-conformer-600m-multilingual with TE
TELUGU_EVIDENCE=Third-party Kathbath-style benches cite ~22% WER class on TE for 600M RNNT (small n); official TE cards exist. Strong Indic ASR ecosystem (Vistaar/Kathbath/IndicVoices). Separate stack from SPE whisper.cpp pin.
LICENSE=typically Apache-2.0 / check card per checkpoint
SIZE=120M encoder monolingual large class; 600M multilingual heavier
EXPECTED_RSS=PyTorch/NeMo — often 1–3+ GB; unmeasured on SPE Mac
EXPECTED_RTF=unmeasured SPE; GPU preferred historically
OFFLINE=YES after download
WHISPER_COMPATIBLE=NO (different runtime — would be a second ASR engine + router)
SUPPLY_CUSTODY_AVAILABLE=PARTIAL (HF yes; SPE lock/SHA/runtime pin absent)
```

#### Candidate F — Praxy-STT-Te-rb (LoRA on vasista22 large-v2)

```
MODEL/RUNTIME=Praxel/praxy-stt-te-rb LoRA on vasista22/whisper-telugu-large-v2
TELUGU_EVIDENCE=Entity-dense TE WER 0.324 vs vasista22 base 0.582 on Cartesia held-out synthetic; FLEURS-Te read-prose slightly worse than base. Useful for entity-dense future; **synthetic eval** — transfer to human entity-dense not measured. Not first gate for general TE.
LICENSE=check (base Apache-2.0)
SIZE=LoRA small + large-v2 base
EXPECTED_RSS=large-v2 class (tight on 8 GB)
EXPECTED_RTF=large-v2 class
OFFLINE=YES
WHISPER_COMPATIBLE=PARTIAL (adapters need PEFT/transformers; not whisper.cpp)
SUPPLY_CUSTODY_AVAILABLE=PARTIAL
```

**For SPE G12 media lane:** keep IndicConformer / Praxy as **parallel research tracks**, not next whisper.cpp experiment. Routing to a non-Whisper engine is a product architecture change (I2+), not a G12-F/G12-G pin-local trial.

---

### 4) Language-ID front end (routing without changing ASR semantics)

G12-D finding: on multilingual `ggml-small`, **explicit `-l te` does not materially fix TE** (still wrong script/content). Auto-detect is weak on short TE (en/ta misdetect).

```
MODEL/RUNTIME=External LID (e.g. SpeechBrain/TalTech VoxLingua107 ECAPA-TDNN ~21M; ONNX/GGUF/MLX ports ~41–85 MB) OR Whisper built-in lang-id (already present, weak on short TE)
TELUGU_EVIDENCE=LID alone cannot repair TE ASR quality on current small multilingual model. LID **does** become valuable **if and only if** a TE-specialized ASR (Candidate A/B) exists to route to — then short-utterance misdetect can be mitigated without baking wrong language into decode.
LICENSE=varies (VoxLingua107 research; check port)
SIZE=~40–85 MB class
EXPECTED_RSS=~100–300 MB transient
EXPECTED_RTF=LID ≪ ASR (milliseconds–tens of ms on short window)
OFFLINE=YES
WHISPER_COMPATIBLE=N/A (front-end); must not alter ASR hyp semantics — only selects engine/lang flag
SUPPLY_CUSTODY_AVAILABLE=PARTIAL (public ports; SPE pin absent)
```

**Decision:** Plan LID as **optional router** after TE-specialist ASR earns REVIEW→SUPPORTED. Do **not** spend the next experiment on LID-only. If user/app already passes `language=te`, skip LID.

---

### 5) Human-speech fixture acquisition plan (TTS cannot certify)

TTS remains useful for **smoke / regression** only. Product gates require **human** TE/ES/HI with verified references.

#### Design: SPE Multilingual Human Bench v1 (TE/ES/HI)

| Slot | Lang | Target n | Duration | Source options (lawful) | Reference | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| TE-S | te | ≥10 | 1–5 s words/greetings | Wikimedia Commons + FLEURS te_in excerpts | Exact orthography (Telugu script) | Script gate + short WER |
| TE-M | te | ≥15 | 10–30 s read speech | FLEURS te_in test; Common Voice Te; IndicVoices Te (AI4Bharat portal) | Dataset transcripts | Content WER/CER |
| TE-L | te | ≥5 | 30–60 s | Spoken Wikipedia / Commons dengue-style narrations (already used dengue 30s) | Human-verified transcript (new work) | Hallucination / loop detection |
| ES-M | es | ≥10 | 10–30 s | whisper.cpp es samples + Commons podcasts | Existing refs where aligned | Confirm KEEP_SMALL |
| HI-M | hi | ≥10 | 10–30 s | Commons Spoken Wikipedia HI; FLEURS hi_in; Common Voice Hi | Dataset transcripts | Confirm KEEP_SMALL |
| EN-ctrl | en | ≥3 | known | JFK + 2 human | Existing | Regress pin |
| NEG | mix | ≥5 | short | Silence / music / wrong-lang | n/a | No-speech / refuse behavior |

**Rules:**

1. Prefer **CC-BY / CC-BY-SA / dataset research licenses**; record URL, license, speaker, SHA256 of wav, transcript SHA in `HUMAN_FIXTURE_PROVENANCE.md`.
2. Normalize audio: 16 kHz mono PCM16 wav (same as G12-C/D/E).
3. Score: NFC normalize; Telugu script correctness boolean; WER/CER only when ref verified; **null WER when no ref** (G12-E discipline).
4. Decode for TE fine-tunes: **`-nt` required**; for multilingual baseline fairness, also run timestamp mode separately and label.
5. Never promote TE from TTS Geeta fixtures.
6. Budget: **₹0** — use already-public FLEURS/CV/IndicVoices/Commons; no paid TTS / no cloud ASR labels.

**Acquisition sequence (next ops, still read-only until authorized download of *fixtures* — not model weights in G12-F):**

1. Inventory G12-D/E human TE/ES/HI already on disk; extend provenance.
2. Add FLEURS `te_in` test subset (≤30 clips) with official transcripts — primary TE content gate.
3. Add Common Voice Te validated clips if license OK for SPE custody.
4. Freeze a `G12_G_FIXTURE_MANIFEST.json` before any model challenger run.

---

## Ranked shortlist (evidence-only)

| Rank | Candidate | Why ranked here | Next action when authorized |
| --- | --- | --- | --- |
| **1** | **vasista22 TE-small ggml q5_1** (ukta/bhaskaro identical LFS) | Best combo: published TE WER, whisper.cpp ready, tiny RAM, checksum available, targets exact G12-D failure | Custody download + lock JSON + bench vs small on human TE |
| **2** | vasista22 TE-medium ggml q5_1 | Better upstream/ggml TE WER; still 8 GB-safe class | Only if #1 fails content gate |
| **3** | External LID + TE specialist router | Helps routing **after** #1 exists; does not fix ASR alone | Design-only until #1 REVIEW |
| **4** | IndicConformer TE | Strong Indic evidence; **new runtime** cost | Separate architecture spike, not G12 whisper pin |
| **5** | vasista22 TE-large-v2 / BuzzASR / Praxy | Stronger paper numbers; 8 GB / ggml / PEFT friction | Defer |
| **X** | multilingual large-v3 / turbo (any quant) | Checksums+RAM may exist; **TE gain unjustified** after G12-E | **DO NOT AUTHORIZE YET** |

---

## Do-not-authorize larger Whisper yet

G12-E proved multilingual medium buys TE **script** at unacceptable RTF/RSS without usable content. Literature shows TE needs **language-specific fine-tuning**, not decoder-depth scaling of the same multilingual prior. Turbo/large-v3 quants are therefore **custody-eligible but experiment-unjustified** for TE recovery. Revisit only if TE-specialist ggml fails **and** a published TE WER for turbo/large on FLEURS-style human sets appears with SPE-comparable decode settings.

---

## Concrete next experiment

**Name:** `G12_G_TE_SMALL_GGML_HUMAN_BENCH`

**Scope (when later authorized — not this report):**

1. Download **only** `ggml-te-small.bin` (LFS SHA256 `47369abd…`) into isolated `proof/media-r1/models/` with lock JSON (same pattern as G12-E).
2. Keep whisper.cpp pin `927cfce…` and G12-C `whisper-cli` binary; **do not touch PR #85 / G12-C**.
3. Run fixed matrix: baseline `ggml-small.bin` vs `ggml-te-small.bin` on **human TE** fixtures (+ EN/ES/HI regress controls).
4. Decode: TE fine-tune with **`-l te -nt`**; also record auto. Baseline uses G12-E-comparable flags.
5. Win law: material TE script+content improvement **without** unacceptable RSS/RTF vs small; ES/HI must not regress below REVIEW.
6. Still: no UI, no LIVE_TRANSCRIPTION, no merge, no host.

If G12_G fails content gate → escalate to **G12_H_TE_MEDIUM_GGML_HUMAN_BENCH** (Candidate B), not to multilingual large/turbo.

---

## Machine-readable footer

```
PRIOR_OVERALL=NO_MODEL_MEETS_GATE
PRIOR_RECOMMENDATION=KEEP_SMALL_DOCUMENT_TE_HOLD
DO_NOT_AUTHORIZE_LARGER_WHISPER_YET=YES
TOP_RECOMMENDATION=VASISTA22_TE_SMALL_GGML_Q5_1
TOP_CANDIDATE_LFS_SHA256=47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e
TOP_CANDIDATE_BYTES=190085487
RANKED_SHORTLIST=1_vasista22_te_small_ggml;2_vasista22_te_medium_ggml;3_external_LID_router_after_te_asr;4_indicconformer_te_parallel;5_te_large_v2_buzzasr_praxy_defer;X_multilingual_large_v3_turbo_blocked
FIXTURE_PLAN=SPE_MULTILINGUAL_HUMAN_BENCH_V1_TE_ES_HI
CAPABILITY_MATRIX_TE=HOLD_UNAVAILABLE
CAPABILITY_MATRIX_ES=REVIEW
CAPABILITY_MATRIX_HI=REVIEW
CAPABILITY_MATRIX_EN=REVIEW
G12_C_PR85_TOUCHED=NO
PIN_MODIFIED=NO
MODEL_DOWNLOADED=NO
PRODUCT_CODE=NO
CHALLENGER_WEIGHTS_BUILT=NO
NETWORK_WEIGHT_DOWNLOAD=0
I1_TOUCHED=NO
I2_STARTED=NO
MERGED=NO
DEPLOYED=NO
HOSTED=NO
PRODUCT_INTEGRATION=FORBIDDEN
LIVE_TRANSCRIPTION=UNAVAILABLE
UI_INTEGRATED=NO
PRODUCT_MEDIA_V1=NOT_PASS
G12_F_STATUS=TE_RECOVERY_STRATEGY_DOCUMENTED
FINAL=NEXT_TE_EXPERIMENT=G12_G_TE_SMALL_GGML_HUMAN_BENCH
```
