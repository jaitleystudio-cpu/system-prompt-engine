# LEC-1 R0 results — honest verdict: NOT_PROVEN (valid and beats R0-style random calibration at B=500, but far from 0.85x)

Contract `docs/lec1/CONTRACT_R0.md` @ 9f522f6c (sha256 3edece74…7da1, pushed before code) -> code ca922cb8 -> these results.
Builder self-run on the Grok box. Mac mini (Ollama) OFFLINE, so no local LLM; synthetic CRC-1 DGP only. ₹0. No merge/deploy/PR.
Two runs byte-identical: summary.json sha256 d0fe1788…f3b7, rows.json dcc729ab…502c. ~22 s/run.
Tests 8/8; mutation gate 10/10 mutants killed (`evidence/lec1/r0/tests_and_mutation_gate.txt`).
Implementation note: the certification step uses a local `ltt()` that a test proves identical to `core.policy_ltt` on 40 random count vectors.

## Method
pf_ltt ("pilot-focused LTT", two-phase sampling with a score-only labeling rule): 20% of the budget is a random pilot used
only to place a score floor (naive pilot threshold, widened 1.25x in unlabeled coverage); the other 80% of labels are
spent only on items with s >= floor, and R0 fixed-sequence LTT certifies on those labels alone, never below the floor.

## Primary (B = 500, 1000 draws; oracle t=0.960, coverage 0.4385, risk 0.0983)
| arm | labels | violation [CP95] | coverage | x oracle | abstain-all |
|---|---|---|---|---|---|
| rand_500 (CRC-1 R0 style) | 500 | 0.043 [0.031, 0.057] | 0.209 | 0.476 | 316 |
| **pf_ltt_500 (primary)** | 500 | 0.053 [0.040, 0.069] | 0.254 | **0.580** | 199 |
| rand_1000 | 1000 | 0.050 [0.037, 0.065] | 0.304 | 0.692 | 79 |
| rand_2000 (ceiling) | 2000 | 0.054 [0.041, 0.070] | 0.361 | 0.824 | 2 |

Paired pf_ltt_500 − rand_500: +0.0455 coverage (one-sided 95% LB +0.034; 548 wins / 350 losses).
Paired pf_ltt_500 − rand_1000: −0.049 (UB −0.039).
pf_ltt_500 floor coverage median 0.640 (p10 0.401, p90 0.836); pilot fallback (no focusing) 89/1000; ~690 unlabeled items screened per draw.

## Verdicts
- H1 validity: **SUPPORTED** (CP95 upper 0.069 <= 0.10).
- H2 utility >= 0.85x oracle: **NOT_PROVEN** (0.580x).
- H3 beats rand_500 at the same budget: **SUPPORTED** (LB +0.034 > 0).
- H4 (secondary) non-inferior to rand_1000: **REJECTED** (UB −0.039 < −0.01). Focusing does not halve the labels needed.
- **Overall NOT_PROVEN.**

## Exploratory (no verdicts)
| arm | violation [CP95] | x oracle | abstain-all | paired vs random at same B |
|---|---|---|---|---|
| rand_250 | 0.033 [0.023, 0.046] | 0.261 | 611 | — |
| pf_ltt_250 | 0.034 [0.024, 0.047] | 0.316 | 529 | +0.024 (LB +0.012); fallback 304/1000 |
| pf_ltt_1000 | 0.048 [0.036, 0.063] | 0.748 | 25 | +0.024 (LB +0.017) vs rand_1000; −0.033 vs rand_2000 |
| hindsight_500 (floor at c_U≈0.60, tuned with CRC-1 knowledge — not a fair method) | 0.049 [0.036, 0.064] | 0.649 | 117 | +0.076 (LB +0.065) |

## Plain reading
- First valid coverage gain on this DGP at n=500 labels since CRC-1 R0: 0.476x -> 0.580x (+22% relative), violation still ~0.05.
  CRC-1 R1–R3 search-order changes never beat R0; spending labels where they matter does.
- The gain is modest: R0's search at 1000 random labels (0.692x) still wins, so focusing is worth about 1.3–1.4x labels, not 2x.
- Post-hoc diagnosis (not a verdict change): (1) the 100 pilot labels are thrown away for certification (20% of budget);
  (2) the pilot floor is loose (median floor coverage 0.64 while certified thresholds sit near coverage 0.25–0.36), so
  about half of stage-2 labels still land below the certified threshold; (3) at B=250 the pilot often cannot find a
  threshold at all (304 fallbacks). The hindsight floor (0.649x) bounds what a better label-free floor could add here.
- 0.85x oracle(0.10) at 500 labels looks out of reach on this DGP for any binomial-test method: the oracle risk is 0.098,
  just under alpha, so certification needs a large n right at the boundary.

## Next (proposal, not run; needs its own CONTRACT)
LEC-1 R1: multi-stage focusing (raise the floor sequentially from accumulated labels, with stage-wise fresh labels or a
valid sequential/betting test so earlier labels are not wasted), and report labels-needed curves for a target coverage
rather than a fixed 0.85x bar. Real-data check once the Mac mini/Ollama are back.
