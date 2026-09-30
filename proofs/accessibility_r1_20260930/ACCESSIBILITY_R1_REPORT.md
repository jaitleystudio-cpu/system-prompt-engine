# SPE CURSOR C8 ACCESSIBILITY R1 REPORT

DONOR_BRANCH: antigravity/spe-accessibility-v1-20260930
DONOR_SHA: 3a04d7fb99ed6967995073d1c26661008f52ab93
PR_NUMBER: NONE
QUALIFICATION_BRANCH: cursor/spe-accessibility-r1q-20260930
QUALIFICATION_HEAD: tip of cursor/spe-accessibility-r1q-20260930 that contains this file
HUMAN_QUALIFICATION: NOT_PERFORMED
HUMAN_SCREEN_READER: NOT_PERFORMED
AUTOMATED_TESTS_ARE_HUMAN_QUALIFICATION: false
UNKNOWN_IS_PASS: false
WCAG_CERTIFICATE: NOT_A_CERTIFICATE
WCAG_LEVEL: NOT_CERTIFIED
WCAG_AAA: NOT_CLAIMED
SEMANTIC_AUTHORITY: NONE
MERGE: NO
DEPLOY: NO
HOST: NO
MAIN: NO
I2: NO

No pull request is open for `antigravity/spe-accessibility-v1-20260930`. The remote head is `3a04d7fb99ed6967995073d1c26661008f52ab93`. This lane did not open one.

The donor harness prints `ALL WCAG 2.1 AA ACCESSIBILITY AUDIT CHECKS PASSED` and `200% zoom and small-screen reflow rules verified.` Those lines stay in the donor file. This qualification does not treat them as a certificate. No contrast ratio was measured. No human screen-reader session was run. Reduced-motion behavior was not executed.

## Evidence

| Boundary | Verdict |
| --- | --- |
| Skip link to `#main` | STATIC_ASSERTED |
| Escape closes the open menu | SOURCE_PRESENT |
| Keyboard trap | UNKNOWN |
| Dual-theme `:focus-visible` rings | STATIC_ASSERTED |
| Focus on the skip target (`main:focus { outline: none }`) | NOT_VISIBLE |
| Focus retained | NOT_CLAIMED |
| Contrast | UNMEASURED |
| Reduced-motion CSS kill switch | STATIC_ASSERTED |
| Reduced-motion effect | UNKNOWN |
| 200% zoom reflow | NOT_EVIDENCED |
| Live region markup | STATIC_ASSERTED |
| Error announced | UNKNOWN |
| `html lang="en"` | SOURCE_PRESENT |
| Heading order | UNKNOWN |
| Menu control | NATIVE_BUTTON |
| Story autoplay | GATED_IN_SOURCE_UNTESTED |
| Control names | NOT_EXHAUSTIVE |
| Human screen reader | NOT_PERFORMED |

A `@media (max-width: 360px)` rule exists. That is not a 200% zoom measurement. The CSS reduced-motion block and the donor string test exist. That is not a runtime proof that animation stops. `HeroStory` returns before its timer when `reduced` is set. No test drives that flag.

## Tests

Command: `pytest tests/web/test_accessibility_compliance.py tests/qualification/test_accessibility_r1.py -q --tb=short`

| Suite | Result |
| --- | --- |
| Donor `tests/web/test_accessibility_compliance.py` | 5 passed |
| Qualification `tests/qualification/test_accessibility_r1.py` | 27 passed |
| Combined | 32 passed, 0 failed, 0 skipped, 0 errors |

Pytest summary: `32 passed in 2.10s`.

## Mutants

Defined A11Y1-01 through A11Y1-20. Killed 20. Survived 0.

| ID | Fault | Result |
| --- | --- | --- |
| A11Y1-01 | focus lost on the skip target marked retained | KILLED |
| A11Y1-02 | keyboard trap accepted | KILLED |
| A11Y1-03 | skip link removed | KILLED |
| A11Y1-04 | unlabeled control marked pass | KILLED |
| A11Y1-05 | contrast invented | KILLED |
| A11Y1-06 | reduced-motion ignored | KILLED |
| A11Y1-07 | zoom reflow claimed without evidence | KILLED |
| A11Y1-08 | aria-hidden on a focusable control accepted | KILLED |
| A11Y1-09 | heading order invented | KILLED |
| A11Y1-10 | name missing becomes pass | KILLED |
| A11Y1-11 | error not announced marked complete | KILLED |
| A11Y1-12 | motion autoplay forced | KILLED |
| A11Y1-13 | semantic button made a div and marked pass | KILLED |
| A11Y1-14 | language missing marked pass | KILLED |
| A11Y1-15 | human screen-reader session fabricated | KILLED |
| A11Y1-16 | unknown becomes pass | KILLED |
| A11Y1-17 | semantic authority elevated | KILLED |
| A11Y1-18 | WCAG AAA certificate invented | KILLED |
| A11Y1-19 | donor harness log accepted as a certificate | KILLED |
| A11Y1-20 | audit marked complete without a human session | KILLED |

FINAL: ACCESSIBILITY_R1_QUALIFICATION_PASS
