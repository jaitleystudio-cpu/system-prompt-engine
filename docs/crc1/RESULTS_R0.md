# CRC-1 R0 results — builder self-run (Bro replay pending)

Contract 936fa87c (sha256 18c634d3…92b0) -> freeze ddad2c3b -> code 8bdbae80 -> this results commit.
alpha=0.10, delta=0.10, n_cal=500, 500 seeds, population truth n=400,000. Runtime 2.2 s on Mac mini. Cost ₹0.

| policy | violation rate (CP95) | mean coverage | coverage / oracle | abstain-all seeds |
|---|---|---|---|---|
| oracle (ref) | — (risk 0.0983) | 0.4385 | 1.00 | — |
| B1 raw_conf t=0.90 | 1.000 [0.993, 1.000] | 0.5774 | 1.32 | 0 |
| B2 naive_cal | 0.496 [0.451, 0.541] | 0.4329 | 0.99 | 6 |
| SPE ltt | 0.046 [0.029, 0.068] | 0.2107 | 0.48 | 144 |

Verdicts: H1 validity SUPPORTED (upper 0.068 <= 0.12). H2 naive invalid SUPPORTED (lower 0.451 > 0.10).
H3 utility NOT_PROVEN (0.48 < 0.85). **Overall NOT_PROVEN.**

Diagnosis (post hoc, not a verdict change): the frozen fixed-sequence starts at t=0.995 and stops at the first
non-rejection, so a noisy top bin ends testing early; 144/500 seeds abstained on everything. Fixing this needs a
new preregistered R1 (e.g., minimum-count start, or Bonferroni/graph LTT), not an edit to R0.

Exploratory: E1 n_cal=100: ltt violation 0.004 but coverage 0.035x oracle (473 abstain-all); naive 0.576.
E2 test shift z~N(0.6,1.5): ltt violation 0.128 [0.100, 0.160] (guarantee breaks without exchangeability, as expected);
naive 0.692; raw 1.0.
