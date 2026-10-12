# RGD-1 R0 + R03 — Results (provisional; Bro to replay)

## R0: OpenAlex corpus counts (as returned by the API, 2026-10-12T16:48:22Z; nothing claimed beyond these numbers)
- **Works total:** 326,806,755.
- **is_retracted:** true 136,530; false 325,028,442.
- **has_fulltext:** true 55,956,688; false 270,850,067.
- **type:retraction:** 49,066 works. The full by-type table is in evidence/rgd1/r0_corpus_counts.json.
- **Access:** keyless polite pool (mailto). The keyless daily allowance is $0.10 (search = 10 credits, list = 1). With no key and $0 prepaid, spend is structurally ₹0.
- **Frozen baselines:** BM25 (k1 = 1.2, b = 0.75) and OpenAlex relevance search, plus a local nomic-embed-text reranker (₹0).
- **SPE module reuse:** none possible. origin/main has no ProtectedIntent; it lives only on unmerged branches (commit 3f0847d3). The code therefore sits in the research namespace spe_runtime/research/rgd1 and is not a competing engine.

## R03 holdout (single completed run; PREREG sha256 49a125ec…8b08)
346 retracted tasks (24 fields) + 100 control tasks. K = 10. Frozen local corpus of 5,908 works.

| arm | hit@10 (Wilson 95%) | hit@3 | hit@1 | MRR | precision (gold / retraction docs) | control false-alarm (95%) | queries/task | mean latency (s) | API credits |
|---|---|---|---|---|---|---|---|---|---|
| B1 BM25 | 0.928 [0.896, 0.951] | 0.913 | 0.642 | 0.778 | 0.463 | 0.41 [0.32, 0.51] | 1 | 0.03 | 0 |
| B2 BM25 + nomic rerank | 0.832 [0.789, 0.868] | 0.746 | 0.512 | 0.636 | 0.285 | 0.44 [0.35, 0.54] | 1 | 0.99 | 0 |
| **R03 decision-reversal (qwen2.5:1.5b)** | **0.931 [0.899, 0.953]** | 0.890 | 0.494 | 0.698 | 0.344 | **0.79 [0.70, 0.86]** | 3 | 5.88 | 0 |
| R03T template ablation | 0.928 | 0.913 | 0.642 | 0.778 | 0.404 | 0.67 [0.57, 0.75] | 3 | 0.007 | 0 |
| OA live search (first 60 tasks) | 0.917 [0.819, 0.964] | 0.917 | 0.117 | 0.508 | n/a | n/a | 1.02 | 0.59 | 600 total (both attempts) |

### Primary (family-level paired, one-sided permutation, Holm α = 0.05, δ = 0.10)
| contrast | mean | 95% CI | p | p_Holm | reject |
|---|---|---|---|---|---|
| R03 − B1 | +0.001 | [−0.002, 0.004] | 0.247 | 0.247 | no |
| R03 − B2 | +0.064 | [0.012, 0.115] | 0.007 | 0.015 | yes, but mean < δ |

Secondary results:
- **Task-level:** R03 − B1 = +0.003 [−0.007, 0.013]; R03 − B2 = +0.098 [0.065, 0.131].
- **Hard subset** (n = 47; notice title shares < 50% of the task-title tokens):
  - hit@10: B1 0.468, B2 0.340, R03 0.511.
  - R03 − B1 = +0.043 [−0.018, 0.103]; R03 − B2 = +0.170 [0.058, 0.282].
- **R03 − OA** (17 families): +0.066 [−0.059, 0.190].
- **R03T − R03:** −0.001. The template matches R03's hit rate at about 1/800th of the latency.
- **Negative control:**
  - Shuffled-gold hit rate: B1 0.000, B2 0.006, R03 0.003, R03T 0.000. All ≤ 0.02, as required.
  - Control false alarms: R03 flags a retraction-type document for 79% of non-retracted papers, vs 41% for BM25.

## Verdict (provisional, pending Bro's replay): **NOT_PROVEN**
- **SUPPORTED fails:** R03 does not beat BM25 (+0.001), and its gain over the embedding reranker (+0.064) is below δ.
- **REJECTED fails narrowly:** the R03 − B2 CI upper bound (0.115) is above δ.
- **Practical reading:** on this ground truth, plain BM25 on the title already retrieves the retraction notice 93% of the time. LLM reversal queries add no hit-rate, worsen hit@1 and MRR, roughly double the false alarms on non-retracted papers, and cost about 6 s per task. A fixed template gives the same hit rate for free.

## Disclosed deviations
1. Holdout attempt 1 (22:52 IST) crashed on an OpenAlex HTTP 400 in the OA arm at task #31. No rows were written and no metric was seen.
   - An OA-only fallback was added (retry with punctuation stripped; otherwise score a miss).
   - The same run was then completed once (attempt 2, EXIT 0). The local arms are unchanged and PREREG.md is unchanged.
   - Details: PREREG_ADDENDUM_INTERRUPTION.md and evidence/rgd1/holdout_attempt1_traceback.txt. Cached OA responses (30) and LLM generations were reused.
2. Pre-freeze changes made for leakage control, disclosed in the prereg: titles were sanitized (183 of 386 carried "RETRACTED:"-type markers), and inputs were limited to titles.

## Limitations
- **Narrow gold:** decision-changing evidence = the retraction notice only. Contradicting studies and failed replications are not in the gold.
- **Lexical bias:** notice titles usually embed the original title, which favours lexical baselines (hence the near-ceiling result).
- **Small local corpus** (5,908 works). The OA arm covers only 60 tasks because of the keyless budget.
- **Small model:** qwen2.5:1.5b. A stronger free model is untested.
- **Ollama contention:** another worker was also using the shared Ollama, so latency numbers are inflated and noisy.
- **Underpowered by design:** the family-level R03 − B2 test with 24 fields (stated in the prereg).
- **Self-built:** the builder wrote the pipeline and analysis. Builder ≠ verifier is pending Bro.
