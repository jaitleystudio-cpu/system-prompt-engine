# R8-CVG-1 continuation — 2026-10-05 IST

Verdict: R8_NOT_READY. This is a bounded first-cause repair, not a qualified release candidate.
Branch: chatgpt/r8-cvg1-20261005. Baseline: 7e09f68daf5a09905bf50abfc5f145bece9e5a55.

## Mission, decomposition and evidence plan

Inspect exact-head CI after the OCR pytest-helper and extracted SkipLink repairs; preserve each donor; reproduce the next mandatory failure; repair its first substantive truth defect; keep all gates enabled. No architecture, main merge, deployment or release. Exact R8 scope and external qualification remain mandatory.

The baseline CI is run 37242200126, bound to baseline-ci.json and baseline-ci-full.log. Python: 1147 passed in 86.07s. Rust and engine jobs passed. Web build failed before compilation: LANGUAGE_PERSPECTIVE_GATE reported 3350 candidates, 938 unreviewed entries and 6 additional risk violations.

## Source interrogation, contradictions and hypotheses

Foundational authority: docs/human-perspective/SPEC.md, CONSTITUTION.md and REPORT.md. These require deliberate editorial review, prohibit inventing empirical truth, and distinguish assistant assessments from participant studies. Current evidence: the exact-head CI logs, current inventory/gate/policy, all three authority records, both renderers, and existing authority tests. No external literature claim is needed to adjudicate these repository contracts. This pass does not pretend to have reviewed all 938 strings or completed the full product claims audit.

Hypotheses and adversarial elimination:

1. OCR collection still fails — eliminated by exact-head full Python CI.
2. Extracted SkipLink still fails — eliminated by exact-head full Python CI.
3. Stale CI was inspected — eliminated by equality of run head and baseline SHA.
4. Donor commits were lost — eliminated for base/OCR/WebRecon/WebGL/research by ancestry checks in custody.json.
5. Gate approvals lag the integrated source — confirmed: 938 entries lack exact review IDs/text/depth.
6. Scanner includes internal literals — confirmed by conservative inventory; existing policy intentionally includes them. No exclusion added.
7. Automatically regenerating approvals would repair the defect — rejected: the governing report explicitly forbids automatic approvals.
8. All authority measurements have attributable receipts — rejected: cited paths/repository do not bind the claimed results to this candidate; no receipts supplied for the three records.
9. Passing structural authority tests proves measurement truth — rejected: existing tests check fields and route isolation, not empirical custody.
10. Changing status alone makes the UI honest — rejected: article prose/card totals and verification timestamps also asserted unsupported truth.
11. Missing human ratings can be inferred from editorial screening — rejected: human ratings remain NO_RATINGS_YET.
12. Local network-test failures establish product failure — unresolved by sandbox run; separate scoped recheck required.
13. Linux canonical CI proves local canonical reproducibility — rejected: local size mismatch remains independently observed, and the exact size/hash gate stays unchanged.
14. A copy-only repair qualifies R8 — rejected: donor completeness, full journeys and external evidence remain unverified.

Strongest surviving repair: demote only the three unreceipted authority records to existing provisional status, expose UNKNOWN measurement fields, clear invented receipt links, correct unsupported measured prose/card labels and absent-date rendering. Preserve the original registry byte-for-byte in authority-registry-before.ts. No alternate verifier or new architecture.

## TDD and measured evidence

- New real registry + static React rendering test: authority-red.log reproduces verified != provisional before implementation; authority-green.log passes afterward.
- Test asserts all three IDs, provisional status, UNKNOWN measurements/dates, absent receipt links, zero verified card counts, honest guide descriptions and absent-date rendering. Mutation targets: status promotion, invented results/receipts and misleading labels.
- Existing Authority Hub contract test passes. Workflow adds the new truth test; all prior checks remain.
- Copy adversarial tests pass: unreviewed text and prohibited claims still rejected.
- Local Rust suites pass: 41 core tests and 4 wrapper tests.
- Real-WASM engine fixture passes with no fallback, SHA-256 b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b.
- Full local Python regression: 1144 passed, 3 failed. Exact failed tests:
  - tests/release/test_wasm_canonical_supply_chain.py::test_dirty_candidate_is_rebuilt_and_not_trusted — local rebuilt size 1339801 differs from frozen expected 1340112. Gate unchanged.
  - tests/unit/test_r6_scoped_live_fetch.py::test_one_real_scoped_live_fetch — DEGRADED rather than LIVE_FETCH_SCOPED in restricted network run.
  - tests/unit/test_webrecon_scoped_example.py::test_grant_fetches_example_com_and_records_real_digest — FETCH_FAILED in restricted network run.
- Network-enabled full-suite retry was rejected by automatic review for possible transmission of a test-marked private payload. Source inspection and a no-socket capture then proved the scoped test sends only two public DOI GETs, no body and no private sentinel (network-preflight.json). A narrower two-test retry was approved and both tests passed in 2.80s; its actual result is in scoped-live-recheck.log. This is not a second full-suite PASS.
- Independent review: no substantive issue or weakened gate found in the bounded diff; archive matched baseline bytes, digest de5953832548483d5ac48c40c07ae66abdb4765002ebea1e69e7a078c9d59714. Review was static/rendered-server evidence only, not interactive browser or whole-R8 qualification.

## First exact remaining mandatory defect

npm run build still stops in LANGUAGE_PERSPECTIVE_GATE: 3324 candidates, 912 unreviewed strings and one TECHNICAL_JARGON violation (apps/web/src/library/ProjectLibraryView.tsx: SHA-256 Digest). copy-after-truth-repair.json lists every entry. The first unreviewed entry is apps/web/src/a11y/focusOnView.ts: main. No gate exclusions, thresholds, automatic approvals or broad acceptance were added.

Downstream typecheck probe (the build did not reach it):
- src/engine/continuation/oracleGuards.ts:14 — unused ClaimRecord.
- src/engine/continuation/types.ts:12 — missing ../targetModelConfig.
- src/website/productFlow.ts:357 — LOCAL_EXPORT_READY compared with REJECTED.
These remain recorded, not bundled into the first-cause repair.

## Custody, unknowns and rulings

Ruling: preserve original authority source as archived evidence, while correcting current unsupported output — avoids rewriting historical custody; cost if wrong: a supplied valid receipt would permit restoration of a precisely scoped result.
Ruling: do not refresh the whole approved copy inventory — this pass did not complete contextual review of every donor string; cost: build remains correctly red.
Ruling: do not replace canonical expected size/hash from local rebuild — local reproducibility is unresolved; cost: local release supply-chain test remains red.
Ruling: record downstream compiler defects without bundling fixes before the copy gate — cost: another bounded repair pass is required.

Human ratings: NO_RATINGS_YET. External vendor / pen-test / payment states: UNKNOWN. Vision donor integration and complete R7 scope: NOT_VERIFIED_IN_THIS_RUN. No candidate freeze, R8 PASS, main merge, deployment, release, founder-authority promotion, interactive accessibility conformance or independent human study is claimed.

Deferred minors: none identified in the independent bounded review.
