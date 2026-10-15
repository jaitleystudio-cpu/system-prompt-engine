# LEC-1 R2 results — honest verdict: NOT_PROVEN (beats R1 lf_ltt_500 + rand_1000 non-inferior; H1 empirical validity NOT_PROVEN; H2 short)

Contract `docs/lec1/CONTRACT_R2.md` @ 5daade24 (sha256 d8b30fbd…0076, pushed before code) → code a5f3bc8a → these results.
Builder self-run on the Grok box. Mac mini (Ollama) OFFLINE via ListMachines, so no local LLM; synthetic CRC-1 DGP only. ₹0. No merge/deploy/PR.
Two runs byte-identical: summary.json sha256 d76bff93…7da2. ~7.5 min/run.
Tests 14/14; mutation gate 9/9 mutants killed (`evidence/lec1/r2/tests_and_mutation_gate.txt`).
Implementation: classical PPI (λ=1, f(s)=clip(1−s,0,1)) asymptotic CLT p-values + R1 label-free floor; LTT fixed sequence.

## Method
ppi_ltt ("prediction-powered LTT"): R1 label-free floor from U alone (C_ANCHOR=0.55, SAFETY=1.15); spend all B labels
above floor; at each t ≥ floor estimate risk via PPI using |U|=20k unlabeled scores + B labeled rectifiers; asymptotic
one-sided Φ((R̂−α)/SE) p-values; fixed-sequence LTT. **Honest:** p-values are CLT/asymptotic, not finite-sample exact.

## Primary (B = 500, 1000 draws; oracle t=0.960, coverage 0.4385, risk 0.0983)
| arm | labels | violation [CP95] | coverage | × oracle | abstain-all |
|---|---|---|---|---|---|
| rand_500 | 500 | 0.043 [0.031, 0.057] | 0.209 | 0.476 | 316 |
| lf_ltt_500 (R1 previous best) | 500 | 0.058 [0.044, 0.074] | 0.281 | 0.642 | 123 |
| rand_1000 | 1000 | 0.050 [0.037, 0.065] | 0.304 | 0.692 | 79 |
| **ppi_ltt_500 (primary)** | 500 | 0.088 [0.071, 0.107] | 0.313 | **0.714** | 68 |
| rand_2000 (ceiling) | 2000 | 0.054 [0.041, 0.070] | 0.361 | 0.824 | 2 |

Paired ppi_ltt_500 − lf_ltt_500: +0.0319 coverage (one-sided 95% LB +0.0287; **561 W / 0 L**).
Paired ppi_ltt_500 − rand_500: +0.1043 (LB +0.0939; 662 W / 272 L).
Paired ppi_ltt_500 − rand_1000: +0.0097 (LB +0.0012 > −0.01).
Floor coverage median 0.634 (p10 0.633, p90 0.635); ~789 unlabeled screened/draw.

## Verdicts
- H1 empirical validity: **NOT_PROVEN** (CP95 upper 0.107 > 0.10; point 0.088 ≤ δ but upper exceeds).
- H2 utility ≥ 0.85× oracle: **NOT_PROVEN** (0.714×).
- H3 beats previous best (lf_ltt_500): **SUPPORTED** (LB +0.0287 > 0).
- H4 (secondary) non-inferior to rand_1000: **SUPPORTED** (LB +0.0012 > −0.01) — first LEC-1 arm to clear H4.
- **Overall NOT_PROVEN.**

## Exploratory (no verdicts)
| arm | violation [CP95] | × oracle | abstain-all | notes |
|---|---|---|---|---|
| ppi_ltt_250 | 0.087 [0.070, 0.106] | 0.599 | 194 | beats lf_250; H1-style upper > δ |
| ppi_ltt_1000 | 0.076 [0.060, 0.094] | 0.822 | 3 | near rand_2000; CP upper ≤ δ |
| ppi_ppipp_500 (E2) | 0.100 [0.082, 0.120] | 0.694 | 96 | mean λ*=0.95; worse than λ=1 primary |
| ppi_hoeff_500 (E3) | 0.000 [0.000, 0.004] | 0.000 | 1000 | total abstention — Hoeffding too tight on Z∈[−1,1] |

## Plain reading
- Feeding |U|=20k into classical PPI risk estimates (same B=500 focused labels + R1 floor) lifts ×oracle from R1's
  0.642× to 0.714× and, for the first time in LEC-1, clears non-inferiority vs rand_1000 (H4 SUPPORTED).
- The cost is empirical validity: violation 0.088 with CP95 upper 0.107 just over δ — consistent with asymptotic
  CLT p-values being mildly anti-conservative at B=500. H1 is NOT_PROVEN (not REJECTED: CP lower 0.071 ≤ 0.10).
- H2 still fails: 0.85× remains out of reach (0.714×). ppi_ltt_1000 reaches 0.822× with valid-looking CP upper 0.094.
- E2 PPI++ power tuning did not help (0.694×, higher violation). E3 rectified Hoeffding abstained on every draw —
  finite-sample bound too conservative for this rectifier range.
- Synthetic, score-monotone DGP; Mac mini offline; box-only run.

## Next (proposal only; needs its own CONTRACT)
Finite-sample-valid PPI (e.g. WSR/betting on rectified loss with U-mean concentration), or a CLT finite-sample
correction / larger B curve. CRC-1 stays closed.
