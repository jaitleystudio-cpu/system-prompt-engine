# AGI-BRAIN R2 — Preregistered contract (held-out families; SPE world model vs established CEGIS)

FROZEN before any R2 run. Programme status: RESEARCH_PROPOSAL — NOT AGI_PROVEN. ₹0, local CPU only.
Frozen code: `spe_runtime/research/agi_brain/{netsearch_r2,evaluator_r2,r2_starts,experiment_r2}.py` + reused R1/LVT-3 helpers; frozen start networks `evidence/agi-brain/r2/starts.json`.

## Held-out families (none used in R1: R1 used sort/minmax ≤12, median ≤11, no selection)
sort13, sort14, sort15, sort16; select12k4, select14k7, select16k4, select16k8 (wires 0..k−1 hold the k smallest, any order — new kind); median13, median15 (new sizes). Start network per family = pruned Knuth merge-exchange (sizes 48, 53, 59, 63, 28, 43, 40, 49, 40, 49), built once and shared by all conditions.

## Conditions (equal budgets)
Each (family, seed, condition) gets exactly **8.0 CPU-seconds** of search (`time.process_time`), one process, same start, same mutation operator, same RNG stream; 4 worker processes for every condition (same memory envelope; peak RSS reported).
- **plain**: exhaustive check of every candidate, no memory.
- **cegis**: faithful standard CEGIS loop — synthesiser keeps proposing until a candidate is consistent with all stored counterexamples E; verifier (exhaustive) returns one counterexample, appended to E (unbounded). Citation: Jha & Seshia, "Are There Good Mistakes? A Theoretical Analysis of CEGIS", arXiv 1407.5397 (verified); Solar-Lezama 2008 (sketching).
- **spe_wm**: R1 condition D world model: bounded (k=16) counterexample set ranked by kill count, probed first; survivors verified exhaustively.

## Independent verifier
`evaluator_r2.verify` (imports only the R1 independent evaluator, never the generator): all 2^n 0/1 vectors + 3000 random integer vectors with duplicates, compared with `sorted()`.

## Endpoints (reported separately)
- **quality** (primary) = start_size / size if independently valid else 0; mean over 10 families per seed.
- **success** = independently valid AND strictly smaller than the start network.
- **correctness** = share of claimed networks the independent verifier accepts.
- **cost** = CPU seconds (fixed by design), plus exhaustive-equivalent input evaluations, proposals, verifier calls, CPU-to-best.
- Also: hits of literature best-known size for sort13–16 (45/51/56/60).

## Statistics
Unit = seed (10 seeds, 0–9). Paired differences; t95 CI (LVT-3 `ci_t`, df=9) and bootstrap 95% CI (LVT-3 `ci_boot`). p-values: exact two-sided sign-flip permutation test (1024 flips). Holm correction over the 3 contrasts {spe_wm−cegis, spe_wm−plain, cegis−plain}, separately per endpoint (quality, success).

## Decision rules
- H1 (primary): spe_wm > cegis on quality, Holm p < 0.05 → `SPE_WM_ADVANTAGE_OVER_CEGIS_WITHIN_SCOPE`; else `NO_ADVANTAGE_OVER_ESTABLISHED_CEGIS (NOT_PROVEN)`.
- H2: spe_wm > plain; H3: cegis > plain (same rule).
- Any independently invalid claim is reported as a correctness defect regardless of hypotheses.
- Verdicts are provisional (self-run, one machine, non-deterministic CPU-time budgets) until Bro's replay. Never described as AGI, novel or superior beyond this scope.

## Stopping rule
One full run. No re-runs to chase significance. Changes after freeze → CONTRACT_R2.1, R2 result kept.

## Known threat to validity (declared in advance)
CPU-time budgets on a shared Mac mini (Ollama P4 job may run concurrently) are not bit-reproducible; process CPU time (not wall) is used to limit contention effects. Replays should match in distribution, not byte-for-byte.
