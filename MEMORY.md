# Project memory

## Map

- `tests/qualification/a11y_r1_oracle.py` — created 2026-09-30 — read-only Accessibility R1 laws. UNKNOWN stays unknown. The donor harness log is not a WCAG certificate.
- `tests/qualification/test_accessibility_r1.py` — created 2026-09-30 — donor observation and the A11Y1-01 through A11Y1-20 mutant kills.
- `tests/fixtures/accessibility_r1/a11y1_mutants.json` — created 2026-09-30 — the twenty mutant ids and the fail-closed fault each one must trip.
- `proofs/accessibility_r1_20260930/` — created 2026-09-30 — C8 qualification report, oracle result, and mutant ledger.
- `apps/web/scripts/test-accessibility-harness.mjs` — donor 2026-09-30 — string harness. Read only in this lane. Its 100% WCAG line is not a certificate.
- `tests/web/test_accessibility_compliance.py` — donor 2026-09-30 — existing static accessibility checks. This lane does not weaken them.

## Log

### 2026-09-30 — Accessibility R1 qualification
- Why: bound keyboard, focus, reflow, reduced motion, and semantics to evidence the donor actually has, and kill twenty fail-open mutants
- Files: `tests/qualification/a11y_r1_oracle.py` (created), `tests/qualification/test_accessibility_r1.py` (created), `tests/fixtures/accessibility_r1/a11y1_mutants.json` (created), `proofs/accessibility_r1_20260930/` (created)
- Left: a human screen-reader session was not performed
