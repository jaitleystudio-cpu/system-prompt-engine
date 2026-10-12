# RGD-1 R0 + R03 — replication package (for Bro; the builder cannot certify)

## Custody
- Branch grok/rgd1-r0 (from origin/main 3abe3df9).
- Prereg commit 8570daba. docs/rgd1/PREREG.md sha256 `49a125ec20a1ef05675567bbbdae1fecdd4bf5047186ea9da0e10a4198da8b08`.
- Deviations: docs/rgd1/PREREG_ADDENDUM_INTERRUPTION.md (commits ca1cb1c5 and 82f3f055). Holdout attempt 1 crashed on an OpenAlex HTTP 400 in the OA arm before any rows were written. A fallback was added to the OA arm only, and the run was then completed once.
- Frozen inputs (evidence/rgd1/frozen/):
  - corpus.jsonl sha256 fa23140877a46d898469fc0fa8f503b3e95ad387678751cad53b0aec3638f38c
  - tasks.jsonl sha256 ba3593b181598b43effb2e7fc1c818986549262f1dc527ee21b82e9a45f13fb2
  - manifest.json
- R0 corpus counts: evidence/rgd1/r0_corpus_counts.json, the raw OpenAlex API numbers with a UTC timestamp.

## Raw evidence
| Item | Path |
|---|---|
| Holdout rows: one per task × arm. Fields: hit, gold_rank, top-10 ids, queries, latency_s, api_credits, LLM queries | evidence/rgd1/holdout/rows.jsonl |
| Gold map | evidence/rgd1/holdout/gold_map.json |
| Analysis (CIs, Holm, negative controls, hard subset) | evidence/rgd1/holdout/analysis.json |
| Dev run (pipeline check) | evidence/rgd1/dev/ |
| Every OpenAlex call (UTC timestamp, params, credits, cost header, remaining budget) | evidence/rgd1/openalex_calls.jsonl |
| LLM generations (raw responses) | evidence/rgd1/llm_generations.jsonl |
| Environment and model digests | evidence/rgd1/environment/ENVIRONMENT.txt |
| Code | spe_runtime/research/rgd1/ (openalex.py, build_corpus.py, retrieval.py, run.py, analyze.py) |
| Tests | tests/research/rgd1/ |

## Commands
```
python3.12 -m venv /tmp/v && /tmp/v/bin/pip install -e '.[dev]'
/tmp/v/bin/python -m pytest tests/research/rgd1 -q
# R0 counts (5 keyless list calls; counts change daily, so compare magnitudes only)
/tmp/v/bin/python -m spe_runtime.research.rgd1.r0_counts /tmp/r0.json
# Rebuild the frozen corpus (about 38 keyless credits; OpenAlex `sample` with seeds 1,2,3,7). The data may drift,
# so compare the sha256; if it differs, run the replay against the committed frozen/ files instead.
/tmp/v/bin/python -m spe_runtime.research.rgd1.build_corpus /tmp/frozen
# Replay the holdout against committed frozen inputs. Needs Ollama with qwen2.5:1.5b and nomic-embed-text.
# OA arm: 60 searches = 600 keyless credits (> half a day's keyless allowance); omit --oa-n to skip it.
RGD1_OLLAMA=http://127.0.0.1:11434 /tmp/v/bin/python -m spe_runtime.research.rgd1.run holdout /tmp/ho --expect-prereg-sha 49a125ec20a1ef05675567bbbdae1fecdd4bf5047186ea9da0e10a4198da8b08 --oa-n 60
/tmp/v/bin/python -m spe_runtime.research.rgd1.analyze /tmp/ho --delta 0.10
```
- The holdout guard needs a clean checkout of the branch HEAD.
- The local arms B1 and R03T are fully deterministic.
- B2 and R03 depend on the Ollama model digests listed in ENVIRONMENT.txt (temperature 0, seed 0). Expect identical results only with the same digests.

## Costs
- ₹0. OpenAlex keyless: no key, prepaid balance $0, so any over-budget call is refused, not billed. Credits per call are in openalex_calls.jsonl.
- The local LLM and embedding run on the Mac mini.

## Please challenge
1. **Task validity:** notice titles usually embed the original title, which favours lexical baselines.
2. **Leakage control:** title sanitization and the title-only input.
3. **Hard-subset definition.**
4. **The OA-arm deviation.**
5. **Whether "decision-changing evidence = retraction notice" is too narrow.** Contradicting studies and failed replications are not in the gold.
