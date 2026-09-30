# Project memory

## Map

- `packages/web-runtime/src/locales.ts` — donor 2026-09-30. Locale registry, hreflang builder, bidi isolate, and message catalog. Qualification left this file unchanged.
- `tests/web/test_localization_architecture.py` — donor 2026-09-30. Existing localization harness gate.
- `tests/web/test_localization_r1_qualification.py` — created 2026-09-30. R1 oracles for published hreflang, RTL isolation, and untranslated fail-closed behavior.
- `qualification/localization_r1/oracle.mjs` — created 2026-09-30. Executes the donor locale module and records pass or failure strings.
- `qualification/localization_r1/run_l10n1_mutations.py` — created 2026-09-30. Scores L10N1-01 through L10N1-20 on a temporary copy.
- `proofs/localization_r1_20260930/` — created 2026-09-30. Pytest, junit, baseline oracles, mutation results, and the R1 HOLD report.

## Log

### 2026-09-30 — Localization R1 qualification HOLD
- Why: Qualify hreflang publication, RTL fail-closed behavior, and untranslated fail-closed behavior on the Lane H donor. The donor returns English for untranslated locales, accepts an empty catalog string, rewrites zh-Hant and pt-PT, keeps bidi overrides, and emits x-default without a matching published locale URL.
- Files: `tests/web/test_localization_r1_qualification.py` (created), `qualification/localization_r1/` (created), `proofs/localization_r1_20260930/` (created)
- Left: HOLD. Donor runtime stays at `693030a4419d76d7da6a648eb6af5129fcec81f8`.
