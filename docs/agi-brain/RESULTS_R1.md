# AGI-BRAIN R1 Results (frozen contract, single run)

- Contract `docs/agi-brain/CONTRACT_R1.md` sha256 `7401e14fad02bf9ff2b175e20713efc71a89034d320d94660d95f04e0daaac06`, committed in `16649bd4` **before** the run.
- Raw: `evidence/agi-brain/r1/rows.jsonl` (sha256 `93b5eb03…d5b1`), `results.json` (`2a4cb711…0128`), stdout `evidence/agi-brain/r1_stdout.txt`. 10 seeds × 4 conditions × 14 held-out families = 560 rows; 166.6 s on the Mac mini; ₹0.

## Means over seeds (held-out families)
| cond | quality (REF/size, 0 if invalid) | false-success | input-evaluations | depth |
|---|---|---|---|---|
| A plain search | 0.255 | 0.750 | 621,600 | 3.61 (valid only) |
| B search+tools | 1.021 | 0.000 | 16,912,424 | 5.70 |
| C + verified library | 1.025 | 0.000 | 16,950,195 | 5.76 |
| D + world model | 1.024 | 0.000 | 5,919,406 | 5.77 |

## Paired contrasts (t95 / bootstrap95 / Bonferroni t, df=9)
| contrast | mean | t95 | boot95 | Bonf |
|---|---|---|---|---|
| quality B−A | +0.766 | [0.723, 0.810] | [0.730, 0.801] | [0.710, 0.823] |
| quality C−B | +0.0036 | [0.0002, 0.0071] | [0.0006, 0.0063] | [−0.0008, 0.0081] |
| quality D−C | −0.0010 | [−0.0049, 0.0029] | [−0.0040, 0.0023] | [−0.0060, 0.0040] |
| log cost D−C | −1.053 (≈0.35×, ~65% fewer evaluations) | [−1.095, −1.012] | [−1.089, −1.021] | [−1.108, −0.999] |
| false-success A−B | +0.75 | [0.707, 0.793] | [0.714, 0.786] | [0.694, 0.806] |

## Decisions (as frozen)
- **H1 (primary) — SUPPORTED_WITHIN_TESTED_SCOPE**: D needs ~65% fewer input-evaluations than C with non-inferior quality (Bonf lower bound −0.006 > −0.02).
- **H2 — NOT_PROVEN**: library transfer's +0.36% quality gain is significant at 95% but not after Bonferroni.
- **H3 — SUPPORTED**: tools beat plain search; mostly because A's 32-sample check lets 75% invalid networks through (by design — it shows why independent evaluation matters).
- Programme status unchanged: **RESEARCH_PROPOSAL — NOT AGI_PROVEN.**

## Honest reading
- H1 is a classical effect (counterexample-guided checking / CEGIS). It validates the harness and the world-model plumbing, not an invention. No novelty claimed.
- **No new discovery**: no network beat a literature best-known size; for sort 9–12 the search never improved on Batcher's construction. Quality >1 means only "smaller than the frozen pruned-Batcher reference" (e.g. median5=7, median7=13, minmax12=16 — all classical optima).
- C/D library construction cost is excluded from cost (contract-declared limitation); C−B log-cost is +0.2% anyway.
- Self-run, one machine, one run; not independently replicated. Toy domain; says nothing about LLM reasoning or general intelligence.
