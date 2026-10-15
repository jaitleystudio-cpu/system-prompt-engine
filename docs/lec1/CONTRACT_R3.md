# LEC-1 R3 — WSR / betting-martingale finite-sample p-values for PPI rectifiers (PREREGISTERED)

Status: frozen before any LEC-1 R3 code or outcome data exists. Builder self-run (Grok box). ₹0. No merge, no deploy, no PR.
Environment: the Mac mini (Ollama) is OFFLINE this cycle (ListMachines connected=false); synthetic CRC-1 DGP only. Box worktree
`/workspace/spe-brain/lec1-r3`.
Parent commit: 3f3c52fa (LEC-1 R2 tip). CRC-1 is CLOSED; LEC-1 R3 does not change any CRC-1 file, search order or endpoint.
New code lives only in `spe_runtime/research/lec1/` (extends R0/R1/R2 modules), tests in `tests/research/lec1/`, evidence in `evidence/lec1/r3/`.

## Why
LEC-1 R2 ppi_ltt_500 reached 0.714× oracle and beat lf_ltt_500 (+0.032 H3) and cleared H4 vs rand_1000, but Overall was
NOT_PROVEN because **H1 empirical validity failed**: violation 0.088 with CP95 upper 0.107 > δ=0.10. Root cause: asymptotic
CLT PPI p-values are mildly anti-conservative at B=500. R2 E3 rectified Hoeffding abstained 100% (useless). R3 replaces the
CLT Φ p-value with a **finite-sample anytime-valid Waudby-Smith–Ramdas (WSR) / predictable betting capital p-value** on the
labeled rectifier residuals, keeping the same R1 floor + focused B labels + unlabeled U for μ̂_f.

## Question
At frozen label budget B = 500, does PPI-style risk estimation with WSR/betting finite-sample p-values (ppi_wsr_ltt)
remain empirically valid at δ, stay non-inferior to R2's asymptotic ppi_ltt_500 (paired LB > −0.02), beat lf_ltt_500
(paired LB > 0), and be non-inferior to rand_1000?

## DGP (unchanged from CRC-1 / LEC-1 R0–R2)
z ~ N(1.2, 1.5²); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8²)); wrong = 1 - correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999).
α = 0.10, δ = 0.10. Scores are free; only labels count against B.
|U| = 20,000 unlabeled scores per draw. Seed families identical to R0–R2:
L_k = Random(30000+k), U_k = Random(40000+k), F_k = Random(50000+k).

## Frozen predictor and constants (a priori — MUST NOT be tuned to R2 outcomes)
- Predictor f(s) = clip(1 − s, 0, 1). Same as R2.
- λ = 1.0 for the mean offset (classical PPI rectifier Z = Y − f(s)). Same as R2.
- Label-free floor: identical to R1/R2 — C_ANCHOR = 0.55, SAFETY = 1.15, c_f = 0.6325. Floor from U alone.
- N_MIN_LABELED = 2 (need ≥2 labeled residuals to form a capital process with at least one bet after init).
- WSR / betting constants (frozen a priori):
  - Observations mapped to [0,1]: X_i = (Z_i + 1) / 2 with Z_i = Y_i − f(s_i) ∈ [−1, 1].
  - Null boundary: θ = α − μ̂_f (conditioned on U; μ̂_f = mean_{u∈U_i} f(u), fallback to labeled f-mean if |U_i|=0).
  - μ0 = (θ + 1) / 2. H0: E[Z] ≥ θ ⇔ E[X] ≥ μ0 ⇔ R = μ̂_f + E[Z] ≥ α (given U).
  - Capital: M_0 = 1; M_t = M_{t-1} · (1 + λ_t (μ0 − X_t)), with λ_t predictable, λ_t ∈ [0, λ_max),
    λ_max = (1 − ε_λ) / max(1 − μ0, ε_μ) when μ0 ∈ (0, 1); ε_λ = 1e-6, ε_μ = 1e-12.
  - Predictable truncated Kelly (past only): λ_1 = λ_max / 2 (a-priori fraction); for t>1,
    m̂_{t−1} = mean(X_1..X_{t−1}); λ_t = clip( (μ0 − m̂_{t−1}) / max(μ0 · (1 − μ0), ε_μ), 0, λ_max ).
  - Edge: if μ0 ≤ 0 → p = 1.0 (H0 always true on [0,1]); if μ0 ≥ 1 → p = 1.0 unless we treat as degenerate
    (no interior bet; capital stays 1 → p = 1.0). Honest: no rejection when null boundary is outside (0,1).
  - p-value: p = min(1, 1 / M_n) after processing all labeled residuals at that grid point (order = ascending s,
    then stable by original index — frozen deterministic order, not data-dependent reordering for power).
- SE / Φ from R2 are NOT used in the primary method.

## Primary method: ppi_wsr_ltt (PPI rectifier + WSR betting p-value + fixed-sequence LTT)
1. Floor from U_k alone via R1 label_free_floor (C_ANCHOR, SAFETY).
2. All B labels from focused stream F_k: query only if s ≥ GRID[floor] (same as R1/R2).
3. Retain full unlabeled score list U_k.
4. For each grid index i ≥ floor (mask i < floor with p=1):
   - L_i = labeled items with s ≥ GRID[i], sorted by s ascending (deterministic);
   - U_i = unlabeled scores ≥ GRID[i];
   - If |L_i| < N_MIN_LABELED: p_i = 1.0;
   - Else: μ̂_f from U_i (or labeled f fallback); θ = α − μ̂_f; compute WSR capital p-value on
     Z_j = y_j − f(s_j) for (s_j, y_j) ∈ L_i as above.
5. Fixed-sequence LTT (same as R0–R2): strict → loose; accept while p_i ≤ δ; stop at first failure;
   return loosest accepted index (or None).

### Validity claim (honest)
p-values are **finite-sample anytime-valid under H0 given U** via Ville's inequality on a nonnegative supermartingale
capital process with predictable stakes (Waudby-Smith & Ramdas betting / WSR; see also Ramdas et al. on testing by betting).
**Claim scope:** conditional on U (μ̂_f treated as fixed), for each fixed grid point, under H0: E[Z | selection] ≥ θ,
the capital process is a supermartingale and p = min(1, 1/M_n) satisfies P(p ≤ α | U) ≤ α for each α ∈ (0,1).
**Not claimed:** (a) a theorem that accounts for μ̂_f − E[f] estimation error without conditioning on U (error is O_p(1/√|U|)
with |U|=20k, negligible vs rectifier noise at B=500, but not formally folded into the martingale); (b) exact finite-sample
FWER control of the fixed-sequence LTT beyond the standard LTT argument that valid p-values yield FWER ≤ δ;
(c) product readiness. H1 still tests **empirical** violation rate with Clopper–Pearson 95% upper ≤ δ.

## Arms (draw index k = 0..999; 1000 draws primary)
- oracle (reference): smallest grid t with population R(t) ≤ α.
- rand_500, rand_1000, rand_2000: first B of L_k; R0 binomial fixed-sequence LTT.
- lf_ltt_500 (R1 method, imported): paired baseline.
- ppi_ltt_500 (R2 asymptotic method, imported): paired previous best — **do not rewrite CRC; import R2**.
- **ppi_wsr_ltt_B (PRIMARY)**: method above, B ∈ {250, 500, 1000} with 500 primary.
- Exploratory only (not in Overall): ppi_wsr_ltt with fixed-λ (E2) if implemented; budget sweeps already in B∈{250,1000}.

## Endpoints
Violation = population R(t_chosen) > α (abstain-all = no violation, coverage 0). Coverage = population C(t_chosen).
× oracle = mean coverage / oracle coverage. Paired differences use the same k.
Also reported: abstain-all, floor coverage distribution, screened, label count (== B).

## Hypotheses (primary B = 500, 1000 draws)
- H1 empirical validity: ppi_wsr_ltt_500 violation rate Clopper–Pearson 95% upper ≤ δ = 0.10.
  REJECTED if CP lower > 0.10; else NOT_PROVEN if upper > 0.10; SUPPORTED if upper ≤ 0.10.
- H2 utility: ppi_wsr_ltt_500 mean coverage ≥ 0.85 × oracle coverage. Else NOT_PROVEN. (Likely still hard; not required for Overall.)
- H3 non-inferior to previous best while fixing validity: paired mean (ppi_wsr_ltt_500 − ppi_ltt_500) one-sided 95% LB > −0.02
  (normal approx). REJECTED if one-sided UB < −0.02. Else NOT_PROVEN if LB ≤ −0.02. SUPPORTED if LB > −0.02.
  (This is the validity-fix non-inferiority bar — not a claim of beating R2 coverage.)
- H3b (reported, required for Overall): beats lf_ltt_500: paired mean (ppi_wsr_ltt_500 − lf_ltt_500) one-sided 95% LB > 0.
  REJECTED if UB < 0; else NOT_PROVEN / SUPPORTED as usual.
- H4 secondary (not in Overall): non-inferior to rand_1000: paired mean (ppi_wsr_ltt_500 − rand_1000) LB > −0.01.
  REJECTED if UB < −0.01. Else NOT_PROVEN / SUPPORTED.

### Overall rule (ONE clear rule — stick to it)
SUPPORTED iff **H1 SUPPORTED** AND **H3 SUPPORTED** (non-inferior to ppi_ltt_500, LB > −0.02) AND **H3b SUPPORTED**
(beats lf_ltt_500, LB > 0).
REJECTED if H1 REJECTED OR H3 REJECTED OR H3b REJECTED.
Else NOT_PROVEN.
H2 and H4 do not enter Overall. Do not claim product readiness.

## Exploratory (not used for any verdict)
- E1 budgets B ∈ {250, 1000}: ppi_wsr_ltt_B vs ppi_ltt_B / lf_ltt_B.
- E2 (optional): fixed λ = λ_max/4 a priori (no Kelly adaptation) — power comparison only if coded.
- E3: report mean wealth / mean p at chosen t (descriptive).

## Literature anchors (cited, not tuned)
- Waudby-Smith & Ramdas (2024), "Estimating means of bounded random variables by betting" (JRSS-B) — WSR capital / Kelly.
- Ramdas, Grünwald, Vovk, Shafer (testing by betting / game-theoretic statistics) — Ville p-values from capital.
- Angelopoulos, Bates, Fannjiang, Jordan, Zrnic (2023), "Prediction-Powered Inference" — rectifier + unlabeled mean.
- R2 CONTRACT: asymptotic PPI LTT; R1: label-free floor; R0: binomial LTT / Learn-then-Test.

## Tests and hygiene
- Unit tests with hand-built inputs for: f(s)=1−s clip, X=(Z+1)/2 mapping, WSR capital grows when mean_X << μ0,
  WSR p small on safe set / large on bad set, λ_t predictable (mutating to use future data must be gate-killed if tested),
  μ0∉(0,1) → p=1, N_MIN gate, floor reuse from R1, masking below floor, label accounting (== B), λ_offset=1,
  α=δ=0.10, import of R2 ppi_ltt baseline present, primary kind is wsr not asymptotic Φ.
- Mutation gate: planted mutants (wrong f=s, wealth→p inverted, use future in λ_t, upper-tail / always-accept when
  mean_X<μ0 without capital, wrong α, floor uses labels, label count ≠ B, no mask below floor, skip U / μ̂_f=0)
  must each make a test fail.
- summary.json has no timing fields and must be byte-identical across two runs; sha256 recorded.
- Order: this CONTRACT commit (sha256 in evidence/lec1/r3/PREREG_FREEZE.txt) → code + tests + gate commit
  → results commit. Never flip a verdict without a new preregistered round.
