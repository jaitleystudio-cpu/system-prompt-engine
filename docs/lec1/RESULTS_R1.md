# LEC-1 R1 results — honest verdict: NOT_PROVEN (valid, beats R0 pf_ltt_500, still short of 0.85× oracle)

Contract `docs/lec1/CONTRACT_R1.md` @ 91416b4a (sha256 a9b0131b…be644, pushed before code) → code eb1ffdfe → these results.
Builder self-run on the Grok box. Mac mini (Ollama) OFFLINE, so no local LLM; synthetic CRC-1 DGP only. ₹0. No merge/deploy/PR.
Two runs byte-identical: summary.json sha256 c1206645…899c, rows.json b1aa3825…7035. ~24 s/run.
Tests 10/10; mutation gate 9/9 mutants killed (`evidence/lec1/r1/tests_and_mutation_gate.txt`).
Implementation: reuses R0 `ltt()` / `focused_sample` / `certify_counts`; floor from U only via C_ANCHOR=0.55, SAFETY=1.15 (c_f=0.6325).

## Method
lf_ltt ("label-free floor LTT"): place a score floor from unlabeled scores U alone
(`c_f = min(1, C_ANCHOR * SAFETY)`); spend all B labels on items with s ≥ floor; certify with R0 fixed-sequence LTT
on those B labels, masking below the floor. No pilot — full budget certifies.

## Primary (B = 500, 1000 draws; oracle t=0.960, coverage 0.4385, risk 0.0983)
| arm | labels | violation [CP95] | coverage | × oracle | abstain-all |
|---|---|---|---|---|---|
| rand_500 | 500 | 0.043 [0.031, 0.057] | 0.209 | 0.476 | 316 |
| pf_ltt_500 (R0 previous best) | 500 | 0.053 [0.040, 0.069] | 0.254 | 0.580 | 199 |
| **lf_ltt_500 (primary)** | 500 | 0.058 [0.044, 0.074] | 0.281 | **0.642** | 123 |
| rand_1000 | 1000 | 0.050 [0.037, 0.065] | 0.304 | 0.692 | — |
| rand_2000 (ceiling) | 2000 | — | — | ~0.824 | — |

Paired lf_ltt_500 − pf_ltt_500: +0.0269 coverage (one-sided 95% LB +0.020; 422 W / 297 L).
Paired lf_ltt_500 − rand_500: +0.0725 (LB +0.062; 587 W / 327 L).
Paired lf_ltt_500 − rand_1000: −0.0222 (UB −0.013).
lf_ltt_500 floor coverage median 0.634 (p10 0.633, p90 0.635) — pinned to c_f=0.6325; ~789 unlabeled screened/draw.

## Verdicts
- H1 validity: **SUPPORTED** (CP95 upper 0.074 ≤ 0.10).
- H2 utility ≥ 0.85× oracle: **NOT_PROVEN** (0.642×).
- H3 beats previous best (pf_ltt_500): **SUPPORTED** (LB +0.020 > 0).
- H4 (secondary) non-inferior to rand_1000: **REJECTED** (UB −0.013 < −0.01).
- **Overall NOT_PROVEN.**

## Exploratory (no verdicts)
| arm | violation [CP95] | × oracle | abstain-all | notes |
|---|---|---|---|---|
| lf_ltt_250 | 0.051 [0.038, 0.067] | 0.434 | 365 | beats pf_250 exploratory |
| lf_ltt_1000 | 0.057 [0.043, 0.073] | 0.797 | 9 | near rand_2000 ceiling |
| lf_sens_0.45_500 (post-hoc) | 0.078 | 0.714 | 62 | tighter floor → more coverage, higher risk |
| lf_sens_0.65_500 (post-hoc) | 0.056 | 0.615 | 163 | looser than primary |

## Plain reading
- Removing the 20% pilot burn and pinning the floor to an a-priori unlabeled coverage band (c_f=0.6325) lifts
  certified coverage from R0's 0.580× to 0.642× at the same B=500, still valid (~0.058 violation).
- That nearly matches R0's hindsight floor (0.649×) without peeking at oracle coverage — the label-free rule recovered
  most of the focusing ceiling that R0 left on the table.
- H2 still fails: 0.85× at 500 labels remains out of reach on this DGP for binomial LTT (oracle risk 0.098).
- H4 still REJECTED: lf_500 < rand_1000; effective label multiplier ~1.3–1.5×, not 2×.
- Post-hoc sensitivity: a tighter anchor (0.45) buys more coverage (0.714×) at higher violation (0.078) — still under
  δ on this sample, but not preregistered; do not promote without a new CONTRACT.

## Next (proposal only; needs its own CONTRACT)
Labels-needed curves for target coverage; multi-stage / betting reuse of early labels; real-data check once Mac mini/Ollama return. CRC-1 stays closed.
