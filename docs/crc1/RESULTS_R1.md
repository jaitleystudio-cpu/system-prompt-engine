# CRC-1 R1 results — honest verdict: NOT_PROVEN (and the primary fix did NOT beat R0's search)

Contract `docs/crc1/CONTRACT_R1.md` @ 9c2f8fff (sha256 237c68cd…88c9), freeze bcdcb59, code 976068d, then these results.
Builder self-run on the Grok box (the Mac mini was offline, so no local LLM; synthetic R0 DGP). ₹0. Nothing merged or deployed.

## Bro's four R0 fixes
1. Tests: new hand-built-vector tests plus an 8-mutant gate; 8/8 mutants killed (`evidence/crc1/r1/mutation_gate.txt`).
   Bro's exact M1/M3/M4/M5 definitions were not available on the box, so the gate uses self-defined mutants; Bro should rerun his own.
2. H1 bar is now CP95 upper <= delta = 0.10 (was 0.12).
3. Search replaced by a frozen min-count fixed sequence (N_MIN = 0.3 n_cal), with SGR and Bonferroni-10 as valid baselines.
4. summary.json has no timing fields; two runs are byte-identical (sha256 17940a6d…948e).

## Primary (n_cal=500, 1000 fresh calibration draws; oracle coverage 0.4385 at t=0.960)
| policy | violation [CP95] | coverage | x oracle | abstain-all |
|---|---|---|---|---|
| naive_cal | 0.504 [0.473, 0.535] | 0.436 | 0.995 | 7 |
| ltt_r0 (R0 search) | 0.044 [0.032, 0.059] | 0.207 | 0.473 | 308 |
| SGR (Geifman & El-Yaniv) | 0.003 [0.001, 0.009] | 0.092 | 0.209 | 652 |
| bonf10 | 0.000 [0.000, 0.004] | 0.045 | 0.103 | 798 |
| **ltt_mc (SPE R1 primary)** | 0.047 [0.035, 0.062] | 0.156 | 0.355 | 576 |

Paired ltt_mc − SGR coverage: +0.064 (one-sided 95% LB +0.056; 420 wins, 85 losses).

Verdicts: H1 validity **SUPPORTED**; H2 utility (>= 0.85x oracle) **NOT_PROVEN** (0.355x);
H3 beats SGR **SUPPORTED**. Overall **NOT_PROVEN**.

## Plain reading
- The R1 primary is valid and beats the established SGR baseline, but it is WORSE than R0's own search on the same draws
  (0.355x vs 0.473x oracle; 576 vs 308 all-abstain). The repair backfired.
- Post-hoc diagnosis (not a verdict): the preregistered power argument assumed true risk <= 0.05 at the start point.
  The real population risk where coverage is 0.30 is 0.068, so the first test fails about half the time.
  R0's diagnosis ("tiny noisy top bin") was also wrong: s >= 0.995 holds 18% of the population at risk 0.044.
- The real limit is calibration size, not search order: E2 (n_cal=2000) lifts ltt_r0 to 0.84x and ltt_mc to 0.79x,
  still valid (violation 0.050). Certifying risk <= 0.10 near an oracle at 0.098 needs far more than 500 labels.
- Exploratory: E1 n_cal=100 is near-total abstention for every valid method. E3 shift breaks validity again
  (ltt_mc 0.122, ltt_r0 0.111), so "verified" still needs a shift check before it can be claimed off-distribution.

## Next (proposal, not run)
Keep R0's fixed sequence as the SPE default; make the coverage target depend on n_cal (report the minimum labels for
a target coverage) and test it on real local-LLM claim data once the Mac mini and Ollama are back.
