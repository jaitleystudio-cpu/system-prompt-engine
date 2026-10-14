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

## Amendment 1 (2026-10-14, before any scored run; found by the stub plumbing dry run)
Upstream BoxingGym bug at b43e38cb: irt.BestStudent / DifficultQuestion / DiscriminatingQuestion call
env.get_system_message, which IRT does not define (AttributeError). Therefore:
- Holdout drops irt/discriminate_question -> 11 tasks x 3 seeds = 33 episodes per arm. Bootstrap is over 11 tasks.
- Dev/dry-run tasks become dugongs/direct and peregrines/direct at seed 900 only (holdout seeds 101/202/303 unused).
  This shares environments (not seeds) with the holdout; declared.
- Pinned repo requirements are internally inconsistent (numpy 2.0.1 with pytensor 2.20.0 fails). Runtime used:
  Python 3.12.14 venv, repo requirements.txt with numpy 1.26.4 (pymc 5.13.1, pytensor 2.20.0), PYTENSOR_FLAGS=cxx=
  (no g++ on the box). This supersedes the unpinned-deps note in section 1.
- Eval-set fix (found in the same dry run): eval questions were drawn from the global RNG after the experiments, so
  arms saw different eval sets. The harness now reseeds random/numpy with seed+10000 before the eval questions; the
  dry run checks ground truths are identical across A/B/C.
- Seeding fix: BoxingGym draws true parameters and observations with pm.draw / pm.sample_prior_predictive and no
  random_seed (OS entropy), so the same seed did NOT give the same environment. The harness patches both to take
  random_seed from a generator seeded per episode (seed) and per eval phase (seed+10000).

## Amendment 2 (2026-10-14 12:30 IST, before any real-model call by the harness)
- Model pulled: qwen2.5:7b-instruct Q4_K_M, Ollama 0.24.0 on the Mac mini (Apple M2, Metal), digest
  845dbda0ea48ed749caafd9e6037047aa19acfcfd82e704d7ca97d631a0b697e. Any other digest voids the run.
- Context window fixed at num_ctx=8192 for every arm (Ollama default would be 4096, which could silently truncate the
  longer arm-C conversations). keep_alive=-1. Observed speed ~5 tokens/s generation.
- Harness runs on the Mac from a standalone copy (not a worktree of any existing checkout) at
  /Volumes/4TB-WD/spe-worktrees/cwc1-pilot-r0-run; logs are copied back to the box and committed from the box worktree.
