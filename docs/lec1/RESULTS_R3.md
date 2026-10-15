# LEC-1 R3 Results — ppi_wsr_ltt (WSR/betting finite-sample PPI)

Branch: `grok/lec1-r3-wsr-ppi-ltt`. Prereg: b95a9dd9 (CONTRACT sha256 c21fc988…). Code: 21f57ce2. Overall: **REJECTED**.

## Verdicts (B=500, 1000 draws)
| hypothesis | verdict | numbers |
|---|---|---|
| H1 empirical validity | **SUPPORTED** | violation 0.0 CP95 [0.0, 0.003682] (upper ≤ δ) |
| H2 ≥ 0.85 × oracle | NOT_PROVEN | **0.000×** (abstain_all=1000/1000) |
| H3 non-inferior to ppi_ltt_500 (LB > −0.02) | **REJECTED** | paired mean -0.3132, UB -0.3072 < −0.02 |
| H3b beats lf_ltt_500 | **REJECTED** | paired mean -0.2814, UB -0.2746 < 0 |
| H4 non-inferior rand_1000 (secondary) | REJECTED | paired mean -0.3035 |
| Overall | **REJECTED** | |

## Coverage ladder (× oracle; oracle cov=0.438528)
- ppi_wsr_ltt_500 (primary): **0.000×** (mean cov 0.0)
- ppi_ltt_500 (R2 asymptotic): 0.714×
- lf_ltt_500 (R1): 0.642×
- rand_1000: 0.692×
- Exploratory: ppi_wsr_250=0.000× (abstain 1000); ppi_wsr_1000=0.000× (abstain 999)

## Interpretation
WSR/betting on Z=Y−f ∈ [−1,1] with predictable truncated Kelly **fixes H1** (0 violations) but **collapses utility**: 1000/1000 abstain-all at B=500 (same pathology as R2 E3 Hoeffding). Per-observation edge is tiny when f(s)≈1−s is already calibrated on high-s items, while the [−1,1] range makes Ville capital grow too slowly to clear δ=0.10 before LTT. Validity without coverage is not an SPE upgrade. Natural next (not this round): Bernoulli-Y betting with PPI-shifted null θ_Y=α−μ̂_f+mean_L(f) (range 1, covariate-conditioned scores).

Determinism: two runs byte-identical (summary sha256 f0dba7eb…7001). Tests 15/15; mutation gate 9/9 killed.
₹0. No merge/deploy/PR. CRC-1 untouched. Mac mini offline.
