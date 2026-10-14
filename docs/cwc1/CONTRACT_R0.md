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

## Amendment 3 (2026-10-14 13:40 IST, cycle 13:05; committed and pushed BEFORE any holdout episode is run)
Branch grok/cwc1-pilot-r1-real-model (from 5145e92f). Status of amendment 2: its 7B run never produced holdout output
(the Mac mini went offline from ~13:10 IST and stayed unreachable during this cycle). This is a REDUCED PILOT.
Facts found on the DEV tasks only (dugongs/peregrines seed 900, label DRY_RUN; holdout untouched):
- Runtime: the Mac (7B, ~5 tok/s) is unreachable. The Grok box (8 shared CPUs, no GPU, ~4 GB free RAM) runs
  Ollama 0.40.4 on CPU. qwen2.5 7B does not fit in free RAM. Measured: 1.5B ~23 tok/s, 3B ~11 tok/s single stream;
  3B with 3 parallel slots ~6 model calls/min aggregate, i.e. ~115 min per holdout seed (11 tasks x 3 arms).
- The Ollama registry blob CDN is blocked from the box, so weights come from the official Qwen Hugging Face GGUF repos
  and are imported with `ollama create` (FROM <gguf>; chat template taken from the GGUF).
- The frozen CWC parser rejected 100% of arm-C steps for both small models on dev: 1.5B returned prediction lists of
  the wrong length; 3B returned predictions as mappings keyed by bare numbers ({1.0: 1.5}), which is not JSON.
Changes (all declared before any holdout output; nothing is tuned on holdout):
1. MODEL: qwen2.5-3b-instruct Q4_K_M, from Qwen/Qwen2.5-3B-Instruct-GGUF file qwen2.5-3b-instruct-q4_k_m.gguf,
   GGUF sha256 626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d, Ollama tag
   qwen2.5-3b-instruct-q4km-hf:latest, Ollama digest a36559c74bc3144e42925b6a67884b7aacc11b0480ceadc732de0e9efc450722.
   Any other digest voids the run. Same family as the contract's 7B, smaller. Licence: Qwen Research License
   (research / non-commercial); used here only as an evaluation model, never shipped. num_ctx 8192, temp 0, seed 0,
   num_predict 512 unchanged. Ollama runs with OLLAMA_NUM_PARALLEL=3 (3 episodes in flight); batched CPU decoding may
   make outputs not bit-reproducible versus a serial replay — declared; the raw logs are the scored artefact.
2. PARSER (arm C only): parse_cwc additionally accepts predictions given as a mapping keyed by candidate (matched by
   float value) and quotes bare numeric object keys before json.loads. Nothing else is repaired; wrong-length
   predictions are still rejected. Unit-tested (test_parse_cwc_lenient_amendment3). Arms A/B unaffected.
3. SCOPE / STOPPING RULE (outcome-blind): seed-major order. Seed 101 is run first (all 11 tasks x A/B/C, 3 parallel
   workers = task shards i%3), then 202, then 303. HARD CUTOFF 16:05 IST. Only seeds whose 33 episodes all finished
   by the cutoff are scored; unfinished seeds are killed and their partial logs kept but NOT scored. If seed 101 itself
   is unfinished, the scored set is the tasks of seed 101 for which all three arms finished (reported as PARTIAL), and
   no verdict other than NOT_PROVEN / NOT_RUN may be issued from fewer than 8 tasks.
4. SCORER frozen now: spe_runtime/research/cwc1/score.py (section 5 as written: per-task mean over scored seeds of
   standardised error; paired task-level C-B, C-A, and B-A; 95% percentile bootstrap, 10,000 resamples,
   numpy default_rng(7)). Missing-data rule (not specified in R0, declared now): PRIMARY = complete cases (a task enters
   only if every scored (arm, seed) episode produced a score); SENSITIVITY = an unscorable episode gets the worst
   standardised error observed in that task (any arm/seed). Unscorable counts per arm are reported.
5. Verdict rule unchanged (section 5). A SUPPORTED by the rule is reported as SUPPORTED-PENDING until Bro re-scores the
   raw logs and checks witness consistency. Because this is a reduced pilot (3B, fewer seeds), even a rule-SUPPORTED
   result is a pilot signal only and does not settle the 7B contract.
Code frozen at commit 6bb0ae3c (harness.py, score.py, tests). Holdout command per seed S and shard i in 0..2:
   harness --backend ollama --model qwen2.5-3b-instruct-q4km-hf:latest --url http://127.0.0.1:11434 --tasks holdout
   --arms A,B,C --seeds S --shard i/3 --out evidence/cwc1/r1/scored
6. Run location: harness runs on the Grok box from this worktree (/workspace/spe-brain/cwc1-r1), logs written to
   evidence/cwc1/r1/scored/, committed raw before score.json is committed.
