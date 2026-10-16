# LEC-1 R5 results — cross-fitted isotonic focusing (REJECTED)

Contract: docs/lec1/CONTRACT_R5.md (sha256 a9b05464…9643, commit d13063c1, pushed before code). Code 36b33f1e.
Run host: **Prawins-Mac-mini.local** (Mac mini M2), worktree `/Volumes/4TB-WD/spe-worktrees/spe-lec1-r5`.
Synthetic CRC-1 DGP, no LLM, ₹0, no merge/deploy/PR. Two runs byte-identical: summary sha256 a9d288e4…7548.
Tests 13/13; mutation gate 10/10 killed. A 5-draw throughput smoke preceded the code commit (disclosed in
evidence/lec1/r5/SMOKE_DISCLOSURE.txt); nothing in the contract changed.

Oracle t=0.9602, coverage 0.4385, risk 0.0983.

| arm (B=500 unless noted) | × oracle | violation | CP95 | abstain-all |
|---|---|---|---|---|
| **cif_ltt_500 (primary)** | **0.423** | 0.003 | [0.001, 0.009] | 1 |
| lf_ltt_500 (R1, best valid) | 0.662 | 0.063 | [0.049, 0.080] | 116 |
| lf_ltt_400 (matches B_CERT) | 0.598 | 0.056 | [0.043, 0.072] | 183 |
| rand_500 / rand_1000 | 0.476 / 0.692 | 0.043 / 0.050 | | 316 / 79 |
| cif_ltt_250 / _1000 | 0.406 / 0.419 | 0.003 / 0.000 | | 40 / 0 |
| lf_ltt_250 / _1000 | 0.434 / 0.810 | 0.051 / 0.062 | | 365 / 7 |

Paired (1000 draws): cif_500 − lf_500 = −0.105 [UB −0.098], 124 W / 806 L.
cif_500 − lf_400 = −0.077 [UB −0.069]. Learned floor raised vs f₀ on 989/1000 draws (B=500).

## Verdicts
H1 validity SUPPORTED · H2 NOT_PROVEN · **H3 beats lf_ltt_500 REJECTED** · H4 non-inferior lf REJECTED ·
G abstain guard PASS (1 ≤ 500) · **Overall REJECTED**.

## Reading
- CIF is highly VALID (viol 0.003) but ~0.24× oracle below lf_ltt on the same seed protocol: the learned floor
  raises almost always (989/1000), shrinking coverage while buying near-zero violations.
- vs lf_ltt_400 (same cert budget): still loses (−0.077), so the gap is not only “100 labels spent on fit”.
- Matches the preregistered prior: on this score-monotone synthetic DGP, isotonic ĝ largely recovers the s-ordering
  and does not beat label-free focusing; the “learned predictor” path did not unlock utility here.
- Best VALID method remains R1 lf_ltt (~0.66×). LEC-1 should move off this synthetic DGP (real data or a new topic),
  not another PPI/betting/isotonic floor variant on the same scores.
