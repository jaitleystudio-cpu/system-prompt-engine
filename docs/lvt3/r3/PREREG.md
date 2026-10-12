# LVT-3 R3 — H12-only preregistration (frozen before the holdout run)

Branch grok/lvt3-h12-r3, from grok/lvt3-research-r2 @ 8d619907. Builder: Grok Bot. Verifier: Bro.
The r3holdout split has NOT been executed by any arm as of this commit. R1 (NOT_PROVEN) and R2 (REJECTED, provisional) are unchanged.

## Question
H12: given the same verified-capability library and the same per-task compute budget, does uncertainty-guided probe selection beat cost-matched random and round-robin selection?

## Tasks
- Learning: the R2 train (50) + dev (15) families, with evaluator feedback. These are never scored in R3.
- Evaluation: fresh 3-op families from `r3_plan()` (spe_runtime/research/lvt3r3/tasks.py).
  - Never used in R1 (all R1 families have ≤ 2 ops) or in any R2 split; this is tested.
  - Split: r3val 24 families (calibration/power only), **r3holdout 120 families**.
  - Kinds alternate transfer/novel. No 'long' families, because H11 is excluded.
  - 5 tasks/family × 3 seeds (0, 1, 2). Evaluator seeds are 3000+seed (distinct from R2).
- **Manifest sha256: `fc9b648c72da697f3f6f821b7d9856864ac3e5d7eff64ed2ba2ad2b51f469483`**

## Arms (spe_runtime/research/lvt3r3/agent.py)
- A: search only, random probes, search cap 4000. This is the reference cost: **A mean on r3val = 3432.14 executions/task**.
- U, R and RR share:
  - an identical qualified registry (signed verdicts plus fresh re-verification; **guard and revocation OFF**);
  - an identical interleaved library/search scheduler;
  - an identical hard per-task budget of **4118.6 = 1.2 × 3432.14** (every program execution counted, including probe scoring).
- The three library arms differ only in the probe rule (k = 4 evaluator probes from the same 32-input pool):
  - **U:** cheap prior-weighted output entropy over ≤ 12 rivals, ≤ 60 rival-construction checks, ≤ 12 scored inputs. Cost counted.
  - **R:** uniform random.
  - **RR:** round-robin over input strata (negatives, duplicates, length ≥ 6, other).
- Separate H11 ablation (not part of the primary): U_guard = U + envelope guard + revocation.

## Endpoints, units, tests
- Unit: holdout family (n = 120). Per-family rates use 15 tasks each.
- **Primary (verified success):** VS:U−R and VS:U−RR.
- **Co-primary (false-success rate per task):** FS:R−U and FS:RR−U.
  - Common denominator = 1800 tasks per arm.
  - Declared counts and false-success per declared (Wilson 95%) are also reported.
- One-sided sign-flip permutation p (20,000 permutations, RNG 20261012). **Holm over the 4 tests, α = 0.05.** 95% paired-t CIs.
- **Minimum effects:** δ_VS = 0.05; δ_FS = 0.04.
- **Power** (r3val SDs, one-sided α = 0.05/4, 80% power):

  | contrast | r3val SD | families needed |
  |---|---|---|
  | VS:U−R | 0.125 | ≈ 60 |
  | VS:U−RR | 0.102 | ≈ 40 |
  | FS:R−U | 0.039 | ≈ 10 |
  | FS:RR−U | 0.115 | ≈ 78 (at δ_FS = 0.04) |

  120 families covers all four.
- Cost gate: every library arm's holdout exec/task ≤ 1.2 × A's holdout exec/task. The budget enforces this; it is reported.

## Verdict rule (provisional pending Bro)
- **BLOCKED:** the holdout cannot be run as specified, or the tests fail.
- **PROVEN_WITHIN_TESTED_SCOPE:** all of the following hold.
  - Both VS contrasts are rejected by Holm, each with mean ≥ δ_VS and CI lower bound > 0.
  - Both FS contrasts are rejected by Holm, each with mean ≥ δ_FS.
  - The cost gate holds.
- **REJECTED:** both VS contrasts have CI upper bound < δ_VS AND both FS contrasts have CI upper bound < δ_FS (a meaningful benefit is excluded on both endpoints).
- **NOT_PROVEN:** anything else.

## r3val observations at freeze (disclosed; no design changes were made after seeing them)
- VS: U − R = +0.003 [−0.051, 0.056]; U − RR = +0.014 [−0.030, 0.058].
- FS: R − U = −0.006 [−0.022, 0.011]; RR − U = +0.097 [0.048, 0.146].
- All library arms hit the budget on about 58–67% of tasks.
- U_guard is identical to U on r3val.
- The builder's expectation is NOT_PROVEN or REJECTED on VS; U is likely to beat RR on false success only.

## Run once
```
python -m spe_runtime.research.lvt3r3.run r3holdout evidence/lvt3r3/holdout --budget 4118.6 --expect-prereg-sha <sha256 of this file>
python -m spe_runtime.research.lvt3r3.analyze evidence/lvt3r3/holdout --delta-vs 0.05 --delta-fs 0.04
```
