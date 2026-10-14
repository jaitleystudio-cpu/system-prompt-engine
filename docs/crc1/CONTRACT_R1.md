# CRC-1 R1 — Repairing the LTT search so "verified" keeps coverage (PREREGISTERED)

Status: frozen before any R1 code or outcome data. Builder self-run. No merge/deploy. ₹0.
Parent: R0 at becbe6a2 (NOT_PROVEN: valid, but coverage 0.48x oracle; 144/500 seeds abstained on all).
Bro's replay of R0 asked for four fixes, all addressed here:
(1) stronger tests with planted mutants that must be killed; (2) H1 bar no looser than delta;
(3) replace stop-at-first-failure-from-0.995 with a frozen alternative; (4) summary.json byte-identical across runs.
Local LLM: unavailable this cycle (the Mac mini with Ollama is offline), so R1 stays on the R0 synthetic DGP.
R0 code and files are not modified; R1 lives in spe_runtime/research/crc1/r1.py.

## DGP (unchanged from R0)
z ~ N(1.2, 1.5^2); P(correct)=sigmoid(z); s = sigmoid(1.8 z + 0.6 + N(0,0.8^2)).
Grid: 200 equally spaced t in [0.50, 0.995]. Population truth from 400,000 items, seed 999 (same as R0).
alpha = delta = 0.10. n_cal = 500. Calibration seeds: Random(20000 + k), k = 0..999 (1000 draws; fresh vs R0).

## Arms
- oracle (reference): smallest grid t with population R(t) <= alpha.
- naive_cal (descriptive only): smallest t with calibration risk <= alpha.
- ltt_r0 (descriptive): R0's fixed sequence from 0.995 down, stop at first failure.
- SGR baseline (Geifman & El-Yaniv 2017, arXiv:1705.08500, selective guaranteed risk): binary search over the
  200-point grid with k = ceil(log2 200) = 8 steps; each step tests the binomial p-value at delta/k; accept ->
  move looser, reject -> move stricter; choose the loosest accepted (abstain-all if none). Valid by Bonferroni.
- bonf10 (secondary, descriptive): 10 grid indices {0,22,44,...,198}; accept each with p <= delta/10; choose loosest accepted.
- SPE ltt_mc (PRIMARY): fixed sequence that starts at the strictest grid t whose calibration count n_t >= N_MIN
  (N_MIN = 0.3 * n_cal = 150; the start depends on scores only, never labels), then walks toward looser t,
  accepting while p(t) <= delta and stopping at the first failure; choose the loosest accepted.
  N_MIN chosen a priori by power reasoning: at n=150 a threshold with true risk <= 0.05 passes
  P(Bin(150,0.10) <= e) <= 0.10 with high probability, so the first test is unlikely to kill the sequence.
p-value everywhere: p(t) = P(Bin(n_t, alpha) <= e_t), n_t = 0 -> p = 1.

## Endpoints
Violation = population R(t_chosen) > alpha (abstain-all counts as no violation, coverage 0).
Coverage = population C(t_chosen). Paired coverage difference ltt_mc - SGR per calibration draw.

## Hypotheses (all three must be SUPPORTED for overall SUPPORTED)
- H1 validity: ltt_mc violation rate, Clopper–Pearson 95% upper bound <= 0.10 (= delta).
  REJECTED if the CP lower bound > 0.10; otherwise NOT_PROVEN.
- H2 utility (same bar as R0 H3): ltt_mc mean coverage >= 0.85 x oracle coverage. Else NOT_PROVEN.
- H3 beats a strong valid baseline: mean paired coverage difference (ltt_mc - SGR) has one-sided 95% lower
  bound > 0 (normal approx, mean - 1.645 * sd/sqrt(n)). REJECTED if the one-sided upper bound
  (mean + 1.645 * sd/sqrt(n)) < 0. Otherwise NOT_PROVEN.
Overall: SUPPORTED iff H1,H2,H3 all SUPPORTED; REJECTED if H1 or H3 REJECTED; else NOT_PROVEN.
SGR validity is also reported (its CP95 upper bound); if SGR were invalid, H3 is reported with that caveat.

## Exploratory (not used for verdict)
E1 n_cal = 100 (N_MIN = 30). E2 n_cal = 2000 (N_MIN = 600). E3 test-time shift z ~ N(0.6,1.5^2), n_cal = 500.

## Tests and hygiene
- Unit tests on hand-built count vectors with known answers for every arm.
- Mutation gate: planted mutants (upper-tail p-value, no stop-at-failure, start ignores N_MIN, SGR without
  Bonferroni, picks strictest accepted instead of loosest, wrong alpha) must each make the tests fail.
- summary.json contains no timing fields and must be byte-identical across two runs (checked and recorded).
- Contract commit + sha256 recorded before implementation; implementation committed before results.
  Never flip a verdict without a new preregistered experiment.
