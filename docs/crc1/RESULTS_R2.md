# CRC-1 R2 — Adjudication results

Contract: docs/crc1/CONTRACT_R2.md (commit 0086829, sha256 995de086…386e), pushed before code 1281186.
Synthetic DGP only, Grok box, no LLM, ₹0. summary.json byte-identical across two runs (sha256 a88d311a…08ba).
alpha = delta = 0.10.

## Verdicts
| item | verdict | basis |
|---|---|---|
| 1 score-dependent start valid? | NOT_PROVEN | proof closes only for a special case (below); frozen 56-DGP adversarial family: worst exact violation 0.0678 (MC 20k: 0.0702 [0.0666, 0.0738]) < delta, so no counterexample |
| 2 faithful SGR | SUPPORTED | hand-computed traces pass; violation 0.002 [0.000, 0.007] |
| 3 adaptive LTT (e-process) | SUPPORTED (with declared deviations) | violation 0.020 [0.012, 0.031] |
| 4 nested test vectors | SUPPORTED, caveat | all R2 vectors built from observations; R1's _ltt_vec and _sgr_vec are NOT nested; mutants 6/6 only after one revision (first gate 4/6) |
| 5 labels-needed planner | SUPPORTED | exact n gives simulated power 0.81–0.91 at all 5 points; refuses at p >= alpha and at p=0.098 with budget 500 |
| 6 any arm beats R0 at n_cal=500? | NO | every arm valid but all lose coverage to R0 (paired one-sided UB < 0) |

## Item 1 proof sketch (where it closes and where it does not)
- R0 (fixed start at 0.995) is valid: given n_t, e_t ~ Bin(n_t, R(t)) exactly, so p(t) is a valid p-value; a fixed-sequence
  false rejection requires rejecting the first null in the fixed order, probability <= delta.
- Continuous scores, start at a sample order statistic: conditional on the start value s*, the items above s* are iid from
  F restricted to (s*, inf), so e(s*) ~ Bin(k, R(s*)) exactly and the FIRST test is valid. Gap: later grid tests below s*
  use counts mixing a fixed k with a random number of items from below s*, so their conditional law is not Bin(n_t, R(t)).
- Grid version (what R1 runs): the start J is a function of the count vector N. Given N, e_t is a sum of independent
  Bin(m_j, r_j) over bins, whose mean need not equal n_t R(t). The p-value is valid for the conditional composition risk,
  not for population R(t). With risk decreasing in score, conditioning on few top items shifts the suffix toward riskier
  items (heuristically conservative); with a risky top block it is anti-conservative. The search measured how much:
  at most 0.068 here, i.e. inflation exists but did not exceed delta. No general bound proved.

## Item 6 table (violation rate [CP95], coverage x oracle, abstain-all draws)
n_cal=500: 1000 draws; n_cal=2000: 300 draws. Shift = calibrate on base, deploy on z_mu=0.6.
| arm | base 500 | base 2000 | shift 500 | shift 2000 |
|---|---|---|---|---|
| ltt_r0 | 0.043 [.031,.057] 0.48x, 316 | 0.030 [.014,.056] 0.82x, 1 | 0.123 [.103,.145] FAIL | 0.310 [.258,.366] FAIL |
| ltt_mc (R1) | 0.047 [.035,.062] 0.35x, 581 | 0.030 [.014,.056] 0.74x, 39 | 0.136 FAIL | 0.310 FAIL |
| sgr_faithful | 0.002 [.000,.007] 0.10x, 804 | 0.000 [.000,.012] 0.37x, 140 | 0.008 ok | 0.037 ok |
| sgr_best (dev.) | 0.002 [.000,.007] 0.19x, 631 | 0.003 [.000,.018] 0.69x, 4 | 0.013 ok | 0.063 ok (UB .097) |
| altt | 0.020 [.012,.031] 0.24x, 623 | 0.023 [.009,.047] 0.68x, 9 | 0.042 ok | 0.110 [.077,.151] FAIL |
| pilot_split | 0.001 [.000,.006] 0.04x, 944 | 0.000 [.000,.012] 0.32x, 147 | 0.004 ok | 0.013 ok |
Paired coverage minus ltt_r0 at base 500: ltt_mc -0.054, sgr_faithful -0.165, sgr_best -0.126, altt -0.105, pilot -0.193.

## Planner (item 5)
| p | exact n | sim power | normal n | exact power at normal n |
|---|---|---|---|---|
| 0.02 | 52 | 0.910 | 40 | 0.810 |
| 0.05 | 152 | 0.858 | 130 | 0.796 |
| 0.07 | 446 | 0.835 | 399 | 0.763 |
| 0.08 | 1017 | 0.825 | 939 | 0.781 |
| 0.09 | 4070 | 0.814 | 3911 | 0.792 |
At the oracle threshold (risk 0.098) the planner needs ~101,550 selected labels: "0.85x oracle at n_cal=500" was infeasible by construction.
Sawtooth guard (pass for n..n+20) makes the exact n conservative (e.g. 52 at p=0.02 has power 0.91).

## Honest caveats
- Faithful SGR outputs the LAST binary-search iterate; if that one fails, SPE abstains (shown in a hand test). That is why
  it is weaker than R1's grid SGR (0.21x). sgr_best is my deviation.
- aLTT deviations: per-item rounds, non-adaptive acquisition, no early stop, my 0.5 clip; supplement not read.
- Mutation gate revised after seeing results: one equivalent mutant replaced, one pilot test added.
- Synthetic DGP only; no real model data. NOT_RUN: real-LLM replay, Bro replay, any shift detector.
