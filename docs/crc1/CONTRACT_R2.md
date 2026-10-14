# CRC-1 R2 — Adjudication (PREREGISTERED, frozen before any R2 code or outcome data)

Parent: R1 @ c98d65d2 (NOT_PROVEN). Builder self-run on the Grok box (Mac mini offline). No merge/deploy/PR. ₹0.
Synthetic only; no LLM. R0/R1 code untouched; R2 lives in spe_runtime/research/crc1/r2.py.
alpha = delta = 0.10 throughout. Base DGP, grid, population (400k, seed 999) and shift (z_mu=0.6, calibration
from base) exactly as R1. Verdict words: SUPPORTED / NOT_PROVEN / REFUTED. Simulation never upgrades a proof gap.

## Item 1 — validity of the score-dependent start (R1 ltt_mc, N_MIN = 0.3 n_cal)
Deliverable: written proof sketch AND a frozen counterexample search.
Search family (point masses; grid unchanged): A at s=0.999 (above every grid t) risk rA, mass piA;
B at s=0.90 risk rB, mass piB; C at s=0.55 risk 0.5, rest of mass. piB set so that population R(t) for
0.55 < t <= 0.90 equals alpha + 0.002 (a null). n_cal = 500, N_MIN = 150.
Grid: piA in {0.24,0.26,0.28,0.30,0.32}, rA in {0.12,0.15,0.20,0.25}, rB in {0.0,0.02,0.05}; skip if piA+piB > 0.95.
Violation probability computed EXACTLY (multinomial x binomial enumeration). Control: R0 fixed sequence on the same DGPs.
- REFUTED if any DGP has exact ltt_mc violation probability > delta + 0.005, confirmed by 20,000-draw Monte Carlo with
  Clopper-Pearson 95% lower bound > delta.
- SUPPORTED only if the proof sketch closes for the general grid case (no simulation can give SUPPORTED).
- Otherwise NOT_PROVEN.

## Item 2 — faithful SGR (Geifman & El-Yaniv 2017, arXiv:1705.08500, Algorithm 1)
Thresholds are calibration scores (not the grid); z_min=1, z_max=m; k=ceil(log2 m) iterations;
z=ceil((z_min+z_max)/2); theta = z-th smallest score; r_i = empirical selective risk of {s >= theta};
b_i = B*(r_i, delta/k, m_theta) = sup{b : P(Bin(m_theta,b) <= m_theta r_i) >= delta/k};
if b_i < r* then z_max = z else z_min = z. Output (theta_k, b_k) after k iterations.
Policy sgr_faithful: use theta_k if b_k < alpha (= r*), else abstain-all (SPE use of the risk bound; noted).
Secondary sgr_best: loosest theta_i among the k tested with b_i < alpha (still valid by the same union bound; marked deviation).
SUPPORTED if hand-computed tests pass and empirical violation CP95 upper <= delta at n_cal=500 base.

## Item 3 — adaptive LTT (Zecchin, Park, Simeone, ICML 2025, PMLR 267:74018-74036, arXiv:2409.15844)
Implemented: e-process eq. (12) E_i^t = prod (1 + mu_i^t (alpha - L)), mu in (0, 1/(1-alpha)); anytime p-value eq. (13)
P = 1/max_tau E; FWER selection by fixed sequence (strict -> loose) on those p-values; betting = aGRAPA
(Waudby-Smith & Ramdas 2024): mu = clip((alpha - m)/(v + (alpha - m)^2), 0, 0.5/(1-alpha)) with
m = (1/2 + sum L)/(t+1), v = (1/4 + sum (L-m)^2)/(t+1) from past observations only.
Deviations (declared): (a) one round = one labelled calibration item, the hypothesis for grid t is updated only
when s >= t (the observations for H_t are then iid Bernoulli(R(t))); (b) acquisition is non-adaptive over
hypotheses (all eligible thresholds updated) because a label informs every t <= s at no extra cost;
(c) no early stop (d = all); (d) the 0.5 clip constant is mine. Supplementary material not read.
SUPPORTED if empirical violation CP95 upper <= delta at n_cal=500 base.

## Item 4 — nested test vectors
All count vectors in R2 tests are generated from explicit (s, wrong) observation lists via core.grid_counts and
pass a nesting checker (n_t and e_t non-increasing in t, 0 <= e_t <= n_t, increments e <= increments n).
R1's hand vectors are run through the checker and reported. SUPPORTED if every R2 vector is nested and a
planted-mutant gate kills >= 6/6 mutants.

## Item 5 — labels-needed planner
Given p (pilot risk at a threshold), alpha, delta, power target 0.8: exact n_sel = smallest n such that
P(Bin(n,p) <= k*(n)) >= 0.8 AND the same holds for n+1..n+20 (sawtooth guard), k*(n) = max k with
P(Bin(n,alpha) <= k) <= delta. Normal approx n reported alongside. Refuse (None) if p >= alpha or n_sel > budget.
Validation grid: p in {0.02,0.05,0.07,0.08,0.09}; 20,000 simulated tests at exact n_sel each.
SUPPORTED if simulated power >= 0.78 for every grid point and refusal fires for p >= alpha.

## Item 6 — comparison (descriptive, plus one primary question)
Arms: ltt_r0, ltt_mc, sgr_faithful, sgr_best, altt, pilot_split.
pilot_split: first 30% of calibration items = pilot; candidate t = loosest grid t with smoothed pilot risk
(e+1)/(n+2) < alpha and planner n_sel(pilot risk) <= expected test-selected count (n_test x pilot coverage);
none -> abstain (planner refusal). Then one binomial test at that t on the remaining 70% at level delta.
Conditions: n_cal 500 (1000 seeds, Random(30000+k)) and 2000 (300 seeds), each on base and shift.
Primary: an arm "beats R0" at n_cal=500 base if valid (CP95 upper <= delta) and paired coverage minus ltt_r0 has
one-sided 95% lower bound > 0. Under shift, every arm is expected to break; reported, not judged.
Determinism: summary.json byte-identical across two runs.
