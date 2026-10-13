# CRC-1 R0 — Risk-controlled abstention for SPE "verified" claims (PREREGISTERED)

Status: frozen before any code or outcome data. Builder self-run; Bro replay required. No merge/deploy. ₹0.

## Motivation
SVC-1 R0 was REJECTED (cheap coverage beat verification cascades) and its critic question 4 asked whether
accuracy-with-abstention should be the endpoint. SPE law forbids fake verified claims, so the brain needs a
*distribution-free, finite-sample* guarantee on the error rate of the claims it labels "verified".
Mechanism: Learn-then-Test (Angelopoulos et al., arXiv:2110.01052) with exact per-threshold binomial
(Clopper–Pearson-type) p-values and fixed-sequence FWER control; related: Conformal Risk Control (arXiv:2208.02814).
Local LLM unavailable this cycle (Ollama model drive unmounted), so R0 is synthetic with a deliberately
overconfident, noisy confidence score.

## Data-generating process (fixed)
- Item latent z ~ N(1.2, 1.5^2); P(correct)=sigmoid(z); y ~ Bernoulli.
- Model confidence s = sigmoid(1.8 z + 0.6 + N(0, 0.8^2))  (overconfident, noisy).
- Threshold grid: 200 equally spaced t in [0.50, 0.995]. Claim is "verified" iff s >= t.
- Selective risk R(t) = P(wrong | s >= t). Population truth R(t), coverage C(t) computed on a fixed 400,000-item
  population sample (seed 999). Test risk is evaluated against this population truth (not a finite test set).
- alpha = 0.10, delta = 0.10, n_cal = 500, seeds 0..499 (500 calibration draws).

## Policies
- B1 raw_conf: t = 1 - alpha = 0.90 (trust model confidence).
- B2 naive_cal: smallest grid t whose calibration selective risk <= alpha (>= 1 selected).
- SPE ltt: test t from 0.995 downward; p(t) = P(Bin(n_t, alpha) <= e_t); continue while p(t) <= delta;
  choose the last t accepted (smallest accepted). If none accepted: abstain on all (coverage 0, risk 0).
- Oracle (reference only): smallest grid t with population R(t) <= alpha.

## Endpoints
- Violation: population R(t_chosen) > alpha. Violation rate over 500 seeds, Clopper–Pearson 95% CI.
- Coverage: population C(t_chosen); report mean and ratio to oracle coverage.

## Hypotheses (primary, all must hold for overall SUPPORTED)
- H1 validity: SPE ltt violation rate 95% CP upper bound <= 0.12 (target delta=0.10).
- H2 need: B2 naive_cal violation rate 95% CP lower bound > 0.10 (i.e., the naive method is invalid).
- H3 utility: SPE ltt mean coverage >= 0.85 x oracle coverage.
Verdicts: each H is SUPPORTED/NOT_PROVEN; H1 is REJECTED if the CP lower bound > 0.10.
B1 is reported descriptively (violation 0/1 deterministic).

## Exploratory (not used for verdict)
- E1 n_cal=100. E2 test-time shift z ~ N(0.6, 1.5^2) (exchangeability broken; guarantee not expected to hold).

## Hygiene
Contract commit hash and sha256 recorded before implementation; implementation committed before results.
Never flip verdicts without a new preregistered experiment.
