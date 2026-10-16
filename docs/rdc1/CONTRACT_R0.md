# RDC-1 R0 — Real-Data Calibration transfer of lf_ltt (PREREGISTERED)

Status: frozen before any RDC-1 R0 scored experiment code or outcome data exists. Builder self-run (Mac mini). ₹0. No merge, no deploy, no PR to main.
Parent commit: 73f1612b (LEC-1 R5 tip on `grok/lec1-r5-crossfit-isotonic`). CRC-1 CLOSED (untouched). LEC-1 PPI / learned-floor / CIF sub-lines EXHAUSTED on the synthetic CRC-1 DGP — this round does **not** reopen them.
New code lives only in `spe_runtime/research/rdc1/`, tests in `tests/research/rdc1/`, evidence in `evidence/rdc1/r0/`.
No LLM / Ollama required (sklearn + numpy only).

## Why
LEC-1 R1 `lf_ltt` is the best VALID method on the synthetic CRC-1 DGP (~0.64–0.66× oracle at B=500, violation ~0.058). Standing directive (2026-10-16): next cycles must pick a **new SPE brain topic or real data**, not another focusing/floor/PPI/betting variant on that synthetic DGP. RDC-1 R0 transfers the frozen LEC-1 R1 label-free quantile floor + fixed-sequence binomial LTT kernel onto a real, free, local classification score stream and measures whether validity and ×oracle still hold.

## Question
On one preregistered real sklearn score stream, does `lf_ltt` (LEC-1 R1 constants) achieve (H1) validity at α=δ=0.10, (H2) mean coverage ≥ 0.85 × real-data oracle, and (H3) beat random accept at the same label budget B (paired)? Optionally (H4) beat a naive fixed threshold (the label-free floor used as a hard cutoff with no LTT).

## Dataset (frozen)
- Source: `sklearn.datasets.load_digits` (bundled, offline, ₹0).
- n = 1797, d = 64, classes = 10.
- Outer split, `numpy.RandomState(42)` shuffle of all indices, then contiguous slices (no stratification — frozen):
  - **train_fit** = 100 (fit score model only).
  - **test** = 500 (fixed holdout = population for risk/coverage/oracle; never used for floor, labels, or fitting).
  - **rest** = 1197, reshuffled each draw k into:
    - **U** = 300 unlabeled scores for the label-free floor (labels never read by the method).
    - **L** = 897 calibration label pool (queried only when s ≥ floor for lf_ltt; first B for rand).
- Split sizes: train 100 / U 300 / L 897 / test 500. Seed for outer shuffle: 42. Per-draw rest shuffle: `RandomState(40000 + k)`.

## Score model (frozen)
- `sklearn.linear_model.LogisticRegression(max_iter=2000)` fit on `train_fit` only (once; not refit per draw).
- Score s = max predicted class probability (`predict_proba(...).max(axis=1)`).
- Predicted class = argmax; **wrong** = 1 if argmax ≠ y else 0.
- No hyperparameter search. sklearn from a local ₹0 venv is allowed.

## Grid / risk / LTT (reused from LEC-1 / CRC-1 core — not reinvented)
- Threshold grid: same 200-point GRID as `spe_runtime.research.crc1.core` (equally spaced t in [0.50, 0.995]; index 0 = loosest).
- α = 0.10, δ = 0.10.
- Fixed-sequence binomial LTT: same as LEC-1 R0/R1 (`lec1.r0.ltt` / `core.policy_ltt`).
- Label-free floor constants (LEC-1 R1, frozen a priori): **C_ANCHOR = 0.55**, **SAFETY = 1.15** → c_f = 0.6325.
- Floor = largest grid index with unlabeled coverage ≥ c_f on U; else 0.
- Mask grid below floor (p-value forced to reject / counts zeroed) exactly as LEC-1 R1.

## Arms (draw index k = 0 .. n_draws−1)
- **oracle** (reference): smallest grid index i with test-set R(t_i) ≤ α and n≥1 (same `policy_oracle` as CRC-1/LEC). Coverage/risk on the fixed test set.
- **rand_B**: take the first B items of L (order after per-draw shuffle); certify with LTT on those B labels (no floor, no mask).
- **lf_ltt_B (PRIMARY)**:
  1. Floor from U scores alone (C_ANCHOR/SAFETY).
  2. Query labels from L in shuffle order, accepting only items with s ≥ GRID[floor], until B labels or L exhausted.
  3. If fewer than B labels above floor: certify with the available labels (record `labels` < B); still mask below floor.
  4. Certify with fixed-sequence LTT + mask-below-floor.
- **naive_floor_B (H4 baseline)**: same floor from U; accept threshold = GRID[floor] with **no** LTT (ignore calibration labels for the decision; B is recorded only as the matched budget label for pairing fairness — naive does not use them). Deterministic given U.
- Synthetic CRC-1 / LEC-1 R1 lf_ltt_500 numbers (~0.64× oracle, viol ~0.058) are **reference only** — different DGP; not a paired claim.

Primary B = 500. Also report B = 200 (same hypotheses applied only to B=500 for Overall).

## Draws
- n_draws = 1000 (cheap on Mac mini; sklearn scores precomputed once).
- Two-run determinism: summary.json must be byte-identical across two full runs; sha256 recorded.

## Endpoints
- Violation = test-set R(t_chosen) > α (abstain-all = no violation, coverage 0).
- Coverage = test-set C(t_chosen).
- × oracle = mean coverage / oracle coverage on the same fixed test set.
- Paired differences use the same draw k.

## Hypotheses (primary B = 500, 1000 draws)
- **H1 validity**: lf_ltt_500 violation rate Clopper–Pearson 95% **upper** ≤ δ = 0.10.
  REJECTED if CP lower > 0.10; NOT_PROVEN if upper > 0.10; SUPPORTED if upper ≤ 0.10.
  (Matches LEC-1 R1 convention.)
- **H2 utility**: lf_ltt_500 mean coverage ≥ **0.85 ×** oracle coverage. Else NOT_PROVEN.
  Bar kept at 0.85 for honest comparison to LEC-1 (not lowered post-hoc). Real-data difficulty may leave H2 NOT_PROVEN even if transfer is useful.
- **H3 beats rand at same B**: paired mean (lf_ltt_500 − rand_500) coverage has one-sided 95% LB > 0 (normal approx, mean − 1.645 sd/√n).
  REJECTED if one-sided UB < 0; else NOT_PROVEN if LB ≤ 0 < UB; SUPPORTED if LB > 0.
- **H4 (optional, not required for Overall)**: paired mean (lf_ltt_500 − naive_floor) coverage one-sided 95% LB > 0.
  REJECTED if UB < 0; else NOT_PROVEN / SUPPORTED analogously.
  Also report descriptive ×oracle and violation for naive_floor.

**Overall**: SUPPORTED iff H1, H2, H3 all SUPPORTED; REJECTED if H1 or H3 REJECTED; else NOT_PROVEN.
H4 does not enter Overall.

## Pre-code smoke (disclosed; does not change this contract)
Before writing scored harness code, a feasibility probe confirmed: with the frozen split/model, test error ≈ 0.116 (> α), oracle exists near t=0.50, and L typically has >500 items above the label-free floor. No arm outcomes, paired tests, or verdict numbers from that probe are used to tune constants or hypotheses.

## Tests and hygiene
- Unit tests (hand-built): floor monotonicity / largest-index rule; mask-below-floor; α=0.10 in p-values; determinism of floor given U; focused sampler never accepts s < floor; label accounting.
- Mutation gate: planted mutants (wrong C_ANCHOR, SAFETY dropped, no mask, sampler accepts below floor, wrong α, floor smallest-index, upper-tail p) each must fail a test.
- Order: this CONTRACT commit (sha256 in `evidence/rdc1/r0/PREREG_FREEZE.txt`) → code + tests + gate commit → results commit.
- Never flip a verdict without a new preregistered round. No merge/deploy/PR to main. ₹0.

## Product claim language (frozen)
RDC-1 R0 **cannot** “beat” LEC-1 R1 on the same DGP (different data). Success language if H1+H2+H3 SUPPORTED: “establishes first real-data VALID lf_ltt baseline.” If H1 SUPPORTED but H2/H3 fail: report transfer validity without claiming product superiority over the synthetic best.
