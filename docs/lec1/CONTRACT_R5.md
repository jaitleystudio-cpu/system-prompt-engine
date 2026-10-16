# LEC-1 R5 — Cross-fitted isotonic focusing (CIF) + fixed-sequence LTT (PREREGISTERED)

Status: frozen before any LEC-1 R5 code or outcome data exists. ₹0. No merge, no deploy, no PR.
Branch `grok/lec1-r5-crossfit-isotonic`. Host: Mac mini (Apple M2) worktree
`/Volumes/4TB-WD/spe-worktrees/spe-lec1-r5` from tip `218d9ce9` (LEC-1 R4).
Baseline capture (IST): 2026-10-16 ~13:18, disk free ~2.9 TiB on /Volumes/4TB-WD, hostname Prawins-Mac-mini.local.
Ollama is NOT used this cycle (synthetic CRC-1 DGP only). Note: ~/.ollama still symlinks to an unmounted My Passport;
models sit on /Volumes/4TB-WD/ollama-models; CWC remains blocked until OLLAMA_HOME is fixed by Prawin.
Parent commit: 218d9ce9 (LEC-1 R4 tip). CRC-1 is CLOSED; R5 changes no CRC-1 file, search order or endpoint.
New code only in `spe_runtime/research/lec1/r5.py`, tests in `tests/research/lec1/`, evidence in `evidence/lec1/r5/`.

## Why (diagnosis of R4 / standing memory, written before R5 code)
CRC-1 CLOSED. LEC-1 PPI/betting sub-line EXHAUSTED (R4 REJECTED; best VALID method remains R1 lf_ltt ≈0.64–0.66× oracle).
R4 critic Q1 / standing memory: try a genuinely informative/learned predictor instead of f(s)=1−s.
R5 is **not** PPI mean-shift and **not** betting. It cross-fits a monotone risk model ĝ(s) = P̂(wrong|s) via isotonic
regression on a held-out pilot budget, then focuses certification labels above a **learned** floor derived from U + ĝ only.

## Honest prior expectation (recorded before running)
On this score-monotone synthetic DGP, isotonic ĝ(s) may largely recover the same ordering as raw s, so CIF may be VALID
but fail to beat lf_ltt; still the right next experiment (addresses "learned predictor" without inventing new DGP noise).

## DGP (unchanged from CRC-1 / LEC-1 R0–R4)
z ~ N(1.2, 1.5²); P(correct) = sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0, 0.8²)); wrong = 1 − correct.
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth: 400,000 items, Random(999). α = 0.10, δ = 0.10.
|U| = 20,000 unlabeled scores per draw. Seeds: L_k = Random(30000+k), U_k = Random(40000+k), F_k = Random(50000+k).

## Frozen constants / mechanism (a priori — NOT tuned on any R5 outcome)
- Coarse label-free floor (reuse R1): C_ANCHOR=0.55, SAFETY=1.15 → c_f = min(1, 0.55·1.15) = 0.6325. Call this floor index f₀.
- Budget split (frozen): B_FIT = ⌊0.2 · B⌋, B_CERT = B − B_FIT. At B=500: B_FIT=100, B_CERT=400.
- Acquisition: draw B_FIT items from the focused stream above GRID[f₀] using Random(50000+k) (shared protocol; same stream
  semantics as R1 focused_sample). Then, after learning the floor, draw B_CERT **fresh** labels above the learned floor
  from the **same** Random stream (continued). Total labels = B_FIT + B_CERT = B.
- Isotonic regression: fit ĝ of Y (wrong=1) on s from the B_FIT pilot, constrained **non-increasing** in s
  (higher score → lower predicted wrong-rate). Pure Python PAVA (stdlib+math); no sklearn, no paid APIs.
  Prediction at new s: piecewise-constant step from the isotonic fit (left/right endpoint at extremes; within range,
  value of the block covering s, with ties at unique training s collapsed by mean before PAVA).
- Learned floor f★: among grid indices t ≥ f₀, choose the **largest** index t such that
  mean_{u ∈ U, u ≥ GRID[t]} ĝ(u) ≤ α. If none, keep f₀. Uses only U + ĝ(pilot) — **no cert labels**.
- Certification: B_CERT labels above GRID[f★]; fixed-sequence binomial LTT + mask-below-floor as R1 (exact counts).
  Validity = LTT on held-out cert labels only (pilot labels are never mixed into certification counts).

## Arms (k = 0..999)
- **cif_ltt_B (PRIMARY)** at B ∈ {250, 500, 1000}; 500 primary. Same 20%/80% split (B_FIT=⌊0.2B⌋, B_CERT=B−B_FIT).
- lf_ltt_500 (best VALID previous — primary comparison); lf_ltt_400 (matches B_CERT; report); lf_ltt_250 / lf_ltt_1000.
- rand_500, rand_1000 (and rand_250 / rand_2000 for continuity with prior tables).
All lf_ltt / cif arms at a given B that share F_k use independent Random(50000+k) instances per arm call (fresh stream per
arm, same seed) so pairing is exact and label accounting is per-arm == B.

## Hypotheses (B = 500, 1000 draws)
- H1 validity: cif_ltt_500 violation CP95 upper ≤ 0.10 → SUPPORTED; CP lower > 0.10 → REJECTED; else NOT_PROVEN.
- H2 utility (report only): mean coverage ≥ 0.85 × oracle.
- **H3 primary: paired (cif_ltt_500 − lf_ltt_500) one-sided 95% LB > 0 → SUPPORTED; UB < 0 → REJECTED; else NOT_PROVEN.**
- H4 (report): non-inferior to lf_ltt_500, LB > −0.01 (REJECTED if UB < −0.01).
- G abstain guard: abstain_all(cif_ltt_500) ≤ 500/1000 else FAIL.

### Overall rule (one rule)
SUPPORTED iff H1 SUPPORTED AND H3 SUPPORTED AND G PASS.
REJECTED if H1 REJECTED OR H3 REJECTED OR G FAIL.
Else NOT_PROVEN.

## Literature anchors (cited, not tuned)
Barlow, Bartholomew, Bremner, Brunk — *Statistical Inference under Order Restrictions* (isotonic regression / PAVA);
score calibration / monotone risk models; Angelopoulos, Bates et al. Learn-then-Test (fixed-sequence).
Not PPI (Angelopoulos et al. 2023 mean-shift); not betting / aGRAPA.

## Tests and hygiene
Hand-built unit tests: constants; budget split 20/80; isotonic non-increasing (monotone check + recovers known step);
prediction uses U-only floor rule; cert labels never enter ĝ; learned floor ≥ label-free floor; mask below learned floor;
LTT on cert counts only; label count == B; p direction (safe small via R0.ltt); share R1 floor constants.
Mutation gate (each must be killed): increasing isotonic (wrong direction); fit ĝ on cert labels; ignore learned floor
(always use f₀ for cert); wrong B_FIT/B_CERT split; no mask; label count ≠ B; p inverted / always-accept; α flipped.
summary.json has no timing fields; two runs must be byte-identical; sha256 recorded.
Order: this CONTRACT commit (sha256 in evidence/lec1/r5/PREREG_FREEZE.txt) → code+tests+gate → results. No verdict flips.
