# LEC-1 R0 — Label-Efficient Calibration for risk-controlled abstention (PREREGISTERED)

Status: frozen before any LEC-1 code or outcome data exists. Builder self-run (Grok box). ₹0. No merge, no deploy, no PR.
Environment: the Mac mini (Ollama) is OFFLINE this cycle, so no local LLM; synthetic CRC-1 DGP only.
Parent commit: 900fe435 (CRC-1 R4 tip). CRC-1 is CLOSED; LEC-1 does not change any CRC-1 file, search order or endpoint.
New code lives only in `spe_runtime/research/lec1/`, tests in `tests/research/lec1/`, evidence in `evidence/lec1/r0/`.

## Why
CRC-1 R0/R1 on this DGP: valid LTT abstention at alpha=0.10 reaches only ~0.473-0.48x oracle coverage at n_cal=500
(i.i.d. random labels), but ~0.84x at n_cal=2000. The label budget is the bottleneck. In selective risk
R(t) = P(wrong | s >= t), a labeled item with s < t carries no information about R(t). i.i.d. random calibration
spends ~56% of labels below the oracle threshold (oracle coverage 0.4385 at t=0.960). LEC-1 asks whether spending the
same label budget only where it can matter raises certified coverage while keeping risk control.

## Question
At a frozen label budget B = 500 (= CRC-1 R0), does pilot-focused labeling reach mean coverage >= 0.85 x oracle(alpha=0.10)
with violation rate controlled at delta, and does it beat i.i.d. random calibration at the same B?

## DGP (unchanged from CRC-1)
z ~ N(1.2, 1.5^2); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8^2)); wrong = 1 - correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999) (same as CRC-1).
alpha = 0.10, delta = 0.10. Scores are free; only labels (wrong/correct) count against B.

## Arms (draw index k = 0..999; 1000 draws primary)
Shared labeled stream L_k = core.sample(., Random(30000 + k)) (i.i.d. random labels, in order).
Unlabeled score pool U_k = scores of 20,000 items from Random(40000 + k) (labels never read).
Focused stream F_k = items from Random(50000 + k), screened by score only (rejection: label queried only if s >= floor).

- oracle (reference): smallest grid t with population R(t) <= alpha.
- rand_B (baseline A, = CRC-1 R0 style): first B items of L_k; R0 fixed-sequence LTT (core.policy_ltt: from t=0.995
  toward looser t, accept while p(t) <= delta, stop at first failure, choose loosest accepted; abstain-all if none).
- pf_ltt_B (PRIMARY, "pilot-focused LTT"; two-phase / double sampling, Neyman 1938; score-only active labeling as in
  Zrnic & Candès 2024 "Active Statistical Inference", arXiv:2403.03208, specialised to a 0/1 sampling rule so no
  inverse-probability weights are needed; LTT: Angelopoulos et al. arXiv:2110.01052):
  1. Pilot: first B1 = round(0.2 B) items of L_k (B1 = 100 at B = 500; shares labels with rand_B for pairing).
  2. t_p = naive threshold on the pilot: smallest grid t with pilot n_t >= 20 and pilot risk e_t/n_t <= alpha
     (None if no such t).
  3. Floor coverage c_f = min(1, 1.25 * c_U(t_p)), where c_U(t) = fraction of U_k with s >= t.
     floor index = the largest grid index i with c_U(GRID[i]) >= c_f. If t_p is None: floor index = 0 (no focusing).
  4. Stage 2: B2 = B - B1 labels: walk F_k, query the label only for items with s >= GRID[floor], until B2 labels.
  5. Certify with core.policy_ltt on the stage-2 counts with every grid index below floor masked to (0, 0)
     (p = 1, so the fixed sequence stops at the floor). Pilot labels are NEVER used in the certification test.
  Validity argument: given (pilot, U_k), the floor is fixed and stage-2 items are i.i.d. from P(. | s >= floor). For any
  t >= floor, stage-2 items with s >= t are i.i.d. from P(. | s >= t), so given n_t, e_t ~ Bin(n_t, R(t)) and the
  binomial p-value is super-uniform under H0: R(t) > alpha. The fixed sequence then controls FWER <= delta.
- rand_2000 (baseline C, descriptive ceiling): first 2000 items of L_k, R0 LTT.

Constants frozen a priori (no LEC-1 outcome was computed before this commit): pilot fraction 0.2, pilot n_t >= 20,
safety factor 1.25, |U| = 20,000.

## Endpoints
Violation = population R(t_chosen) > alpha (abstain-all = no violation, coverage 0). Coverage = population C(t_chosen).
x oracle = mean coverage / oracle coverage. Paired differences use the same k (pf_ltt_B pilot = first B1 items of rand_B).
Also reported: abstain-all count, floor coverage distribution, fallback count (t_p None), unlabeled items screened.

## Hypotheses (primary B = 500, 1000 draws)
- H1 validity: pf_ltt_500 violation rate Clopper–Pearson 95% upper <= delta = 0.10. REJECTED if CP lower > 0.10; else NOT_PROVEN.
- H2 utility: pf_ltt_500 mean coverage >= 0.85 x oracle coverage. Else NOT_PROVEN.
- H3 beats previous best at the same budget: paired mean (pf_ltt_500 - rand_500) coverage has one-sided 95% lower bound
  > 0 (normal approx, mean - 1.645 sd/sqrt(n)). REJECTED if one-sided upper bound < 0. Else NOT_PROVEN.
  (Previous best on this DGP family: CRC-1 R0/R1 search 0.473-0.48x oracle at n_cal = 500.)
- H4 label efficiency (secondary, not in Overall): pf_ltt_500 non-inferior to rand_1000 (first 1000 of L_k): paired mean
  (pf_ltt_500 - rand_1000) one-sided 95% LB > -0.01. REJECTED if one-sided UB < -0.01. Else NOT_PROVEN.
Overall: SUPPORTED iff H1, H2, H3 all SUPPORTED; REJECTED if H1 or H3 REJECTED; else NOT_PROVEN.

## Exploratory (not used for any verdict)
- E1 budgets B in {250, 1000}: pf_ltt_B vs rand_B (B1 = 50 / 200).
- E2 rand_2000 ceiling (1000 draws), compared descriptively with pf_ltt_500 and pf_ltt_1000.
- E3 hindsight fixed floor (flagged: tuned with CRC-1 knowledge that oracle coverage ~0.44, so NOT a fair method):
  no pilot, all B = 500 labels focused above the grid t whose c_U is closest to >= 0.60. Shows the ceiling of focusing.

## Tests and hygiene
- Unit tests with hand-built inputs for: floor rule, masking below floor, pilot exclusion from certification,
  focused sampler rejection, label accounting (exactly B labels), p-value direction, budget split.
- Mutation gate: planted mutants (no masking below floor, pilot reused in test counts, sampler accepts s < floor,
  safety factor dropped, upper-tail p-value, wrong alpha, floor picks smallest index, wrong pilot fraction)
  must each make a test fail.
- summary.json has no timing fields and must be byte-identical across two runs; sha256 recorded.
- Order: this CONTRACT commit (sha256 recorded in evidence/lec1/r0/PREREG_FREEZE.txt) -> code + tests + gate commit
  -> results commit. Never flip a verdict without a new preregistered round.
