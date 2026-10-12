# AGI-BRAIN R1 — Frozen Experiment Contract (algorithm discovery: comparator networks)

Status: FROZEN before any R1 run. Programme status: RESEARCH_PROPOSAL — NOT AGI_PROVEN. Cost: ₹0 (local CPU only, no LLM, no paid API).
Code under test is frozen at the commit that introduces this file: `spe_runtime/research/agi_brain/{families,netsearch,evaluator_r1,experiment_r1}.py`.

## Task family
23 families = kind × n: sort n∈{4..12}, minmax n∈{4..12} (wire0=min, wire n−1=max), median n∈{3,5,7,9,11} (middle wire = median).
Goal per family: discover a valid comparator network with as few comparators as possible (secondary: depth = parallel time).

## Evaluators (independent of generator)
`evaluator_r1.verify` shares no code with `netsearch`: it runs the claimed network on concrete integer lists — all 2^n 0/1 vectors plus 2000 random integer vectors with duplicates (seeded) — and compares to Python `sorted()`. Size = comparators; speed = depth; memory = n wires in place (constant for every network; reported, not compared). Wall-clock speed is NOT an endpoint.

## Conditions (equal proposal budget = 1500 mutations per family)
- **A plain search**: start from insertion network; hill-climb; validity checked on a fixed 32-vector random sample (no exhaustive tool).
- **B search + tools**: start from Knuth merge-exchange (Batcher) construction; exhaustive validity tool; redundancy-pruning tool before/after search.
- **C existing-SPE-pattern workflow**: B + a verified-procedure library (LVT-style: train-family sort solutions are admitted only if the independent evaluator accepts them) reused as transfer seeds (library sort(m) prefix + insertion of remaining wires). This is an emulation of SPE's verified-reuse pattern, not the production SPE compiler.
- **D C + executable world model**: maintains a counterexample model (input → kill count); each candidate is first run on the 16 most-discriminating stored experiments; only survivors get the exhaustive check; new counterexamples update the model. (Prior art: CEGIS / counterexample-guided search; no novelty claimed.)
- **E** (LVT-3 mechanism) is excluded until LVT-3 R2 reports.

## Splits, seeds, units
Seeds 0–9 (10). Per seed, families are shuffled (`Random("split|seed")`): 9 train (library only), 14 held-out test. All endpoints are computed on test families only. Statistical unit = seed (family-level split is redrawn per seed).

## Endpoints
- quality = REF/size if independently valid, else 0 (REF = pruned merge-exchange size, frozen table in `experiment_r1.REF`). Mean over test families per seed.
- false_success = share of claimed networks the independent evaluator rejects.
- cost = total metered input-evaluations (generator side, including library construction is NOT counted for C/D — reported limitation); log_cost per seed.
- Also reported: depth, hits of literature best-known size (sort: Knuth TAOCP 5.3.4; minmax: ⌈3n/2⌉−2).

## Statistics
Paired differences over 10 seeds: t-CI (df=9, LVT-3 `ci_t`), paired bootstrap 95% CI (LVT-3 `ci_boot`, 10k, RNG 12345), and Bonferroni-adjusted t-CI (t=2.933, 3 contrasts). Decisions use the Bonferroni CI.

## Hypotheses and decision rules (frozen)
- **H1 (primary)**: D is cheaper than C and non-inferior in quality: upper Bonf bound of log_cost(D−C) < 0 AND lower Bonf bound of quality(D−C) > −0.02. Pass → `SUPPORTED_WITHIN_TESTED_SCOPE (H1)`, else `NOT_PROVEN (H1)`.
- H2: quality(C−B) lower Bonf bound > 0.
- H3: quality(B−A) lower Bonf bound > 0.
- No result may be described as AGI, novel or superior to external systems. A pass is scoped to this toy family and is self-run (not independently replicated) until Bro replays it.

## Stopping rules
One full run. No re-runs to chase significance; any code change after freeze requires a new contract version (R1.1) and keeps the R1 result.
