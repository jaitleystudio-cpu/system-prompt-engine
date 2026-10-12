# RGD-1 R03 — Decision-reversal search: preregistration (frozen before any holdout outcome)

Branch grok/rgd1-r0, from origin/main 3abe3df9. Builder: Grok Bot. Independent replay: Bro. Scope: R0 + R03 only.
Spend is ₹0:
- OpenAlex is used keyless. The allowance is $0.10/day, there is no key and the prepaid balance is $0, so over-budget calls are refused, never billed.
- Ollama runs locally.

No holdout outcome exists at this commit. The dev split was run and is disclosed in §7.

## 1. Ground truth (objective, free)
- Source: OpenAlex `type:retraction` works with exactly one referenced work (3 seeded samples of 200, seeds 1–3). The original O is that referenced work, and must be flagged `is_retracted=true`, not itself a notice, and have a title.
- **Task:** the initial conclusion is O's title, sanitized: leak markers such as "RETRACTED:", "withdrawn" and "erratum" are removed (183 of 386 titles carried one).
- **Decision-changing evidence:** O's retraction notice(s), i.e. the gold IDs.
- Only titles are used as input. Some abstracts of retracted works contain the notice text itself, so abstracts are excluded from task inputs.
- **Negative-control tasks:** 120 non-retracted articles (`is_retracted:false`), for which no decision-changing notice exists.
- **Frozen local corpus** (evidence/rgd1/frozen/), 5908 works:
  - 577 notices;
  - 537 originals;
  - 4800 non-retracted same-field articles (300 per field, seed 7).
- **Hashes:**
  - corpus.jsonl sha256 `fa23140877a46d898469fc0fa8f503b3e95ad387678751cad53b0aec3638f38c`
  - tasks.jsonl sha256 `ba3593b181598b43effb2e7fc1c818986549262f1dc527ee21b82e9a45f13fb2`
- **Split** (seeded shuffle):
  - dev: 40 retracted + 20 control tasks;
  - **holdout: 346 retracted + 100 control tasks**.
- Family = O's OpenAlex primary_topic field (24 fields).

## 2. Arms (spe_runtime/research/rgd1/run.py; frozen)
All arms rank the identical frozen corpus with K = 10. Budget: ≤ 3 index queries per task (matched cap).
- **B1:** BM25 (k1 = 1.2, b = 0.75), 1 query = title.
- **B2:** BM25 top-100, reranked by local nomic-embed-text cosine (title query), 1 query. This is the ₹0 local embedding reranker.
- **R03:** decision-reversal search. Local qwen2.5:1.5b (temperature 0, seed 0, fixed prompt in retrieval.py) writes 3 queries seeking a retraction/withdrawal, a contradicting study, and a failed replication/expression of concern. Each query is run through BM25 top 10, and the lists are fused by RRF (c = 60).
- **R03T (secondary ablation):** template queries "retraction|contradicts|failed replication + title", BM25 each, RRF.
- **OA (secondary, external):** live OpenAlex relevance search (`search=title`, 1 call, top 10), scored against the gold IDs. Run on the first 60 holdout retracted tasks only (600 keyless credits).

## 3. Endpoints
- **Primary:** hit@10, i.e. a gold notice is in the top 10, on holdout retracted tasks.
  - Unit: family. Per-field mean of paired task differences.
  - One-sided sign-flip permutation p (20,000 permutations, RNG 20261012). 95% t-CI.
  - Contrasts: **R03 − B1** and **R03 − B2**, with **Holm, α = 0.05**.
  - Minimum effect δ = 0.10.
- **Secondary:**
  - hit@1, hit@3, MRR.
  - Precision = gold hits / retraction-type docs retrieved.
  - Control false-alarm rate: share of control tasks with any retraction-type doc in the top 10, with Wilson CIs.
  - Cost: index queries, API credits, mean latency (LLM generation included).
  - R03 − OA (n = 60) and R03T − R03.
  - Hard subset (gold notice title shares < 50% of the task-title tokens).
  - Task-level sensitivity.
- **Negative control (required):** shuffled-gold hit rate, where each task is scored against another task's gold notice. It must be ≤ 0.02 for every arm. The control false-alarm rate is also reported.

## 4. Power
- Dev family-level SDs: R03 − B1 = 0.019; R03 − B2 = 0.339.
- At δ = 0.10 (one-sided α = 0.025, 80% power), R03 − B2 needs about 90 families. Only 24 fields exist, so **the family-level R03 − B2 test is underpowered by design** (stated in advance). Task-level results are reported as a sensitivity analysis, not as the primary.
- R03 − B1 is adequately powered.

## 5. Verdict rule (provisional pending Bro; PASS is never used)
- **SUPPORTED:** both primary contrasts Holm-reject, each with mean ≥ δ and CI lower bound > 0, AND the shuffled-gold negative control is ≤ 0.02 for R03.
- **REJECTED:** both primary contrasts have CI upper bound < δ (a benefit ≥ δ is excluded against both baselines).
- **NOT_PROVEN:** anything else.

## 6. Run once
```
python -m spe_runtime.research.rgd1.run holdout evidence/rgd1/holdout --expect-prereg-sha <sha256 of this file> --oa-n 60
python -m spe_runtime.research.rgd1.analyze evidence/rgd1/holdout --delta 0.10
```

## 7. Dev-split disclosure (pipeline check; no arm, prompt or parameter changed after it)
- hit@10: B1 0.95, B2 0.775, R03 0.925, R03T 0.95.
- Control false alarms: B1 0.35, B2 0.50, R03 0.70, R03T 0.60.
- Changes made before freezing were only for leakage control, not for performance:
  - title sanitization was added after we saw "RETRACTED:" prefixes in the generated queries;
  - inputs were switched to title-only after notice text was found inside abstracts.
- The builder's expectation is that BM25 on the title is near ceiling, because notice titles usually embed the original title. A NOT_PROVEN or REJECTED result is likely.
- Evidence: evidence/rgd1/dev/.
