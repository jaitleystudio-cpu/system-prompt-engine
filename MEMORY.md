# Project memory

## Map

- `qualification/search_r1/` — created 2026-09-30. Search R1 qualification oracles, fail-closed linters, malformed-signal fixtures, and the SR1-01..SR1-20 mutation harness. Reads the search foundation. Does not change it.
- `tests/search/test_search_r1_qualification.mjs` — created 2026-09-30. Node test entry for the Search R1 oracles. A failure is preserved donor evidence.
- `proofs/search_r1_20260930/` — created 2026-09-30. Qualification and mutation proof. Result is HOLD: null and blank CWV samples become a passing zero, and unobserved lab vitals are substituted.

## Log

### 2026-09-30 — qualify the search foundation donor
- Why: Independent Search R1 qualification of crawl, canonical, sitemap, metadata, schema, and CWV honesty. No live SERP and no Search Console. Donor runtime stays unchanged.
- Files: `qualification/search_r1/` (created), `tests/search/test_search_r1_qualification.mjs` (created), `proofs/search_r1_20260930/` (created), `MEMORY.md` (created)
- Left: HOLD on CWV_MISSING_NULL_OR_BLANK and CWV_UNOBSERVED_NOT_SUBSTITUTED. Do not repair the donor in this lane.
