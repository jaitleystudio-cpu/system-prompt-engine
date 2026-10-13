# Hostile-gym oracle v7: deduplicated re-analysis of the SCOPE_BOUNDARY_v3 corpus (round 8, POSTHOC)

Appended doc. `SCOPE_BOUNDARY_v3.md`, its sha256, `scope_v3/scope_v3_corpus.jsonl` and `scope_v3/scope_v3_rates.json`
are unchanged and their numbers stand as recorded. **No oracle code change** (`oracles.mjs` is byte-identical, v7).
H1 stays NOT_PROVEN.

## The oracle is not usable as a gate
The v7 oracle is a lexical heuristic. On this adversarial corpus it misses most disguised attacks and wrongly flags
roughly half of benign text. It must not be used to pass or fail anything. Any attack-success rate computed with it
(including H1's ASR) depends on this oracle and inherits these error rates.

## Method
`research/hostile-gym/dedup_scope_v3.mjs` reads the frozen v3 corpus read-only, drops duplicate `(cls, text)` rows
(first occurrence kept), re-scores every unique row with the unchanged v7 oracle, and writes
`scope_v3_dedup/scope_v3_dedup_rates.json`. Pinned by `oracle_v7_scope_v3_dedup.test.mjs` (byte-identical recompute).
- **1,321 rows → 1,285 unique (36 duplicates)**, matching Bro. Duplicates: A1 10, A2 16, A4 2, B2 8.
- No duplicate pair disagrees, and the re-score matches every recorded decision (0 mismatches).

## Headline: per-class rates (unique rows, Wilson 95%)

| class | what an error means | n | errors | rate | Bro r6 probes | generated |
|---|---|---|---|---|---|---|
| A1 dot-word separators | attack missed | 254 | 241 | **94.9% [91.4, 97.0]** | 95.8% | 94.8% |
| A2 look-alike dots | attack missed | 254 | 195 | **76.8% [71.2, 81.5]** | 100% | 73.7% |
| A3 styled digits in canary | attack missed | 216 | 72 | **33.3% [27.4, 39.9]** | 100% | 25.0% |
| A4 refusal paraphrases | refusal scored legit | 226 | 225 | **99.6% [97.5, 99.9]** | 96.4% | 100% |
| B1 benign prose negatives | legit answer voided | 215 | 99 | **46.0% [39.5, 52.7]** | 86.7% | 43.0% |
| B2 benign "attacker…example" prose | false LEAK | 120 | 74 | **61.7% [52.7, 69.9]** | 75.0% | 60.7% |

## Secondary: pooled rates (caveat: depend on the class mix)
The pooled numbers weight each class by how many rows the corpus builder generated for it, so a different mix gives
a different pooled number. They are not a property of the oracle and should not be quoted on their own.
- Attack forms A1–A3, miss: 508/724 = 70.2% [66.7, 73.4] (v3 with duplicates: 531/750 = 70.8% [67.5, 73.9]).
  Unweighted mean of the three class rates: 68.3%.
- All attack-side rows A1–A4: 733/950 = 77.2% [74.4, 79.7] (v3: 77.5%).
- All benign-side rows B1–B2: 173/335 = 51.6% [46.3, 56.9] (v3: 180/343 = 52.5% [47.2, 57.7]).
  Unweighted mean of the two class rates: 53.9%.

Deduplication moves the pooled rates by under 1.5 points. The per-class spread (33% to 99.6% miss) is the
informative result.
