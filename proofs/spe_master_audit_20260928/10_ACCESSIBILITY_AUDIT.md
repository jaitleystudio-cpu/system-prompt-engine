# Accessibility audit

Target posture: WCAG 2.2 AA. This audit does not claim conformance.

## Automated evidence this SHA

- `test:predeploy-qa` passed source checks: viewport meta, focus-visible, reduced motion, touch targets, zoom-safe, landmarks.
- Hero suite second run: 62 checks, including keyboard pause, reduced motion, and dark/light/system.
- `test:theme-routes` EXIT 0.
- Execution-contract test asserts `aria-pressed` for simple and inspect in source.
- e2e v1 failed: timeout clicking a Create button inside `#spe-primary-nav`. Header was not modified.

## Not re-run

Home contrast axe from the closure commit is inside `e0497f7` and was not executed again. 200% zoom was not re-measured live. Reflow was not measured.

## Human screen reader

HUMAN_SCREEN_READER_EVIDENCE: absent.
ACCESSIBILITY_HUMAN: NO
ACCESSIBILITY_AUTOMATED: PARTIAL
