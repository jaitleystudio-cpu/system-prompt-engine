# SPE Ω — Human Accessibility (WCAG 2.1 AA) Physical Test Protocol

**Target Release:** 2026-10-10 22:10 IST  
**Status:** `TEST PROTOCOL ONLY` (Human execution pending; automated scope qualified)  
**Standard:** W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA  

---

## 1. Governing Principle: Automated $\neq$ Human Verified

Automated scanners (axe-core, Playwright assertions, DOM analyzers) detect at most 30–40% of accessibility barriers. A genuine WCAG 2.1 AA rating requires manual evaluation with real assistive technologies across primary operating systems and browser engines.

```text
STATUS_BOUNDARY:
C8_LIVE_BROWSER_AUTOMATED_SCOPE_PASS = YES
WCAG_2_1_AA_HUMAN_CERTIFICATE        = PENDING_PHYSICAL_AUDIT
```

---

## 2. Test Environments & Assistive Technology Matrix

Physical testing must be conducted on hardware devices with no developer tools open:

| Platform | Screen Reader / AT | Browser Engine | Primary Focus Area |
|---|---|---|---|
| **macOS Sequoia** | Apple VoiceOver | Safari (WebKit) | Rotor landmark navigation, skip-link focus announcement, live region politeness. |
| **macOS Sequoia** | Apple VoiceOver | Google Chrome (Blink) | Focus ring contrast under system Dark/Light mode, modal dialog trap. |
| **Windows 11** | NVDA (Latest) | Microsoft Edge (Blink) | Table/grid navigation in Project Library, keyboard shortcut conflicts. |
| **Windows 11** | JAWS (Latest) | Mozilla Firefox (Gecko) | Virtual cursor traversal, form label associations, error messages. |
| **Android 14** | Google TalkBack | Google Chrome | Touch target size (min $44\times 44\text{ px}$), swipe navigation, 200% font scaling. |
| **iOS / iPadOS 18**| Apple VoiceOver | Safari (Mobile WebKit) | Gesture navigation, dynamic type scaling, orientation changes. |
| **Hardware Switch**| Dual Switch (Space/Enter)| Desktop Chrome | Full workflow completion without mouse or physical keyboard. |

---

## 3. Step-by-Step Human Audit Scenarios

### Scenario 1: Initial Page Landing & Skip-Link Announcement
1. Open SPE Web application in a clean browser session with VoiceOver running.
2. Press `Tab` once from the initial window load.
3. **Pass Criteria:**
   - VoiceOver must explicitly announce: *"Skip to main content, internal link"*.
   - A high-contrast visual outline ($2\text{px}$ solid, contrast ratio $\ge 3:1$) must be visibly positioned at top-left.
4. Press `Enter` or `Space` on the skip link.
5. **Pass Criteria:** Focus shifts directly to `<main id="main">`, and VoiceOver announces the main content area.

### Scenario 2: Universal Input Shell Modal Focus Trap & Escape Close
1. Navigate via keyboard to the Mode Selector trigger (`Enter` or `Space`).
2. Modal opens with `role="dialog"` and `aria-modal="true"`.
3. **Pass Criteria:**
   - Initial focus lands on the currently active mode radio/tab.
   - Repeated `Tab` navigation cycles through the modal controls without escaping to background elements.
   - Pressing `Shift+Tab` cycles backwards and wraps from the first element to the last.
   - Background content is marked `inert` or `aria-hidden="true"`.
4. Press `Escape`.
5. **Pass Criteria:**
   - Modal closes immediately.
   - Focus returns cleanly to the triggering button.

### Scenario 3: 400% Zoom & Text Reflow (WCAG 1.4.10)
1. In desktop browser, set browser zoom to $400\%$ at $1280\times 1024\text{ px}$ viewport (equivalent to $320\text{ px}$ CSS width).
2. Inspect the Project Library, Universal Shell, and Authority Hub.
3. **Pass Criteria:**
   - Content reflows into a single column.
   - Zero horizontal scrolling required to read text or operate controls.
   - Zero content overlapping, clipping, or truncated text.

### Scenario 4: High Contrast Theme & Focus Visibility (WCAG 1.4.11)
1. Enable Windows High Contrast Black or macOS "Increase Contrast" mode.
2. Toggle SPE theme between Light and Dark.
3. **Pass Criteria:**
   - Custom focus rings (`2px solid rgb(187, 206, 255)` in dark, `rgb(59, 130, 246)` in light) remain distinct with contrast $\ge 3:1$ against adjacent background colors.
   - Icons and borders retain sufficient visual definition.

---

## 4. Documentation & Attestation Deliverables

Upon completion of the physical audit by a certified accessibility specialist (CPACC or WAS certification):
1. Issue formal **VPAT 2.4 (Revised Section 508 / WCAG)** document.
2. Record human auditor signatures, test device serials, and exact browser/AT version numbers.
3. Only then may the status advance to `WCAG_2_1_AA_HUMAN_QUALIFIED`.
