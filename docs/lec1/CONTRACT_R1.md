# LEC-1 R1 — Label-free quantile floor LTT (lf_ltt) (PREREGISTERED)

Status: frozen before any LEC-1 R1 code or outcome data exists. Builder self-run (Grok box). ₹0. No merge, no deploy, no PR.
Environment: the Mac mini (Ollama) is OFFLINE this cycle, so no local LLM; synthetic CRC-1 DGP only.
Parent commit: d15ff410 (LEC-1 R0 tip). CRC-1 is CLOSED; LEC-1 R1 does not change any CRC-1 file, search order or endpoint.
New code lives only in `spe_runtime/research/lec1/` (extends R0 modules), tests in `tests/research/lec1/`, evidence in `evidence/lec1/r1/`.

## Why
LEC-1 R0 pf_ltt_500 reached 0.580× oracle (valid, beats rand_500) but H2 failed vs the 0.85× bar. Root causes noted in the
R0 review (not used to tune R1 primary constants): (1) pilot burns 20% of B and is discarded for certification;
(2) the pilot floor is loose (median floor coverage ~0.64 vs certified coverage ~0.25–0.36). R1 removes the pilot and
places the floor from unlabeled scores alone with a frozen a-priori coverage anchor, so the full budget B certifies.

## Question
At frozen label budget B = 500, does label-free floor LTT (lf_ltt) reach mean coverage ≥ 0.85 × oracle(α=0.10) with
violation rate controlled at δ, beat R0's pf_ltt_500 at the same B (paired), and remain valid?

## DGP (unchanged from CRC-1 / LEC-1 R0)
z ~ N(1.2, 1.5²); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8²)); wrong = 1 - correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999) (same as CRC-1 / R0).
α = 0.10, δ = 0.10. Scores are free; only labels (wrong/correct) count against B.
|U| = 20,000 unlabeled scores per draw (labels never read). Seed families identical to R0 for fair pairing:
L_k = Random(30000+k), U_k = Random(40000+k), F_k = Random(50000+k).

## Primary floor rule (frozen a priori — MUST NOT be tuned to R0 outcomes)
C_ANCHOR = 0.55, SAFETY = 1.15.
c_f = min(1.0, C_ANCHOR * SAFETY)  (= 0.6325 with these constants).
floor index = largest grid i with c_U(GRID[i]) ≥ c_f; if none, floor index = 0 (no focusing).
Rationale: C_ANCHOR = 0.55 is a conservative selective-classification coverage band from literature practice
(not copied from R0's hindsight 0.60 or observed median floor cov ~0.64). SAFETY = 1.15 widens slightly so the
floor is not tighter than the unlabeled quantile estimate. These constants are fixed before any R1 outcome.

## Arms (draw index k = 0..999; 1000 draws primary)
- oracle (reference): smallest grid t with population R(t) ≤ α (same as R0).
- rand_500, rand_1000, rand_2000: first B items of L_k; R0 fixed-sequence LTT (same as R0).
- pf_ltt_500 (R0 method, reimplemented/imported from R0 code): paired previous-best baseline at B=500.
- **lf_ltt_B (PRIMARY, "label-free floor LTT")**:
  1. Floor from U_k alone via the primary rule above (no pilot labels; no labels enter the floor).
  2. All B labels from focused stream F_k (same seed scheme as R0: Random(50000+k)): query only if s ≥ GRID[floor].
  3. Certify with the same fixed-sequence LTT as R0 on those B labels; mask grid below floor (p=1).
  4. No pilot exclusion needed because there is no pilot.
  Validity: floor is measurable w.r.t. U alone (independent of labels); given floor, focused labels are i.i.d. from
  P(·|s≥floor); for any t ≥ floor, items with s ≥ t are i.i.d. from P(·|s≥t), so binomial p-values remain super-uniform
  under H0: R(t) > α; fixed-sequence FWER ≤ δ.

## Endpoints
Violation = population R(t_chosen) > α (abstain-all = no violation, coverage 0). Coverage = population C(t_chosen).
× oracle = mean coverage / oracle coverage. Paired differences use the same k.
Also reported: abstain-all count, floor coverage distribution, unlabeled items screened, label count (== B).

## Hypotheses (primary B = 500, 1000 draws)
- H1 validity: lf_ltt_500 violation rate Clopper–Pearson 95% upper ≤ δ = 0.10.
  REJECTED if CP lower > 0.10; else NOT_PROVEN if upper > 0.10; SUPPORTED if upper ≤ 0.10.
- H2 utility: lf_ltt_500 mean coverage ≥ 0.85 × oracle coverage. Else NOT_PROVEN.
- H3 beats previous best at the same budget: paired mean (lf_ltt_500 − pf_ltt_500) coverage has one-sided 95% lower
  bound > 0 (normal approx, mean − 1.645 sd/√n). REJECTED if one-sided upper bound < 0. Else NOT_PROVEN.
  Also report (descriptive) lf_ltt_500 − rand_500.
- H4 label efficiency (secondary, not in Overall): lf_ltt_500 non-inferior to rand_1000: paired mean
  (lf_ltt_500 − rand_1000) one-sided 95% LB > −0.01. REJECTED if one-sided UB < −0.01. Else NOT_PROVEN.
Overall: SUPPORTED iff H1, H2, H3 all SUPPORTED; REJECTED if H1 or H3 REJECTED; else NOT_PROVEN.

## Exploratory (not used for any verdict; sensitivity flagged post-hoc)
- E1 budgets B ∈ {250, 1000}: lf_ltt_B vs pf_ltt_B / rand_B.
- E2 optional sensitivity C_ANCHOR ∈ {0.45, 0.65} with SAFETY = 1.15 (post-hoc; not primary).
- E3 rand_2000 ceiling (descriptive).

## Tests and hygiene
- Unit tests with hand-built inputs for: label-free floor rule (C_ANCHOR, SAFETY, direction), masking below floor,
  focused sampler rejection (no leak below floor), label accounting (exactly B labels, no pilot), p-value direction,
  α = 0.10, floor does not use labels/pilot.
- Mutation gate: planted mutants (no masking below floor, sampler accepts s < floor, wrong C_ANCHOR, SAFETY dropped,
  upper-tail p-value, wrong α, floor picks smallest index, floor uses pilot/labels, label count ≠ B)
  must each make a test fail.
- summary.json has no timing fields and must be byte-identical across two runs; sha256 recorded.
- Order: this CONTRACT commit (sha256 recorded in evidence/lec1/r1/PREREG_FREEZE.txt) → code + tests + gate commit
  → results commit. Never flip a verdict without a new preregistered round.
