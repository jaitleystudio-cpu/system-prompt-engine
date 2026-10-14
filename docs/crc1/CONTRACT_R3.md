# CRC-1 R3 — Feasible risk target + minimal shift gate (PREREGISTERED, frozen before any R3 code or outcome data)

Parent: R2 @ 4ac0ec42 (adjudication: no arm beats R0; planner says ~101,550 labels at the alpha=0.10 oracle).
Builder self-run on the Grok box (Mac mini offline this cycle). Synthetic only, no LLM, no Ollama. ₹0. No merge/deploy/PR.
R0/R1/R2 code untouched; new code only in spe_runtime/research/crc1/r3.py (+ tests/research/crc1/*r3*).
Verdict words: SUPPORTED / NOT_PROVEN / REFUTED. Simulation never upgrades a proof gap.

## Fixed setup (reused)
- DGP, 200-point grid, `core.sample`, population 400,000 draws seed Random(999) (base z_mu=1.2; shift z_mu=0.6),
  population truth via `r2.Pop`. Shift = calibrate on base, deploy on z_mu=0.6 (as R0–R2).
- alpha_feas = 0.08, alpha_prev = 0.10, delta = 0.10.
- Primary: n_cal = 500, draws k = 0..999, calibration data `core.sample(n_cal, Random(40000+k))` (base DGP).
- Exploratory: n_cal = 2000, draws k = 0..299, same seed rule.
- Deploy score sample for the gate: `core.sample(n_cal, Random(60000+k), z_mu=deploy_z_mu)`; labels discarded
  (only scores are passed to the gate; enforced by a test). deploy_z_mu = 1.2 (base condition) or 0.6 (shift condition).

## Arms
1. `ltt_r0_a10` — R0 fixed-sequence LTT (0.995 -> 0.50), binomial p-value at alpha=0.10 (`core.policy_ltt`).
2. `ltt_r0_a08` — identical search, binomial p-values at alpha_feas = 0.08 (primary coverage arm).
3. `ltt_r0_a08_shiftgate` — compute arm 2's threshold; if it is non-abstain, run a two-sample Kolmogorov–Smirnov test
   of calibration scores vs deploy scores; if p < 0.01, force abstain-all (no "verified"). Threshold 0.01 is declared
   here and will not be tuned. KS p-value: asymptotic Kolmogorov distribution with Stephens' small-sample correction,
   lambda = (sqrt(Ne) + 0.12 + 0.11/sqrt(Ne)) * D, Ne = n*m/(n+m), p = 2 * sum_{j>=1} (-1)^(j-1) exp(-2 j^2 lambda^2)
   (Numerical Recipes 14.3), clipped to [0,1]. Pure Python (scipy not installed).

## Oracle and violation
- oracle_idx(r) = loosest grid t whose population selective risk <= r (R0 `policy_oracle` generalised from the constant
  ALPHA to a parameter r); oracle_coverage(r) = population coverage there. Computed on the population of the condition
  being deployed into (base pop for base, shifted pop for shift). Reported at r in {0.06, 0.07, 0.08, 0.09, 0.10}.
- Violation of a draw for an arm with target a: deploy-population selective risk at the chosen threshold > a
  (a = 0.10 for ltt_r0_a10, 0.08 for both a08 arms). Abstain-all = risk 0, coverage 0, never a violation.

## Hypotheses
- H1 (validity, primary): base n_cal=500, `ltt_r0_a08` violation-rate Clopper–Pearson 95% (two-sided, `core.clopper_pearson`)
  upper <= 0.10 -> SUPPORTED; CP lower > 0.10 -> REFUTED; else NOT_PROVEN.
- H2 (feasible coverage): base n_cal=500, ratio = mean coverage(`ltt_r0_a08`) / oracle_coverage(0.08).
  One-sided 95% bootstrap LB of the ratio (B = 2000 resamples of the 1000 draws, Random(31337), 5th percentile).
  SUPPORTED iff H1 SUPPORTED and ratio >= 0.85 and LB >= 0.85. REFUTED iff the one-sided 95% bootstrap UB (95th pct) < 0.85.
  Else NOT_PROVEN.
- H3 (beats previous best, fair endpoint): report at base n_cal=500 (a) raw mean coverage of a08 and a10; (b) a08 /
  oracle(0.08); (c) a10 / oracle(0.10); (d) whether a08 >= 0.85 x oracle(0.08) while a10 < 0.85 x oracle(0.10);
  paired coverage difference a08 - a10 (mean, one-sided 95% normal LB/UB as R2).
  "Beats previous best" := H1 and H2 both SUPPORTED (even if raw coverage is below a10). Otherwise NO.
- H4 (shift gate): shift n_cal=500. Descriptive: `ltt_r0_a08` violation expected > delta.
  SUPPORTED iff `ltt_r0_a08_shiftgate` violation CP95 upper <= 0.10 AND abstain-all rate (point estimate) >= 0.90.
  REFUTED iff gate violation CP95 lower > 0.10. Else NOT_PROVEN.
- Overall: SUPPORTED iff H1, H2, H4 all SUPPORTED; REFUTED if H1 REFUTED; else NOT_PROVEN.

## Also reported (descriptive, no verdict weight)
- Gate false-alarm rate on base (fraction of draws where gate fired, of draws where a08 was non-abstain) and the coverage
  cost of the gate on base (paired gate - a08).
- Planner-feasible secondary endpoint (R2 Q4 reading "certify at 0.10, judge against a stricter risk target"):
  mean coverage(`ltt_r0_a10`) / oracle_coverage(0.08), with bootstrap LB. Descriptive only.
- `r2.n_needed(oracle risk at 0.08, alpha=0.08)` and at the 0.08 oracle under alpha=0.10, to state feasibility up front.
- Exploratory n_cal=2000 base and shift (300 draws), all arms.

## A-priori note (written before any outcome)
Moving the alpha AND the oracle to 0.08 keeps the R0 structure: the 0.08-oracle sits at population risk just below 0.08,
which is the boundary of the alpha=0.08 null, so the planner argument from R2 predicts H2 NOT_PROVEN at n_cal=500.
I preregister that prediction rather than redefine the endpoint after seeing data. The shift gate is expected to pass
H4 because a 0.6 shift in the latent mean moves the score marginal; it cannot detect label/concept shift with an unchanged
score marginal (stated limitation; not tested in R3).

## Determinism & process
summary.json written with sort_keys, no timing fields; two independent runs must be byte-identical (sha256 recorded).
Order: this contract commit+push -> code+tests+mutation gate commit -> run -> RESULTS_R3.md + evidence/crc1/r3/ commit -> push.
