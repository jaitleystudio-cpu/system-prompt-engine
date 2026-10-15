# LEC-1 R2 — Prediction-powered LTT (ppi_ltt) with label-free floor (PREREGISTERED)

Status: frozen before any LEC-1 R2 code or outcome data exists. Builder self-run (Grok box). ₹0. No merge, no deploy, no PR.
Environment: the Mac mini (Ollama) is OFFLINE this cycle, so no local LLM; synthetic CRC-1 DGP only. Box worktree
`/workspace/spe-brain/lec1-r2` (Mac mini unreachable via ListMachines).
Parent commit: ea1677bd (LEC-1 R1 tip). CRC-1 is CLOSED; LEC-1 R2 does not change any CRC-1 file, search order or endpoint.
New code lives only in `spe_runtime/research/lec1/` (extends R0/R1 modules), tests in `tests/research/lec1/`, evidence in `evidence/lec1/r2/`.

## Why
LEC-1 R1 lf_ltt_500 reached 0.642× oracle (valid; beat pf_ltt_500) but H2 failed vs 0.85× and H4 was REJECTED vs rand_1000
(0.692×). R1 uses only B labeled wrong/correct bits for risk testing; the |U|=20k unlabeled scores inform the floor but
not the risk estimate. R2 feeds those unlabeled scores into a prediction-powered (PPI) risk estimator so the same B
labels buy more power at each grid t, aiming to close the gap to rand_1000 and lift ×oracle.

## Question
At frozen label budget B = 500, does prediction-powered LTT with the R1 label-free floor (ppi_ltt) remain empirically
valid at δ, reach mean coverage ≥ 0.85 × oracle(α=0.10), beat R1's lf_ltt_500 at the same B (paired), and be
non-inferior to rand_1000?

## DGP (unchanged from CRC-1 / LEC-1 R0–R1)
z ~ N(1.2, 1.5²); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8²)); wrong = 1 - correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999) (same as CRC-1 / R0 / R1).
α = 0.10, δ = 0.10. Scores are free; only labels (wrong/correct) count against B.
|U| = 20,000 unlabeled scores per draw (labels never read for U). Seed families identical to R0/R1 for fair pairing:
L_k = Random(30000+k), U_k = Random(40000+k), F_k = Random(50000+k).

## Frozen predictor and PPI constants (a priori — MUST NOT be tuned to R1 outcomes)
- Predictor f(s) = clip(1 − s, 0, 1). Rationale: s is the model's own confidence; 1−s is the natural point prediction
  of P(wrong|s). Frozen; no fitting on labels (avoids double-dipping).
- λ = 1.0 (classical PPI; Angelopoulos et al. 2023). PPI++ power tuning (Angelopoulos, Duchi, Zrnic 2023) is
  exploratory only (E2), never primary.
- Label-free floor: identical to R1 — C_ANCHOR = 0.55, SAFETY = 1.15, c_f = min(1, C_ANCHOR * SAFETY) = 0.6325.
  Floor from U alone; no pilot.
- Min labeled count at a grid point to form a PPI p-value: N_MIN_LABELED = 2 (need sample variance of rectifier).
  Below that, p = 1.0 (cannot accept).
- SE floor: SE = max(computed_SE, 1e-12) to avoid division by zero.

## Primary method: ppi_ltt (prediction-powered fixed-sequence LTT)
1. Floor from U_k alone via R1 label_free_floor (C_ANCHOR, SAFETY).
2. All B labels from focused stream F_k: query only if s ≥ GRID[floor] (same as R1).
3. Also retain the full unlabeled score list U_k.
4. For each grid index i ≥ floor (mask i < floor with p=1):
   - L_i = labeled items with s ≥ GRID[i]; U_i = unlabeled scores ≥ GRID[i].
   - If |L_i| < N_MIN_LABELED: p_i = 1.0.
   - Else classical PPI (λ=1):
     - μ̂_f = mean_{u ∈ U_i} f(u); if |U_i|=0 then μ̂_f = mean_{s ∈ L_i} f(s) (degenerate fallback; rare above floor).
     - Δ̂ = mean_{(s,y) ∈ L_i} (y − f(s))
     - R̂ = μ̂_f + Δ̂
     - σ²_f = sample variance of {f(u): u ∈ U_i} (Bessel ddof=1; 0 if |U_i|<2)
     - σ²_Δ = sample variance of {y−f(s): (s,y) ∈ L_i} (ddof=1)
     - SE = max(sqrt(σ²_f/max(|U_i|,1) + σ²_Δ/|L_i|), 1e-12)
     - Asymptotic one-sided p-value for H0: R(GRID[i]) ≥ α:
       p_i = Φ((R̂ − α) / SE) where Φ is the standard normal CDF.
5. Fixed-sequence LTT (same search as R0/R1): strict → loose; accept while p_i ≤ δ; stop at first failure;
   return loosest accepted index (or None).

### Validity claim (honest)
PPI p-values are **CLT / asymptotic**, not finite-sample exact (Angelopoulos et al. 2023). Finite-sample FWER ≤ δ is
**not** claimed. H1 tests **empirical** finite-sample validity: violation rate with Clopper–Pearson 95% upper ≤ δ.
A finite-sample-leaning exploratory arm (E3, rectified Hoeffding) is reported but does not enter Overall.

## Arms (draw index k = 0..999; 1000 draws primary)
- oracle (reference): smallest grid t with population R(t) ≤ α.
- rand_500, rand_1000, rand_2000: first B of L_k; R0 binomial fixed-sequence LTT.
- lf_ltt_500 (R1 method, imported): paired previous-best baseline at B=500.
- **ppi_ltt_B (PRIMARY)**: method above, B ∈ {250, 500, 1000} with 500 primary.
- Exploratory only (not in Overall): ppi_ppipp_500 (E2), ppi_hoeff_500 (E3).

## Endpoints
Violation = population R(t_chosen) > α (abstain-all = no violation, coverage 0). Coverage = population C(t_chosen).
× oracle = mean coverage / oracle coverage. Paired differences use the same k.
Also reported: abstain-all, floor coverage distribution, screened, label count (== B), mean R̂ at chosen t (descriptive).

## Hypotheses (primary B = 500, 1000 draws)
- H1 empirical validity: ppi_ltt_500 violation rate Clopper–Pearson 95% upper ≤ δ = 0.10.
  REJECTED if CP lower > 0.10; else NOT_PROVEN if upper > 0.10; SUPPORTED if upper ≤ 0.10.
- H2 utility: ppi_ltt_500 mean coverage ≥ 0.85 × oracle coverage. Else NOT_PROVEN.
- H3 beats previous best: paired mean (ppi_ltt_500 − lf_ltt_500) coverage has one-sided 95% lower bound > 0
  (normal approx, mean − 1.645 sd/√n). REJECTED if one-sided upper bound < 0. Else NOT_PROVEN.
- H4 label efficiency (secondary, not in Overall): ppi_ltt_500 non-inferior to rand_1000: paired mean
  (ppi_ltt_500 − rand_1000) one-sided 95% LB > −0.01. REJECTED if one-sided UB < −0.01. Else NOT_PROVEN.
Overall: SUPPORTED iff H1, H2, H3 all SUPPORTED; REJECTED if H1 or H3 REJECTED; else NOT_PROVEN.

## Exploratory (not used for any verdict)
- E1 budgets B ∈ {250, 1000}: ppi_ltt_B vs lf_ltt_B / rand_B.
- E2 PPI++ power tuning: split the B focused labels 20%/80%; estimate λ* ∈ [0,1] minimizing plug-in variance of
  R̂_λ on the 20% slice (grid λ = 0, 0.25, 0.5, 0.75, 1.0); apply λ* on the 80% rectifier + full U. Flagged post-hoc;
  asymptotic p-values; validity not claimed.
- E3 rectified Hoeffding (finite-sample-leaning): condition on U, treat μ̂_f as fixed offset; one-sided Hoeffding
  p-value on Z = Y − f(s) ∈ [−1,1] for H0: E[Z] ≥ α − μ̂_f; p = exp(−n · max(0, (α−μ̂_f) − mean_Z)² / 2).
  Does not correct for μ̂_f − E[f] estimation error (tiny at |U|=20k); still not a theorem-grade finite-sample PPI.
- E4 rand_2000 ceiling (descriptive).

## Literature anchors (cited, not tuned)
- Angelopoulos, Bates, Fannjiang, Jordan, Zrnic (2023), "Prediction-Powered Inference."
- Angelopoulos, Duchi, Zrnic (2023), "PPI++: Efficient Prediction-Powered Inference."
- Zrnic & Candès (2024), "Active Statistical Inference" (motivation only; R2 does not implement ASI design).
- R0/R1 fixed-sequence LTT / Learn-then-Test (Angelopoulos et al.).

## Tests and hygiene
- Unit tests with hand-built inputs for: f(s)=1−s clip, PPI point estimate + SE on toy L/U, p-value direction
  (low R̂ → small p), N_MIN_LABELED gate, floor reuse from R1, masking below floor, label accounting (== B),
  λ=1 primary (not data-tuned), α=δ=0.10, focused sampler no leak, asymptotic Φ vs Hoeffding exploratory separation.
- Mutation gate: planted mutants (wrong f e.g. f=s, λ≠1 in primary, no U in estimate / labels-only mean, upper-tail
  Φ, wrong α, SE ignored / p=0 always when R̂<α, floor uses labels, label count ≠ B, no mask below floor)
  must each make a test fail.
- summary.json has no timing fields and must be byte-identical across two runs; sha256 recorded.
- Order: this CONTRACT commit (sha256 recorded in evidence/lec1/r2/PREREG_FREEZE.txt) → code + tests + gate commit
  → results commit. Never flip a verdict without a new preregistered round.
