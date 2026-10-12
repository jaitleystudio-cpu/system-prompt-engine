# AGI-BRAIN R2 Results — held-out families, plain vs established CEGIS vs SPE world model

- Contract `CONTRACT_R2.md` sha256 `1911d6af…b735`, committed in `8a58ccff` before the run. Frozen starts `evidence/agi-brain/r2/starts.json` (`f1623f25…59cb735`... see file).
- Command: `python3 -m spe_runtime.research.agi_brain.experiment_r2 evidence/agi-brain/r2` → `evidence/agi-brain/r2/{rows.jsonl,results.json}`, stdout `evidence/agi-brain/r2_stdout.txt`. 300 runs (10 families × 3 conditions × 10 seeds), 8.0 CPU-s each (measured 8.12–8.14 mean), 4 workers, wall 791.5 s, peak worker RSS ≈ 37.9 MB for all conditions. ₹0.
- Process note: a first launch at ~21:30 IST was killed by the shell harness before writing any output (empty stdout, no rows); the run reported here is the first and only completed run.

## Means over seeds
| | quality (start/size) | success (valid & smaller than start) | correctness (indep. verifier) | proposals | verifier calls |
|---|---|---|---|---|---|
| plain | 1.0015 | 4.0% | 100/100 | 26,715 | 26,715 |
| CEGIS | 1.0032 | 9.0% | 100/100 | 105,915 | 25,843 |
| SPE world model | 1.0022 | 6.0% | 100/100 | 65,964 | 26,282 |

## Paired contrasts (10 seeds; t95 / bootstrap95; exact sign-flip p; Holm over 3)
| endpoint | contrast | mean | t95 | boot95 | p | p_Holm |
|---|---|---|---|---|---|---|
| quality | SPE−CEGIS | −0.0010 | [−0.0022, 0.0002] | [−0.0020, 0.0000] | 0.25 | 0.50 |
| quality | SPE−plain | +0.0007 | [−0.0004, 0.0019] | [0.0000, 0.0019] | 0.50 | 0.50 |
| quality | CEGIS−plain | +0.0017 | [0.0004, 0.0031] | [0.0006, 0.0028] | 0.0625 | 0.1875 |
| success | SPE−CEGIS | −0.03 | [−0.065, 0.005] | [−0.06, 0.00] | 0.25 | 0.50 |
| success | SPE−plain | +0.02 | [−0.010, 0.050] | [0.00, 0.05] | 0.50 | 0.50 |
| success | CEGIS−plain | +0.05 | [0.012, 0.088] | [0.02, 0.08] | 0.0625 | 0.1875 |

## Provisional verdict
**NO_ADVANTAGE_OVER_ESTABLISHED_CEGIS (NOT_PROVEN).** H1, H2, H3 all fail the preregistered Holm rule. Point estimates favour CEGIS over the SPE world model (CEGIS screens ~4× more proposals per CPU-second than plain; SPE-WM ~2.5×). Correctness: 300/300 claims accepted by the independent verifier. Programme status: RESEARCH_PROPOSAL — NOT AGI_PROVEN.

## Honest reading
- Search almost never improves the merge-exchange start: improvements only on select12k4 (28→27, all conditions) and median13 (40→39, CEGIS only). No sort13–16 result approaches best-known sizes (45/51/56/60). The mutation hill-climber is weak; this is a harness result, not discovery.
- The R1 "world model" gain (H1 in R1) was a gain over *no* counterexample memory; against a faithful CEGIS baseline it disappears. SPE-WM's bounded probe set (k=16) appears to cost it screening throughput relative to unbounded CEGIS.
- Minimum attainable sign-flip p with 10 seeds is 0.002; most per-seed differences were zero, so power is low.
- Self-run on a shared machine (Ollama P4 ran concurrently on GPU); CPU-time budgets are not bit-reproducible. Needs Bro's replay.
