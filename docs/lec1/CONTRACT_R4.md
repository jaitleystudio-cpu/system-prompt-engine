# LEC-1 R4 — Tight-range PPI betting (Bernoulli-Y with per-item PPI shift) + aGRAPA stakes (PREREGISTERED)

Status: frozen before any LEC-1 R4 code or outcome data exists. ₹0. No merge, no deploy, no PR.
Branch `grok/lec1-r4-ppi-bet-ltt`. Host: the Mac mini (Apple M2) was online at cycle start (worktree
`/Volumes/4TB-WD/spe-worktrees/spe-lec1-r4` created) but became unreachable during setup; this contract is committed from the
Grok box worktree `/workspace/spe-brain/lec1-r4`. The run host (Mac mini if reachable, else box) is recorded in the results.
Ollama is installed on the Mac but was not serving; no LLM is needed (synthetic CRC-1 DGP only).
Parent commit: beeadcd5 (LEC-1 R3 tip). CRC-1 is CLOSED; R4 changes no CRC-1 file, search order or endpoint.
New code only in `spe_runtime/research/lec1/r4.py`, tests in `tests/research/lec1/`, evidence in `evidence/lec1/r4/`.

## Why (diagnosis of R3, written before R4 code)
R3 (WSR on Z=Y−f mapped to [−1,1]) was REJECTED: 1000/1000 abstain. Three design errors are identified a priori:
1. **Range 2 instead of ~1.** Given s ≥ t ≥ 0.5, f(s)=1−s ∈ [0, 1−t], so the PPI-shifted label
   W = Y − f(s) + μ̂_f lies in [μ̂_f − (1−t), μ̂_f + 1]: range 2 − t (≈1.04 near the oracle t≈0.96), not 2.
2. **Kelly denominator used the worst-case variance μ0(1−μ0)≈0.25** of the [0,1]-mapped variable instead of an
   empirical variance (≈0.25·R(1−R)≈0.02), shrinking stakes ~10–20× → wealth never reached 1/δ.
3. **Betting order was ascending s**, which is correlated with Y. Capital-process validity needs the per-step
   conditional mean under H0, which sorting breaks (late items are safer than average). R4 bets in the iid acquisition order.
R4 is the R3 critic's recommended next step: "Bernoulli-Y betting with PPI-shifted null (range 1)". Written per item,
the shifted null θ_Y = α − μ̂_f + f(s_i) is exactly a bet on W_i = Y_i − f(s_i) + μ̂_f against H0: E[W] ≥ α. A
data-dependent null using mean_L(f) is NOT used (it would break the supermartingale).

## Honest prior expectation (recorded before running)
On this DGP f=1−s is weakly correlated with Y inside s ≥ t, so PPI variance reduction is expected to be small; an exact
binomial test (lf_ltt) is near-optimal for iid Bernoulli at fixed n, and betting pays a Ville log(1/δ) cost. The builder's
prior is that ppi_bet_ltt_500 will be VALID but will NOT beat lf_ltt_500 (H3 likely REJECTED or NOT_PROVEN). R2's 0.714×
is suspected to be partly bought by anti-conservativeness (viol 0.088 vs lf 0.058); R4 tests a valid alternative.

## DGP (unchanged from CRC-1 / LEC-1 R0–R3)
z ~ N(1.2, 1.5²); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8²)); wrong = 1 − correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999). α = 0.10, δ = 0.10.
|U| = 20,000 unlabeled scores per draw. Seeds: L_k = Random(30000+k), U_k = Random(40000+k), F_k = Random(50000+k).

## Frozen constants (a priori — NOT tuned on any R4 outcome)
- Predictor f(s) = clip(1 − s, 0, 1) (same as R2/R3). Floor: R1 label_free_floor, C_ANCHOR=0.55, SAFETY=1.15 (c_f=0.6325).
- N_MIN_LABELED = 2. Stake truncation C_TRUNC = 0.5 (Waudby-Smith & Ramdas default). Prior pseudo-observation:
  m0 = α/2 = 0.05, v0 = α(1−α) = 0.09 (one pseudo-observation).
- Per grid i (t = GRID[i]), labeled items L_i = {(s,y) in stage : s ≥ t} **in acquisition order**; U_i = U ∩ [t, 1].
  μ̂_f = mean f(U_i) (fallback: labeled f-mean if |U_i| = 0).
- ppi_bet: W_j = y_j − f(s_j) + μ̂_f; hi = μ̂_f + 1 (f ≥ 0). bern_bet: W_j = y_j; hi = 1.
- aGRAPA predictable stake (past only), for step t = 1..n:
  m̂ = (m0 + Σ_{j<t} W_j) / t ; σ̂² = (v0 + Σ_{j<t} (W_j − m̂)²) / t ; g = α − m̂ ;
  λ_t = clip( g / (σ̂² + g²), 0, C_TRUNC / (hi − α) ).
- Capital M_0 = 1, M_t = M_{t−1} · (1 + λ_t (α − W_t)). Multiplier ≥ 1 − C_TRUNC > 0.
- p_i = min(1, 1 / max_{t ≤ n} M_t) (anytime-valid via Ville's maximal inequality). |L_i| < N_MIN → p_i = 1.
- Fixed-sequence LTT strict → loose, stop at first p_i > δ, masked below floor (p=1); p-values are computed lazily in that
  same order (identical selection; only skips p-values the rule never reads).

### Validity claim (honest scope)
Under H0: E[W | U] ≥ α with W iid given U (acquisition order), λ_t ≥ 0 predictable, the capital is a nonnegative
supermartingale, so P(p_i ≤ δ | U) ≤ δ per grid point; fixed-sequence LTT then controls FWER ≤ δ.
For ppi_bet, E[W|U] = R(t) + (μ̂_f − μ_f): the U-estimation error (O_p(1/√|U_i|)) is not folded in. bern_bet has no such
caveat (exactly finite-sample valid). H1 is still an empirical CP95 test. No product claim.

## Arms (k = 0..999)
- rand_250/500/1000/2000 (R0), lf_ltt_250/500/1000 (R1, best VALID previous method), ppi_ltt_250/500/1000 (R2, imported,
  previous best coverage but H1 soft-fail).
- **ppi_bet_ltt_B (PRIMARY)**, B ∈ {250, 500, 1000}; 500 primary.
- bern_bet_ltt_B (secondary; isolates the PPI shift), B ∈ {250, 500, 1000}.
- Exploratory only: E2 ppi_bet_sorted_500 (R3's ascending-s order — diagnostic of design error 3);
  E3 ppi_bet_c075_500 (C_TRUNC = 0.75).
All label-using arms at the same B draw identical labels (fresh Random(50000+k), same floor).

## Hypotheses (B = 500, 1000 draws)
- H1 validity: ppi_bet_ltt_500 violation CP95 upper ≤ 0.10 → SUPPORTED; CP lower > 0.10 → REJECTED; else NOT_PROVEN.
- H2 utility (report only): mean coverage ≥ 0.85 × oracle.
- **H3 primary utility: beats the best valid previous method** — paired (ppi_bet_ltt_500 − lf_ltt_500) one-sided 95% LB > 0
  → SUPPORTED; UB < 0 → REJECTED; else NOT_PROVEN.
- H4 (report): non-inferior to lf_ltt_500, LB > −0.01 (REJECTED if UB < −0.01).
- H5 (report): PPI shift adds value, paired (ppi_bet_ltt_500 − bern_bet_ltt_500) LB > 0 (REJECTED if UB < 0).
- H6 (report): vs R2 ppi_ltt_500, non-inferiority LB > −0.02 (REJECTED if UB < −0.02).
- G abstain guard (answers R3 critic Q1): abstain_all(ppi_bet_ltt_500) ≤ 500/1000, else FAIL.

### Overall rule (one rule)
SUPPORTED iff H1 SUPPORTED AND H3 SUPPORTED AND G PASS. REJECTED if H1 REJECTED OR H3 REJECTED OR G FAIL. Else NOT_PROVEN.

## Literature anchors (cited, not tuned)
Waudby-Smith & Ramdas (2024, JRSS-B) betting CIs, aGRAPA and truncation c=1/2; Ville (1939) maximal inequality;
Angelopoulos et al. (2023) Prediction-Powered Inference; Angelopoulos, Bates et al. Learn-then-Test (fixed sequence).

## Tests and hygiene
Hand-built unit tests: constants; f clip; W shift uses U (μ̂_f); bounds hi; stake predictable (hand-rolled path match);
stake truncation ≤ C_TRUNC/(hi−α); p uses running max (≤ final-wealth p); p direction (safe small, bad large);
acquisition order not sorted; N_MIN gate; floor reuse; mask below floor; lazy LTT equals eager LTT; label accounting == B;
imports R1/R2 baselines; bern_bet uses raw Y.
Mutation gate (each must be killed): wrong f=s; p=wealth inverted; stake peeks current W; no truncation; ignore μ̂_f;
sort by s; wrong α; no floor mask; label count ≠ B; capital replaced by always-accept when mean below α.
summary.json has no timing fields; two runs must be byte-identical; sha256 recorded.
Order: this CONTRACT commit (sha256 in evidence/lec1/r4/PREREG_FREEZE.txt) → code+tests+gate → results. No verdict flips.
