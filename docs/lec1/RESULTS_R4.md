# LEC-1 R4 results — tight-range PPI betting (REJECTED)

Contract: docs/lec1/CONTRACT_R4.md (sha256 da82854a…211e, commit 2c4c5776, pushed before code). Code 9754a184.
Run host: **Grok box** (the Mac mini was online at cycle start, then became unreachable/disconnected before the run).
Synthetic CRC-1 DGP, no LLM, ₹0, no merge/deploy/PR. Two runs byte-identical: summary sha256 f70df630…1bca.
Tests 13/13; mutation gate 11/11 killed. A 20-draw throughput smoke run preceded the code commit (disclosed in
evidence/lec1/r4/SMOKE_DISCLOSURE.txt); nothing in the contract changed.

Oracle t=0.9602, coverage 0.4385, risk 0.0983.

| arm (B=500 unless noted) | × oracle | violation | CP95 | abstain-all |
|---|---|---|---|---|
| **ppi_bet_ltt_500 (primary)** | **0.491** | 0.032 | [0.022, 0.045] | 260 |
| bern_bet_ltt_500 | 0.490 | 0.033 | [0.023, 0.046] | 261 |
| lf_ltt_500 (R1, best valid) | 0.662 | 0.063 | [0.049, 0.080] | 116 |
| ppi_ltt_500 (R2, asymptotic) | 0.744 | 0.095 | [0.078, 0.115] | 48 |
| rand_500 / rand_1000 | 0.476 / 0.692 | 0.043 / 0.050 | | 316 / 79 |
| ppi_bet_ltt_250 / _1000 | 0.227 / 0.671 | 0.016 / 0.042 | | 641 / 59 |
| E2 ppi_bet_sorted_500 | 0.349 | 0.007 | | 418 |
| E3 ppi_bet_c075_500 | 0.447 | 0.030 | | 303 |

Paired (1000 draws): ppi_bet_500 − lf_500 = −0.075 [UB −0.069], 106 W / 664 L. ppi_bet − bern_bet = +0.0005
[LB −0.0001]. ppi_bet − ppi_ltt = −0.111. ppi_bet − rand_500 = +0.006 (n.s.). ppi_ltt − lf = +0.036 (603 W / 0 L).

## Verdicts
H1 validity SUPPORTED · H2 NOT_PROVEN · **H3 beats lf_ltt_500 REJECTED** · H4 non-inferior lf REJECTED ·
H5 PPI shift adds value NOT_PROVEN (≈0) · H6 vs ppi_ltt REJECTED · G abstain guard PASS (260 ≤ 500) · **Overall REJECTED**.

## Reading
- R4 fixes R3's total abstention (0.000× → 0.491×) while staying valid, so the three diagnosed R3 errors were real.
- But valid betting is still ~0.17× oracle below the exact binomial lf_ltt on the same labels; the prior expectation held.
- The PPI shift contributes nothing measurable (+0.0005): f=1−s carries ~no extra information about Y inside s ≥ t on this DGP.
- R2's coverage lead over lf_ltt (+0.036, never losing a draw) coincides with its H1 miss (0.095, CP upper 0.115): its edge is
  most plausibly anti-conservativeness, not information. Best VALID method remains R1 lf_ltt.
- Note: lf_ltt_500/ppi_ltt_500 numbers differ from R1/R2 (0.642×/0.714×) because R4 gives each B a fresh Random(50000+k)
  (per contract) whereas R1–R3 consumed one stream across B=250→500→1000.
Recommendation: close the PPI sub-line of LEC-1 on this DGP; next LEC work needs a genuinely informative predictor or real data.
