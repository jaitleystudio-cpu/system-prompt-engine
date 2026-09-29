# Project memory

## Map

- `spe_runtime/privacy/aggregates.py` — created 2026-09-30 — pre-aggregated country, session, referrer, and feature observations
- `spe_runtime/privacy/analytics.py` — updated 2026-09-30 — registry holds those observations; collector stays NONE
- `spe_runtime/privacy/refusals.py` — updated 2026-09-30 — refuse exact location and session-history keys
- `spe_runtime/privacy/checklist.py` — updated 2026-09-30 — observation rows stay UNKNOWN until evidence
- `spe_runtime/privacy/__init__.py` — updated 2026-09-30 — export the observation contract
- `tests/unit/test_privacy_analytics.py` — created 2026-09-30 — deterministic contract suite
- `tests/unit/test_privacy_analytics_mutation.py` — created 2026-09-30 — N-R1-01 through N-R1-20 killers
- `docs/architecture/privacy-analytics-v1.md` — updated 2026-09-30 — document the aggregate observation contract

## Log

### 2026-09-30 — privacy analytics tests and aggregate observations
- Why: replace the invalid pass claim with a suite that matches the code, and add only pre-aggregated observations that stay UNKNOWN without evidence
- Files: `spe_runtime/privacy/aggregates.py` (created), `spe_runtime/privacy/analytics.py` (updated), `spe_runtime/privacy/refusals.py` (updated), `spe_runtime/privacy/checklist.py` (updated), `spe_runtime/privacy/__init__.py` (updated), `tests/unit/test_privacy_analytics.py` (created), `tests/unit/test_privacy_analytics_mutation.py` (created), `docs/architecture/privacy-analytics-v1.md` (updated)
- Left: none
