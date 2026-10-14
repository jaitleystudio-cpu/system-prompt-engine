# CWC-1 pilot R0 — Counterfactual Witness Compilation (PREREGISTERED; frozen before any scored run)

Branch grok/cwc1-pilot-r0 (from origin/main 3abe3df). ₹0. No merge/deploy/PR. Builder: Grok. Independent judge: Bro.
Conjecture: with the same question, sources and budget, explicitly modelling competing explanations and choosing
discriminating experiments gives higher independently verified insight recovery than a strong baseline.

## 1. Benchmark choice
- BoxingGym (Gandhi et al. 2025, github.com/kanishkg/boxing-gym, MIT licence), pinned commit b43e38cb03d09c13efa9cf4d9bae740d51157bfd.
  Environments are cheap Python/PyMC simulators: experiments run on the CPU box at ₹0. CHOSEN.
- FIRE-Bench (maitrix-org/FIRE-Bench; HF datasets silence-suzuki/FIRE-Bench-verified, card licence apache-2.0; GitHub
  repo shows no licence file). Tasks require running real ML/LLM experiments (models, GPUs, API agents such as Codex /
  Claude Code). Not runnable at ₹0 on this box. NOT CHOSEN for R0.
- Environment versions: Python deps installed unpinned in /tmp/bgenv (pymc 6.3.2, numpy 2.5.4) instead of the repo's
  pinned pymc 5.13.1 / numpy 2.0.1. Declared deviation; R1 must either pin or show identical simulator outputs.

## 2. Held-out tasks (12 env/goal pairs x seeds {101, 202, 303} = 36 episodes per arm)
dugongs/direct, peregrines/direct, hyperbolic_temporal_discount/direct, hyperbolic_temporal_discount/discount,
location_finding/direct, location_finding/source, death_process/direct, death_process/infection,
irt/direct, irt/discriminate_question, survival/direct, lotka_volterra/direct.
Excluded: emotion and morals (their simulators call an LLM). Default env params from the pinned repo conf/envs/*.yaml.
Dev / dry-run tasks (never scored, disjoint from holdout): irt/best_student and irt/difficult_question, seed 900.

## 3. Arms (same model, same seeds, same budget)
- A model alone: BoxingGym-style loop: ask for <observe>, run, repeat; then answer eval questions.
- B model + retrieval: as A, plus the top-2 passages (keyword overlap) from the frozen corpus prepended once to the
  system message. Corpus: spe_runtime/research/cwc1/corpus_r0.jsonl, 12 Wikipedia REST summaries, fetched
  2026-10-14 (source cutoff), revision ids recorded in the file, sha256 f3ae40c3…c050.
- C model + retrieval + CWC step: same sources as B (so C vs B isolates the CWC step). Each experiment call must
  return JSON {hypotheses:[{id, form, params}] (>=2, typed: functional form + parameters), candidates:[x1..x4],
  predictions:{id:[y per candidate]}}. The HARNESS (not the model) chooses the candidate with the largest spread of
  predictions across hypotheses (max - min; ties -> first). Witness record per step: hypotheses, predictions, chosen x,
  observed y, and which hypotheses the observation contradicts (|y - pred| ranked). Malformed JSON -> one retry, then
  fall back to the model's first candidate (logged as cwc_fallback).
## 4. Budget (equal across arms)
10 experiments per episode; 1 model call per experiment (+ at most 3 format retries, counted and reported);
10 eval questions, 1 call each; max_tokens 512 per call; temperature 0; model seed 0.
Model: one free local model via Ollama, qwen2.5:7b-instruct (q4_K_M); its digest is recorded at first scored run and any
change voids the run. No paid APIs.
## 5. Scorer (deterministic, no LLM judge)
Per episode: the goal's own evaluate_predictions (BoxingGym code) -> error; standardised as (err - norm_mu)/norm_sigma
using the goal's own norm factors where defined (else raw, reported separately). Per task: mean over 3 seeds.
Primary: paired task-level difference C - B and C - A in standardised error (lower is better); 95% bootstrap CI over the
12 tasks (10,000 resamples, seed 7).
- SUPPORTED iff C - B and C - A CIs both lie entirely below 0 AND Bro independently re-scores the raw logs to the same
  numbers (+-1e-9) AND every C witness record is internally consistent (chosen x = argmax spread).
- REFUTED iff the C - B CI lies entirely above 0. Otherwise NOT_PROVEN.
"Insight recovery" here = predictive accuracy on held-out queries (BoxingGym's metric), a proxy; BoxingGym's
explanation/discovery mode is NOT included in R0.
## 6. Process
Dry run (2 dev tasks, labelled DRY_RUN) only proves plumbing. A stub backend may be used for plumbing; stub output is
never a result. Scored runs happen only after this contract commit, with raw logs committed before scoring is reported.
