# Acceptance matrix (categories as interpreted; owner A–T definitions partly truncated)
| Cat | Area | Verdict | Basis |
|---|---|---|---|
| A | Custody/build | PASS | SHA frozen, build exit 0; reproducibility NOT_TESTED |
| B | Technical SEO | FAIL | titles/desc/canonical/JSON-LD ok, Lighthouse SEO 100; PH-006, PH-007 |
| C | UI (viewports) | FAIL | PH-012; 2 viewports Chromium only |
| D | UX journeys | FAIL | PH-008 (/studio dead) |
| E | Accessibility WCAG 2.2 AA (automated) | FAIL | PH-003, PH-004 |
| F | Screen reader / human a11y | BLOCKED | no human/SR available |
| G | Performance (lab) | FAIL | PH-005 |
| H | Field CWV | NOT_AVAILABLE | pre-launch |
| I | Stress (local) | PASS (to 250 conns) | see measurements |
| J | Stress at 10k / intended arch | BLOCKED | arch not deployed |
| K | Security deps | FAIL | PH-010 |
| L | Security headers/CSP | PASS (config) / NOT_TESTED on host | _headers + meta CSP blocked inline script injection |
| M | Privacy egress | PASS | 0 third-party requests across 20 page loads; audit:egress, test:truth-privacy pass |
| N | Claims/copy truth | FAIL | PH-001, PH-002 |
| O | Functionality / dead controls | FAIL | PH-008, PH-013 (partial) |
| P | Regression (repo suites sampled) | PASS (10/10 sampled scripts) | full suite NOT_RUN |
| Q | Cross-browser Firefox/WebKit | NOT_TESTED | not installed in r1 |
| R | Real devices | NOT_TESTED | none |
| S | Human usability | BLOCKED | no participants |
| T | Independent evidence replay | PENDING | needs Bro / independent agent |
Counts: PASS 5 · FAIL 9 · BLOCKED 3 · NOT_TESTED 2 · NOT_AVAILABLE 1 · PENDING 1 (T).
