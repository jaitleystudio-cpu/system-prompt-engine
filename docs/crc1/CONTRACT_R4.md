# CRC-1 R4 — Planner-margin oracle endpoint (PREREGISTERED, frozen before any R4 code or outcome data)

Parent: R3 @ 65db7893 (H1 a08 valid, H2 REFUTED 0.303× oracle(0.08), H4 KS gate SUPPORTED; overall NOT_PROVEN).
Idea from R3 critic Q1 / R2 planner track: certify at α=0.10 with R0 LTT (+ optional KS gate), judge coverage
against oracle(α − m) where margin m is FIXED A PRIORI by the R2 exact planner so the null at the compare-oracle
is feasible at n_cal=500.
Builder self-run on the Grok box (Mac mini offline this cycle). Synthetic only, no LLM, no Ollama. ₹0. No merge/deploy/PR.
R0–R3 code untouched except imports; new code only in spe_runtime/research/crc1/r4.py (+ tests/research/crc1/*r4*).
Verdict words: SUPPORTED / NOT_PROVEN / REFUTED. Simulation never upgrades a proof gap.

## Fixed setup (reused from R0–R3)
- DGP, 200-point grid, `core.sample`, population 400,000 draws seed Random(999) (base z_mu=1.2; shift z_mu=0.6),
  population truth via `r2.Pop`. Shift = calibrate on base, deploy on z_mu=0.6.
- alpha = 0.10, delta = 0.10.
- Primary: n_cal = 500, draws k = 0..999, calibration `core.sample(n_cal, Random(40000+k))` (base DGP).
- Exploratory: n_cal = 2000, draws k = 0..299, same seed rule.
- Deploy score sample for the gate: `core.sample(n_cal, Random(60000+k), z_mu=deploy_z_mu)`; labels discarded
  (only scores to the gate). deploy_z_mu = 1.2 (base) or 0.6 (shift).
- KS gate: identical to R3 — asymptotic Kolmogorov with Stephens correction, fire if p < 0.01; do not retune.

## Frozen margin m (computed ONCE from frozen base Pop seed Random(999) BEFORE any calibration draws)

Procedure (executed once for this contract; numbers below are the output):
1. Build Pop = r2.Pop(core.sample(400000, Random(999))).
2. For each candidate m ∈ {0.01, 0.02, 0.03, 0.04, 0.05}:
   - Let target = α − m = 0.10 − m.
   - Let o = oracle_idx(Pop.grid, target) = loosest grid t with population selective risk ≤ target.
   - Let r* = Pop risk at that t; cov* = Pop coverage at that t.
   - Let n* = r2.n_needed(r*, alpha=0.10).
   - Qualify iff n* is not None and n* ≤ 500.
3. Choose the LARGEST qualifying m. If none qualify, set m=0.05 and declare FEASIBILITY_FAIL.

Computed scan (a-priori, no calibration draws):

| m | target α−m | r* (oracle risk) | cov* (oracle coverage) | n_needed(r*, α=0.10) | qualify |
|---|---|---|---|---|---|
| 0.01 | 0.09 | 0.088415 | 0.397050 | 3026 | no |
| 0.02 | 0.08 | 0.079472 | 0.357515 | 964 | no |
| 0.03 | 0.07 | 0.067751 | 0.304165 | 379 | yes |
| 0.04 | 0.06 | 0.058745 | 0.255640 | 233 | yes |
| 0.05 | 0.05 | 0.043782 | 0.183753 | 116 | yes |

**Frozen choice: m = 0.05** (largest qualifier). FEASIBILITY_FAIL = no.
- α − m = 0.05
- oracle_idx(0.05) grid t = 0.995
- r* = 0.043782
- oracle_coverage(α − m) = **0.183753**  ← H2 denominator (frozen)
- n_needed(r*, α=0.10) = **116** ≤ 500
- Continuity oracle(0.10): risk 0.098301, coverage **0.438528** (descriptive x-oracle(0.10) only)

## Arms
1. `ltt_r0_a10` — R0 fixed-sequence LTT (0.995 → 0.50), binomial p-value at alpha=0.10 (`core.policy_ltt`). Primary selector.
2. `ltt_r0_a10_shiftgate` — arm 1 + R3 KS gate (p < 0.01, same Stephens-corrected asymptotic KS as R3; do not retune).
3. Descriptive only: `ltt_r0_a08` — R3 alpha=0.08 LTT (no new verdict weight).

## Oracle and violation
- oracle_idx(r) = loosest grid t whose population selective risk ≤ r (same as R3).
- Violation of a draw for an arm with target a: deploy-population selective risk at the chosen threshold > a
  (a = 0.10 for both a10 arms; a = 0.08 for descriptive a08). Abstain-all = risk 0, coverage 0, never a violation.
- H2 compare-oracle is specifically oracle(α − m) = oracle(0.05) with frozen coverage 0.183753 above.

## Hypotheses
- **H1 (validity):** base n_cal=500, `ltt_r0_a10` violation-rate Clopper–Pearson 95% (two-sided, `core.clopper_pearson`)
  upper ≤ 0.10 → SUPPORTED; CP lower > 0.10 → REFUTED; else NOT_PROVEN.
  (Reuse R0 expectation: should SUPPORT.)
- **H2 (planner-margin coverage, PRIMARY NEW ENDPOINT):** base n_cal=500,
  ratio = mean_coverage(`ltt_r0_a10`) / oracle_coverage(α − m)  [= / 0.183753].
  One-sided 95% bootstrap LB of the ratio (B = 2000 resamples of the 1000 draws, Random(31337), 5th percentile);
  UB = 95th percentile.
  SUPPORTED iff H1 SUPPORTED and ratio ≥ 0.85 and LB ≥ 0.85.
  REFUTED iff one-sided 95% UB < 0.85.
  Else NOT_PROVEN.
- **H3 (beats previous best):** previous best = R0’s reported ≈0.48× vs oracle(0.10). The primary selector is the same
  R0 LTT arm, so this round does not claim a new selector beat R0. Define:
  H3 SUPPORTED iff H2 SUPPORTED (honest planner-margin endpoint pass).
  Also report descriptively: mean_cov(ltt_r0_a10) / oracle(0.10) for continuity with R0/R3; do **not** claim coverage
  improved over the R0 selector.
- **H4 (shift gate product):** shift n_cal=500.
  SUPPORTED iff `ltt_r0_a10_shiftgate` violation CP95 upper ≤ 0.10 AND abstain-all rate (point estimate) ≥ 0.90.
  REFUTED if gate violation CP95 lower > 0.10.
  Else NOT_PROVEN.
- **Overall:** SUPPORTED iff H1, H2, H4 all SUPPORTED; REFUTED if H1 REFUTED; else NOT_PROVEN.

## Also reported (descriptive, no verdict weight)
- Gate false-alarm rate on base (fraction of draws where gate fired among draws where a10 was non-abstain) and
  paired coverage cost of the gate on base.
- a10 / oracle(0.10); a10 / oracle(α − m); descriptive a08 metrics.
- Exploratory n_cal=2000 base and shift (300 draws).
- Product recommendation: freeze R0 + KS with honest numbers yes/no (author judgment after results; not a hypothesis).

## A-priori note (written before any outcome)
m=0.05 is the largest planner-feasible margin at n_cal=500 on this DGP: oracle(0.05) has r*=0.043782 and needs only
116 labels under the exact binomial power planner, while m=0.01 and m=0.02 fail the ≤500 gate (3026 and 964).
Choosing the largest m makes the compare-oracle coverage smaller (0.184 vs 0.439 at α=0.10), so the ratio bar is
numerically easier than R0’s 0.85× oracle(0.10); that is an intentional consequence of the stated “largest feasible m”
rule, not a post-hoc tweak. H1 is expected SUPPORTED (same arm as R0). H2 is the question this round answers.
H4 is expected SUPPORTED by the same KS mechanism as R3 (score-marginal shift → near-total abstention). The KS gate
still cannot see concept/label shift with an unchanged score marginal (limitation carried from R3).

## Determinism & process
summary.json written with sort_keys, no timing fields; two independent runs must be byte-identical (sha256 recorded).
Order: this contract commit+push → code+tests+mutation gate commit → run → RESULTS_R4.md + evidence/crc1/r4/ commit → push.
Branch: grok/crc1-r4-planner-margin-endpoint. Worktree: /workspace/spe-brain/crc1-r4.
