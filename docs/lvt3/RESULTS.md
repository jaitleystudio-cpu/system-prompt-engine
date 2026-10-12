# LVT-3 Results — run1 (frozen contract)

- Contract: docs/lvt3/CONTRACT.md, sha256 `f8b523a0d922b462081fb40b38ebe6cc4e9e05085a89c9c8b021a5c301f4e20e`, frozen in commit 8dfb8173 before any run.
- Raw data: evidence/lvt3/run1/{results.json,task_rows.jsonl}, stdout in evidence/lvt3/run1_stdout.txt. Setup: 10 seeds × 6 configs, 120 hidden tasks per seed, runtime 8.1 s, ₹0.
- CIs: paired t (df=9, t=2.262), plus a paired bootstrap (10k resamples, RNG 12345).

## Means over seeds
| cfg | verified | false-success | transfer | trap | cost/verified | reuse |
|---|---|---|---|---|---|---|
| A | 0.9867 | 0.0133 | 0.9883 | 0.9825 | 891.5 | 0 |
| B | 0.9950 | 0.0050 | 0.9983 | 0.9900 | 131.7 | 0.93 |
| C | 0.9917 | 0.0083 | 1.0000 | 0.9800 | 609.7 | 0.50 |
| D | 0.9917 | 0.0083 | 1.0000 | 0.9800 | 609.7 | 0.50 |
| E | 0.9983 | 0.0017 | 1.0000 | 0.9975 | 2135.6 | 0.50 |
| E_shuf | 0.0000 | 0.80* | 0 | 0 | inf | 0 |

*E_shuf abstains on 97% of tasks, so its false-success rate rests on very few declared tasks.

## Paired differences in verified success (t-CI / bootstrap CI)
| diff | mean | t-CI | boot CI |
|---|---|---|---|
| E−A | +0.0117 | [0.0066, 0.0167] | [0.0075, 0.0158] |
| E−B | +0.0033 | [−0.0008, 0.0075] | [0.0000, 0.0075] |
| E−C | +0.0067 | [0.0020, 0.0114] | [0.0033, 0.0108] |
| E−D | +0.0067 | [0.0020, 0.0114] | [0.0033, 0.0108] |
| E−E_shuf | +0.9983 | [0.9958, 1.0008] | [0.9958, 1.0000] |
| D−C | 0 | [0, 0] | [0, 0] |

## Decision rule (as frozen)
| Q | result |
|---|---|
| Q1: E > each of A–D (lower bound > 0) | **FAIL vs B** (t lower bound −0.0008). Passes vs A, C and D |
| Q2: upper bound of false-success(E−X) ≤ 0.02 | PASS (largest is +0.0008, vs B) |
| Q3: E−E_shuf lower bound > 0 | PASS (weak, because the control is degenerate) |
| Q4: upper bound of transfer(A−E) ≤ 0.02 | PASS (−0.0036) |
| Q5: cost(E) ≤ 1.2×A | **FAIL**: 2135.6 vs limit 1069.9 (2.40×A) |
| Q6: mutation tests | PASS: 14/14 tests, 5/5 qualifier source mutants killed (evidence/lvt3/qualifier_mutants.txt) |
| FAIL triggers | none fired |

**Verdict: NOT_PROVEN.**
- **H11 component: not supported.** D−C = 0 on every metric, so the envelope guard and revocation never changed an outcome under this task distribution.
- **H12 component: supported on verified success.** E−D is +0.0067 with lower bound 0.002, but it costs about 3.5× D.

## Disclosures and limitations
- A seed-0 smoke run was done after the freeze, and nothing was retuned afterwards. Fixes made after the freeze, none of which change contract semantics:
  - `admit_external` now records the envelope verified on during fresh re-verification. Before this, a test-only path had env_max_len=0.
  - The stdev helper was replaced because of a Python 3.12 `statistics` crash.
- Ceiling effects: every baseline is ≥0.987, so the domain is too easy to separate the configs. B, the naive library, is cheapest and statistically tied with E.
- E_shuf is degenerate because corrupted probes make it abstain. It shows the selector depends on true feedback, but it is not a fair matched control.
- Contract interpretation: the 4000 compute cap covers search only. Rival and probe scoring are counted in cost.
- This is a synthetic toy DSL with a builder-written evaluator. Builder ≠ verifier is not yet satisfied: this needs independent review (REVIEW_REQUEST.md).
- The owner brief was truncated when the contract was operationalised.
- Base PR #147 (9637907) does not contain discovery-truth commit 8d3813e4.
- LVT-2 mutation gate: INCOMPLETE. scripts/run_mutations.py died during M01 and left a mutant in learning_validator.py, which was restored with git checkout (a stray `.orig_backup` file is left untracked).
- No novelty claim, given the prior art (PRIOR_ART.md).
