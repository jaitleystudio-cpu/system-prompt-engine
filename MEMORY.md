# Project memory

## Map

- `packages/web-runtime/src/locales.ts` — updated 2026-10-01. Locale registry. x-default follows a published URL, bidi overrides are refused, and a missing translation stays untranslated.
- `apps/web/scripts/test-localization-harness.mjs` — updated 2026-10-01. Architecture harness requires the fail-closed hreflang, RTL, and untranslated laws.
- `tests/web/test_localization_architecture.py` — donor 2026-09-30. Existing localization harness gate. Assertions were not weakened.
- `tests/web/test_localization_r1_qualification.py` — created 2026-09-30. R1 oracles for published hreflang, RTL isolation, and untranslated fail-closed behavior. Assertions were not weakened.
- `qualification/localization_r1/oracle.mjs` — created 2026-09-30. Executes the locale module and records pass or failure strings.
- `qualification/localization_r1/run_l10n1_mutations.py` — updated 2026-10-01. Scores L10N1-01 through L10N1-20 against the repaired module and writes the repair proof.
- `proofs/localization_r1_20260930/` — created 2026-09-30. Donor HOLD evidence. Left unchanged by the repair.

## Log

### 2026-09-30 — Localization R1 qualification HOLD
- Why: Qualify hreflang publication, RTL fail-closed behavior, and untranslated fail-closed behavior on the Lane H donor. The donor returns English for untranslated locales, accepts an empty catalog string, rewrites zh-Hant and pt-PT, keeps bidi overrides, and emits x-default without a matching published locale URL.
- Files: `tests/web/test_localization_r1_qualification.py` (created), `qualification/localization_r1/` (created), `proofs/localization_r1_20260930/` (created)
- Left: HOLD. Donor runtime stays at `693030a4419d76d7da6a648eb6af5129fcec81f8`.

### 2026-10-01 — Localization R1 donor repair
- Why: Empty publication still emitted x-default, a published Spanish route left x-default on the English URL, bidi overrides stayed inside the isolate, and missing translations became English or a different script or region.
- Files: `packages/web-runtime/src/locales.ts` (updated), `apps/web/scripts/test-localization-harness.mjs` (updated), `qualification/localization_r1/run_l10n1_mutations.py` (updated)
- Left: score L10N1-01 through L10N1-20 and record the repair proof.
