# LVT-3 R3 — H12-only holdout results (single preregistered run)

- PREREG: docs/lvt3/r3/PREREG.md, sha256 `f9d26438bbe400abbb85696d3a0cad53d6579bf3b771cfaa7411401558b4d744`, commit 7687967f.
- The run happened after the freeze: the runner's hash and clean-tree check passed, exit 0, 52.5 s. A builder rerun was row-identical.
- Manifest fc9b648c…9483: 120 fresh families × 5 tasks × 3 seeds = 1800 tasks per arm.
- Raw data: evidence/lvt3r3/holdout/rows.jsonl (9000 rows), analysis.json.

## Arms
| arm | verified (family macro) | declared | verified n | false-success n | FS/task (Wilson 95%) | FS/declared (Wilson 95%) | exec/task | budget hit |
|---|---|---|---|---|---|---|---|---|
| A | 0.277 | 625 | 499 | 126 | 7.00% [5.91, 8.27] | 20.2% [17.2, 23.5] | 3414 | — |
| **U** (uncertainty) | 0.265 | 584 | 477 | 107 | 5.94% [4.94, 7.13] | 18.3% [15.4, 21.7] | 3249 | 68.4% |
| R (random) | 0.253 | 564 | 456 | 108 | 6.00% [4.99, 7.19] | 19.1% [16.1, 22.6] | 3156 | 68.7% |
| RR (round-robin) | 0.246 | 695 | 442 | 253 | 14.06% [12.53, 15.74] | 36.4% [32.9, 40.1] | 2927 | 61.4% |
| U_guard (H11 ablation) | 0.266 | 586 | 478 | 108 | 6.00% | 18.4% | 3245 | 68.2% |

Cost gate: every library arm is ≤ 1.2 × A (4096). PASS.

## Primary / co-primary (paired over 120 families; 95% t-CI; Holm over 4 tests)
| test | mean | 95% CI | p (one-sided) | p_Holm | reject |
|---|---|---|---|---|---|
| VS: U − R | +0.012 | [−0.006, 0.029] | 0.103 | 0.206 | no |
| VS: U − RR | +0.019 | [−0.001, 0.040] | 0.033 | 0.099 | no |
| FS: R − U | +0.001 | [−0.006, 0.007] | 0.496 | 0.496 | no |
| FS: RR − U | +0.081 | [0.059, 0.103] | <0.001 | 0.0002 | **yes** |

## Verdict (provisional, pending Bro): **NOT_PROVEN**
- **PROVEN fails:** neither VS contrast is significant, and FS:R−U is null.
- **REJECTED fails narrowly:**
  - Both VS upper bounds (0.029, 0.040) and the FS:R−U upper bound (0.007) are below their δ.
  - But FS:RR−U is a real, large benefit, so the "benefit excluded on both endpoints" condition does not hold.

What this means:
- **Against random probes:** under a matched budget, uncertainty-guided probing is indistinguishable from random on both endpoints. A meaningful benefit (δ_VS = 0.05, δ_FS = 0.04) is excluded against random.
- **Against round-robin:** it beats fixed round-robin strata, mainly by avoiding RR's false successes.
- **R2's H12 effect:** the uncapped 109 → 19 false-success reduction does not survive cost matching against random.

## Ablations and secondary results
- **H11 (U_guard − U):** VS +0.0006 [−0.0006, 0.0017]. The guard is inert on these families (there are no out-of-envelope inputs).
- **Library arms vs A:** U − A = −0.012 [−0.040, 0.015]. A − U false success = +0.011 [0.001, 0.020]. Under the matched budget the library does not raise verified success, but it slightly lowers false success.

## Limitations
- Library arms hit the budget on about 61–69% of tasks. The test is a low-compute regime; a different budget could change the ranking.
- U's cheap scorer (≤ 12 rivals) is one design point. A better rival generator is untested.
- Toy synthetic DSL with a builder-written evaluator. The builder ≠ verifier condition is pending Bro.
- Power numbers in PREREG were approximate (computed at α/3 in code; written for α/4).
