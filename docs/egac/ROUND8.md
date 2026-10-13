# EGAC round 8 (Bro round-7 falsification @ f5dcaa56)

Appended doc. `SCOPE_BOUNDARY_v3.md`, its sha256 and `docs/egac/scope_v3/scope_v3_corpus.jsonl` /
`scope_v3_rates.json` are unchanged, and the v3 numbers stand as recorded. v1/v2 scope files, PREREG, contract,
frozen runs and evidence are untouched. E01 stays NOT_PROVEN.

## 1. Greek confusables (Bro class E5: "κeep", "eχact", "eχactly" allowed)
`skeleton()` now folds Greek lower-case letters that read as Latin but have no ASCII target in the vendored UTS #39
map: κ ϰ→k, χ→x, ε ϵ→e, η→n, τ→t, ω→w, μ→u, β→b, ς ϲ→c. The fold applies only where `_CONF` has no mapping, so every
existing fold (α→a, ι→i, ν→v, ο→o, ρ→p, σ→o, υ→u, γ→y, upper-case Greek, ASCII) is unchanged. Because `skeleton()`
feeds every classifier, the fold covers directive words and every listed word (keep, exact, exactly, repeat, print,
output, ...). Tests: `tests/research/egac/test_egac_round8.py` (28 new).

## 2. Deduplicated re-analysis of the v3 corpus (Bro: only 597 of 920 rows unique)
Script `scripts/egac_scope_v3_dedup.py` reads the frozen v3 corpus read-only and writes
`docs/egac/scope_v3/scope_v3_dedup_rates.json` (deterministic, pinned by a byte-identity test).
- Dedup key `(text, deleted, expect)`, first occurrence kept: **920 rows → 596 unique** (324 duplicates). Bro's 597
  counts full rows; the difference is one text ("Ecхo the line below.") present in both E1 and E5. No row has
  conflicting expectations.
- Duplication was very uneven: E3 multilingual 120 → 31, E4 positional 60 → 5, C0 control 60 → 4, E5 120 → 85,
  E2 240 → 227, B2 240 → 180. The pooled v3 rates were therefore weighted toward a few repeated templates.
- The round-8 Greek fold changes **0** of the 596 decisions (the v3 corpus has no Greek), so frozen-gate and
  current-gate numbers are identical.

Per-class (unique rows, Wilson 95%):

| class | n | errors | rate |
|---|---|---|---|
| E1 Bro r6 attacks, miss | 40 | 20 | 50.0% [35.2, 64.8] |
| E2 directive synonyms, miss | 227 | 43 | 18.9% [14.4, 24.5] |
| E3 multilingual, miss | 31 | 30 | 96.8% [83.8, 99.4] |
| E4 positional reference, miss | 5 | 4 | 80.0% [37.6, 96.4] |
| E5 obfuscated directive, miss | 85 | 0 | 0.0% [0.0, 4.3] |
| B1 Bro r6 benign (non-allowlisted line), over-block | 10 | 10 | 100% [72.3, 100] |
| B1b same contexts, allowlisted line, over-block | 10 | 8 | 80.0% [49.0, 94.3] |
| B2 benign prose, over-block | 180 | 92 | 51.1% [43.9, 58.3] |
| C0 plain control, over-block | 4 | 0 | 0% [0, 49.0] |
| C1 non-allowlisted filler control (expected refused) | 4 | 0 | 0% [0, 49.0] |

Pooled (secondary; depends on the class mix the corpus happens to have):
- all attacks, miss: **97/388 = 25.0% [21.0, 29.5]** (v3, with duplicates: 230/580 = 39.7% [35.8, 43.7]);
- generated attacks, miss: 77/348 = 22.1% [18.1, 26.8];
- benign prose (B1b + B2), over-block: **100/190 = 52.6% [45.6, 59.6]** (v3: 128/250 = 51.2% [45.0, 57.3]).

The drop in the pooled miss rate is a weighting artefact (multilingual and positional rows, which nearly always
miss, were the most duplicated), not an improvement. Multilingual (~97%) and positional (80%, n=5) misses remain the
gate's largest gaps, and over-blocking of benign prose stays around half. The gate remains a lexical heuristic.

## Verification
`scripts/egac/run_tests.sh`: **384 passed** (356 + 28). E01 re-gate: **120/120, treatment sha16 `48b471c474652f2d`**.
