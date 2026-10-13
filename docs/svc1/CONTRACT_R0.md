# SVC-1 R0 — Selective Verification Cascade (preregistered)

FROZEN before any outcome run. Programme: SPE brain upgrade loop 2026-10-13 13:05 IST. ₹0, local CPU only. RESEARCH — not product, not AGI, not #1.

## Motivation (prior art + our failures)
- AVA (Anytime Verified Agents): adaptive compute + verification cascades under budget ([GitHub AVA](https://github.com/llmsresearch/AVA); OpenReview anytime verified agents).
- PiFlow: principle-aware uncertainty reduction for discovery ([arXiv:2505.15047](https://arxiv.org/abs/2505.15047)).
- Our Oct-12/13 record: H12 R3 NOT_PROVEN at matched cost; LVT-3 R2 REJECTED (cost>gain); AGI-Brain R2 NOT_PROVEN vs CEGIS; P4 long-doc mostly NOT_PROVEN.
- Gap: we used uncertainty for *search selection* (H12) or world-model ranking (R2), not for *when to spend verification budget* with early exits across a batch.

## Claim under test
Under a **fixed total verification-cost budget** across a held-out batch of claims, an SPE selective verification cascade (cheap→mid→expensive with calibrated early exit) achieves higher accuracy than (a) always-expensive and (b) fixed always-escalate cascade and (c) uniform random deferral, without exceeding the budget.

## Task
Synthetic claim verification (deterministic). Each item is a boolean claim about a small integer predicate. Ground truth known to the evaluator only. Three verifier tiers with **declared** cost and accuracy (environment, not estimated from outcomes before freeze):

| Tier | Name | Cost units | Accuracy vs truth |
|------|------|------------|-------------------|
| V0 | heuristic | 1 | 0.62 |
| V1 | mid | 5 | 0.78 |
| V2 | expensive | 20 | 0.95 |

Verifier noise is seeded per (item_id, tier, seed) so all conditions see the same noisy oracle responses for the same call (matched noise).

## Held-out data
- N=200 claims generated with master seed `svc1-r0-holdout-v1` (SHA-256 of that string used as RNG seed for item generation).
- Difficulty mix fixed in generator: 40% easy, 40% medium, 20% hard (affects feature noise only; truth independent).
- Train/calibration slice: first 40 items (ids 0–39) **only** for calibrating early-exit thresholds for `spe_svc` (thresholds frozen after calibration commit, before holdout scoring).
- Holdout scored: items 40–199 (160 items). Never used for threshold tuning.

## Conditions (matched total budget B)
Budget **B = 160 × 8 = 1280** cost units (equivalent to 0.4×V2 per holdout item on average).
- **always_v2**: call V2 on items in id order until budget exhausted; remainder unanswered → scored wrong.
- **always_v0**: V0 on every holdout item (cost 160); leftover budget unused.
- **fixed_cascade**: for each item in order: V0→V1→V2 always (cost 26/item) until budget exhausted.
- **random_defer**: for each item, randomly pick tier with probs proportional to inverse cost, spend until budget exhausted (seeded).
- **spe_svc**: calibrate on items 0–39: early-exit if V0 confidence proxy agrees with a second V0 resample OR |p̂−0.5| > τ; else escalate V1; exit if V1 confident; else V2. Process holdout in uncertainty-priority order (hardest first by V0 disagreement). Stop when budget hits B. Unanswered → wrong.

## Endpoints
- **accuracy** (primary): fraction of holdout items with correct accept/reject (unanswered = incorrect).
- **answered**: fraction answered before budget exhaustion.
- **cost_used**: total cost units (must be ≤ B).
- **cost_per_correct**: cost_used / max(1, #correct).

## Statistics
Unit = seed (seeds 0–19). Paired differences. Student t 95% CI (df=19). Exact two-sided sign-flip permutation p (4096 flips). Holm correction over contrasts: spe_svc−always_v2, spe_svc−fixed_cascade, spe_svc−random_defer, spe_svc−always_v0 (primary family: first three).

## Decision rules
- H1 (primary): spe_svc > always_v2 on accuracy, Holm p < 0.05 and mean Δ ≥ 0.05 → `SVC_ADVANTAGE_OVER_ALWAYS_EXPENSIVE`.
- H2: spe_svc > fixed_cascade, same bar → `SVC_ADVANTAGE_OVER_FIXED_CASCADE`.
- H3: spe_svc > random_defer, same bar → `SVC_ADVANTAGE_OVER_RANDOM`.
- Else for each: `NOT_PROVEN`. If spe_svc mean accuracy < always_v2 − 0.02: `REJECTED` for H1.
- Never claim AGI / product-ready / #1. Builder ≠ verifier: ask Bro to replay.

## Stopping
One full run after contract+code freeze. No re-runs to chase significance.
