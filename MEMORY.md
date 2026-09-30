# Project memory

## Map

- `apps/web/scripts/measure-cwv.mjs` — updated 2026-10-01. Lab CWV scorer. Null and blank vitals stay UNKNOWN. A supplied finite 0 stays a measurement. Unobserved LCP and INP stay unset instead of an invented duration.
- `tests/search/test_cwv_donor_repair.mjs` — created 2026-10-01. Regression for the two Search R1 CWV donor defects.
- `qualification/search_r1/` — created 2026-09-30. Search R1 qualification oracles, fail-closed linters, malformed-signal fixtures, and the SR1-01..SR1-20 mutation harness. Reads the search foundation. The oracles are unchanged.
- `tests/search/test_search_r1_qualification.mjs` — created 2026-09-30. Node test entry for the Search R1 oracles.
- `proofs/search_r1_20260930/` — created 2026-09-30. Qualification HOLD evidence. Left intact on this repair.

## Log

### 2026-10-01 — repair missing and unobserved lab vitals
- Why: Null and blank CWV samples were scored as a passing zero, and unobserved LCP and INP were replaced with invented durations.
- Files: `apps/web/scripts/measure-cwv.mjs` (updated), `tests/search/test_cwv_donor_repair.mjs` (created), `MEMORY.md` (updated)
- Left: re-score SR1-01 through SR1-20 on a clean tree and record the repair proof

### 2026-09-30 — qualify the search foundation donor
- Why: Independent Search R1 qualification of crawl, canonical, sitemap, metadata, schema, and CWV honesty. No live SERP and no Search Console. Donor runtime stays unchanged.
- Files: `qualification/search_r1/` (created), `tests/search/test_search_r1_qualification.mjs` (created), `proofs/search_r1_20260930/` (created), `MEMORY.md` (created)
- Left: HOLD on CWV_MISSING_NULL_OR_BLANK and CWV_UNOBSERVED_NOT_SUBSTITUTED. Do not repair the donor in this lane.
