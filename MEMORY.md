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
- `docs/architecture/privacy-binding-preflight-i11.md` — created 2026-09-30 — map Lane N into future I11 touch points, each NOT_WIRED
- `tests/unit/test_privacy_binding_preflight.py` — created 2026-09-30 — lock collector NONE, evidence gates, and the unwired I11 map
- `proofs/privacy_binding_preflight_20260930/C10_REPORT.md` — created 2026-09-30 — C10 preflight custody and test counts

## Log

### 2026-09-30 — privacy binding preflight map
- Why: record how Lane N would later bind into I11, and lock the qualified contract without wiring it
- Files: `docs/architecture/privacy-binding-preflight-i11.md` (created), `tests/unit/test_privacy_binding_preflight.py` (created), `proofs/privacy_binding_preflight_20260930/C10_REPORT.md` (created)
- Left: I11 implementation stays unwired

### 2026-09-30 — privacy analytics tests and aggregate observations
- Why: replace the invalid pass claim with a suite that matches the code, and add only pre-aggregated observations that stay UNKNOWN without evidence
- Files: `spe_runtime/privacy/aggregates.py` (created), `spe_runtime/privacy/analytics.py` (updated), `spe_runtime/privacy/refusals.py` (updated), `spe_runtime/privacy/checklist.py` (updated), `spe_runtime/privacy/__init__.py` (updated), `tests/unit/test_privacy_analytics.py` (created), `tests/unit/test_privacy_analytics_mutation.py` (created), `docs/architecture/privacy-analytics-v1.md` (updated)
- Left: none
