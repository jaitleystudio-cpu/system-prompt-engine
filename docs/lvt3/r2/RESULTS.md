# LVT-3 R2 — Holdout results (single preregistered run)

- PREREG: docs/lvt3/r2/PREREG.md, sha256 `3042ee90ee0832d0762284ab9eeed837037fde99d7dfc7dfcb0cd9f286c6ec60`, commit 03c88785. The holdout was run once, afterwards, with the runner's hash and clean-tree check passing (exit 0, 50.2 s).
- Manifest sha256: cb07aaad…2a99. 80 holdout families × 5 tasks × 3 seeds. Unit = family.
- Raw data: evidence/lvt3r2/holdout/{rows.jsonl, meta.json, analysis.json}.

## Configurations (holdout, family-macro means)
| config | verified success | exec/task | false-success rate | long | novel | transfer |
|---|---|---|---|---|---|---|
| A | 0.362 | 3156 | 0.141 | 0.292 | 0.383 | 0.375 |
| B (budget 3335.8) | 0.365 | 2257 | 0.117 | 0.258 | 0.350 | 0.433 |
| E (uncapped) | 0.603 | 17593 | 0.026 | 0.296 | 0.594 | 0.765 |
| **E_CAPPED (budget 3335.8)** | **0.322** | 3232 | 0.182 | 0.225 | 0.287 | 0.404 |
| E_noguard | 0.686 | 20620 | 0.021 | 0.725 | 0.594 | 0.758 |
| E_randprobe | 0.557 | 11093 | 0.140 | 0.292 | 0.500 | 0.746 |
| E_shufv | 0.370 | 4143 | 0.043 | 0.296 | 0.404 | 0.373 |

## Confirmatory (paired over 80 families; 95% t-CI; one-sided permutation p; Holm)
| contrast | mean | 95% CI | p | p_Holm | reject H0 |
|---|---|---|---|---|---|
| **E_CAPPED − B (primary)** | **−0.043** | **[−0.080, −0.007]** | 0.992 | 1.0 | no |
| E_CAPPED − A | −0.040 | [−0.079, −0.002] | 0.982 | 1.0 | no |
| E − B | +0.238 | [0.177, 0.298] | <0.001 | 0.00015 | yes (but E costs 5.6× A, so it is not cost-admissible) |

## Gates
| gate | result |
|---|---|
| G1 primary ≥ δ = 0.10 and significant | **FAIL**: mean −0.043, CI upper −0.007 < 0 |
| G2 cost ≤ 1.2 × A | PASS: 3232 ≤ 3787 |
| G3 false-success ≤ B + 0.02 | **FAIL**: 0.182 vs 0.137 |
| G4 E − E_shufv lower bound > 0 | PASS: +0.233 [0.169, 0.296] |
| G5 LVT-2 mutation gate | PASS: 30/30 (f2a0512c) |

The primary CI upper bound is < δ and < 0, so the preregistered rule gives **REJECTED** (provisional until Bro replicates).
Scope: the cost-capped qualified library + entropy-probe agent does not beat a cost-matched naive library on this compositional DSL holdout; it is slightly worse.

## Ablations (secondary, descriptive)
| contrast | overall | long | novel | transfer |
|---|---|---|---|---|
| H11: E − E_noguard | **−0.083 [−0.134, −0.033]** | −0.429 [−0.599, −0.259] | 0.000 | +0.006 [−0.017, 0.029] |
| H12: E − E_randprobe | **+0.046 [0.015, 0.077]** | +0.004 | +0.094 [0.034, 0.154] | +0.019 [−0.029, 0.066] |
- **H11 is contradicted.** The envelope guard blocks correct capabilities on out-of-envelope (long) inputs. The DSL semantics are length-invariant, so the guard has nothing to protect against and only costs reuse.
- **H12 is supported (uncapped).** Entropy probes beat random probes, mainly on novel families, and cut false successes from 109 to 19. However, scoring the probes costs executions, and under the cap the budget is consumed: E_CAPPED hits it on 86.8% of tasks vs 58.7% for B.

## Adversarial challenges (evidence/lvt3r2/adversarial/)
- **C1 seed robustness:** the primary is negative in all 3 seeds (−0.025, −0.010, −0.095). It is not driven by one seed.
- **C2 budget starvation:** E_CAPPED hits the budget on 86.8% of tasks vs 58.7% for B. Its library-sourced solutions are 18.1% vs 23.7% for B. Mechanism: probe-scoring cost.
- **C3 evaluator independence:** 0/20,000 disagreements between solver and evaluator semantics on random programs and broad inputs.
- **C4 false successes:** E_CAPPED declares 472 and has 86 false. Budget exhaustion forces it to keep under-probed candidates.
- **C5 cost frontier (EXPLORATORY, post-hoc on holdout, not confirmatory):** E_CAPPED − B at budget 6312 (2× A) = −0.062 [−0.102, −0.021]; at 15780 (5× A) = −0.015 [−0.068, 0.038]. Cost-matched B catches up with or beats the qualified agent at every budget tried. The uncapped E advantage is largely bought with compute.
- **C6 fairness of B:** B uses the same interleaved scheduler and budget, and its library is unverified, so it is a strong comparator, not a strawman. With library-first scheduling at val, B was 0.157, which would have flattered E.
- **Forking paths:** three val-stage design iterations are disclosed in PREREG §6. The holdout was never used for design.

## Limitations
- Synthetic toy DSL with builder-written generator, agent and evaluator. Builder ≠ verifier is pending Bro.
- One holdout run with 3 seeds; families come from one generator, so external validity is untested.
- t-critical values for df=79 use a table (1.990).
- The R1 verdict (NOT_PROVEN) stands and is unchanged.

## Robustness note (added 2026-10-13, post-replay; verdict unchanged)
Independent replay by Bro @ 8d619907 (REPLAY_PASS, byte-identical rows) added a cluster-robust check:
- Primary (family-level, 80 families, as preregistered): E_CAPPED − B = **−0.043 [−0.080, −0.007]**.
- Cluster-robust (80 families grouped into **21 clusters by shared op-pairs**, Bro's analysis): **−0.030 [−0.097, +0.036]**.
- Interpretation: **REJECTED still holds** (the improvement is below δ either way), but the stronger reading "E_CAPPED is significantly *worse* than B" does not survive clustering; it should be read as "no improvement, sign uncertain".
- Not part of the preregistered analysis; reported as a robustness note only. Numbers are Bro's and were not re-derived by the builder in this commit.
- Bro also noted the evaluator is not truly independent of the builder (same author, same repo).
