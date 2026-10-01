# SPE Ω — Accessibility Conformance Report (VPAT® 2.5Rev WCAG Edition)

**Name of Product:** System Prompt Engine (SPE) Web Application  
**Report Date:** 2026-10-01  
**Product Version:** Staging Round-2 Qualified Lineage (`cabe1aa` / PR #88)  
**Evaluation Standard:** Web Content Accessibility Guidelines (WCAG) 2.1 Level A & Level AA  
**Evaluation Methodology:** W3C WCAG-EM 2.0 (Automated Live Browser Execution + Scheduled Manual Assistive Technology Audit)  
**Contact Information:** engineering@system-prompt-engine.internal  

---

## 1. Terms & Conformance Level Definitions

The terms used in the Conformance Level information are defined as follows:
- **Supports:** The functionality of the product has at least one method that meets the criterion without known defects or barriers.
- **Partially Supports:** Some functionality of the product does not meet the criterion.
- **Does Not Support:** The majority of product functionality does not meet the criterion.
- **Not Applicable:** The criterion is not relevant to the product.

```text
EVIDENCE BOUNDARY:
- AUTOMATED_SCOPE_STATUS  = SUPPORTS (Verified via headless & live Chrome Playwright harness)
- PHYSICAL_AT_AUDIT_STATUS = SCHEDULED (Physical testing with VoiceOver/NVDA/TalkBack pending human tester)
```

---

## 2. Principle 1: Perceivable

| Criteria | Conformance Level | Remarks & Explanations |
|---|---|---|
| **1.1.1 Non-text Content (Level A)** | **Supports** | All functional icons and image elements provide meaningful `aria-label` or `alt` text. Decorative icons are marked `aria-hidden="true"`. |
| **1.2.1 Audio-only and Video-only (Prerecorded) (Level A)** | **Not Applicable** | The application does not distribute prerecorded video or audio media files. |
| **1.2.2 Captions (Prerecorded) (Level A)** | **Not Applicable** | No prerecorded synchronized media present. |
| **1.2.4 Captions (Live) (Level AA)** | **Not Applicable** | In accordance with system law, `LIVE_TRANSCRIPTION_STATUS = UNAVAILABLE`. |
| **1.3.1 Info and Relationships (Level A)** | **Supports** | Semantic HTML5 elements (`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`) are used throughout. Heading hierarchies (`<h1>` to `<h3>`) are strictly sequential. Modal dialogs enforce `role="dialog"` and `aria-modal="true"`. |
| **1.3.2 Meaningful Sequence (Level A)** | **Supports** | DOM order matches the visual reading order across all viewport dimensions. |
| **1.3.3 Sensory Characteristics (Level A)** | **Supports** | Instructions and status feedback do not rely exclusively on shape, size, visual location, or sound. |
| **1.3.4 Orientation (Level AA)** | **Supports** | Content does not restrict its view and operation to a single display orientation (portrait or landscape). |
| **1.3.5 Identify Input Purpose (Level AA)** | **Supports** | Form inputs utilize standard `type`, `autocomplete`, and descriptive `name` attributes. |
| **1.4.1 Use of Color (Level A)** | **Supports** | Color is never used as the sole visual means of conveying information, indicating an action, or distinguishing a visual element. Status badges combine color with text and SVG icons. |
| **1.4.2 Audio Control (Level A)** | **Not Applicable** | The application does not play audio automatically. |
| **1.4.3 Contrast (Minimum) (Level AA)** | **Supports** | Text and images of text maintain a contrast ratio of at least $4.5:1$ for normal text and $3.0:1$ for large text against both light and dark themes. |
| **1.4.4 Resize Text (Level AA)** | **Supports** | Content can be zoomed to $200\%$ using standard browser zoom controls without loss of content or functionality. |
| **1.4.10 Reflow (Level AA)** | **Supports** | Layouts support responsive reflow down to $320\text{px}$ CSS width ($360\times 800\text{px}$ standard mobile viewport) without vertical or horizontal scroll bars truncating content. |
| **1.4.11 Non-text Contrast (Level AA)** | **Supports** | Active user interface components and graphical objects maintain a contrast ratio of at least $3.0:1$ against adjacent colors. |
| **1.4.12 Text Spacing (Level AA)** | **Supports** | No loss of content or functionality occurs when line height, letter spacing, and word spacing are expanded to WCAG 1.4.12 parameters. |
| **1.4.13 Content on Hover or Focus (Level AA)** | **Supports** | Tooltips and popovers are dismissible via `Escape`, hoverable without disappearing, and persistent until dismissed. |

---

## 3. Principle 2: Operable

| Criteria | Conformance Level | Remarks & Explanations |
|---|---|---|
| **2.1.1 Keyboard (Level A)** | **Supports** | All application workflows (mode switching, library filtering, workflow copying, screenshot viewing) are operable via standard keyboard interface (`Tab`, `Shift+Tab`, `Space`, `Enter`, `Escape`). |
| **2.1.2 No Keyboard Trap (Level A)** | **Supports** | Modal dialogs contain focus in a loop while open and cleanly release focus to the triggering element upon pressing `Escape` or activating the close button. |
| **2.1.4 Character Key Shortcuts (Level A)** | **Supports** | Single-character shortcuts are either disabled or scoped strictly to active form controls. |
| **2.2.1 Timing Adjustable (Level A)** | **Not Applicable** | The application does not impose arbitrary user session timeouts or countdown timers on user input. |
| **2.2.2 Pause, Stop, Hide (Level A)** | **Supports** | Any moving, blinking, or scrolling content respects `prefers-reduced-motion: reduce` and halts immediately. |
| **2.3.1 Three Flashes or Below Threshold (Level A)** | **Supports** | The application contains zero strobing, flashing, or rapid visual transitions exceeding 3 flashes per second. |
| **2.4.1 Bypass Blocks (Level A)** | **Supports** | A high-contrast Skip Link (`#skip-to-main`) is positioned as the very first focusable element on the page, immediately transferring keyboard and screen-reader focus to `<main id="main">`. |
| **2.4.2 Page Titled (Level A)** | **Supports** | The single-page application updates document titles dynamically to describe current views and states. |
| **2.4.3 Focus Order (Level A)** | **Supports** | Keyboard focus proceeds sequentially through focusable components in an intuitive and logical order. |
| **2.4.4 Link Purpose (In Context) (Level A)** | **Supports** | The purpose of every link can be determined from the link text alone or from its programmatic context. External evidence links include clear destination labels. |
| **2.4.7 Focus Visible (Level AA)** | **Supports** | An explicit, highly visible outline (`2px solid rgb(187, 206, 255)` in dark mode, `2px solid rgb(59, 130, 246)` in light mode) is rendered on all `:focus-visible` elements. |
| **2.5.1 Pointer Gestures (Level A)** | **Supports** | All functions operable by multipoint or path-based gestures can also be operated with a single pointer without a path-based gesture. |
| **2.5.2 Pointer Cancellation (Level A)** | **Supports** | Touch and mouse interactions trigger on the `up` event, allowing cancellation by moving the pointer away. |
| **2.5.3 Label in Name (Level A)** | **Supports** | For all user interface components with labels that include text, the programmatic accessible name contains the visual text. |
| **2.5.5 Target Size (Level AAA / Best Practice)** | **Supports** | Interactive elements enforce a minimum touch target size of $44 \times 44\text{ px}$ in CSS. |

---

## 4. Principle 3: Understandable

| Criteria | Conformance Level | Remarks & Explanations |
|---|---|---|
| **3.1.1 Language of Page (Level A)** | **Supports** | The root `<html>` element specifies a valid `lang="en"` attribute. |
| **3.1.2 Language of Parts (Level AA)** | **Supports** | Multilingual labels (e.g., Tamil and Hindi script names) include explicit `lang="ta"` and `lang="hi"` attributes. |
| **3.2.1 On Focus (Level A)** | **Supports** | Receiving focus does not initiate an unexpected change of context. |
| **3.2.2 On Input (Level A)** | **Supports** | Changing the setting of any input control does not automatically trigger an unexpected context change. |
| **3.2.3 Consistent Navigation (Level AA)** | **Supports** | Navigational mechanisms that are repeated across multiple views occur in the same relative order. |
| **3.2.4 Consistent Identification (Level AA)** | **Supports** | Components that have the same functionality are identified consistently across the application. |
| **3.3.1 Error Identification (Level A)** | **Supports** | Form errors and file drop rejection notices are described in text and associated with offending fields. |
| **3.3.2 Labels or Instructions (Level A)** | **Supports** | Clear labels and helper instructions are provided for all interactive controls and dropzones. |
| **3.3.3 Error Suggestion (Level AA)** | **Supports** | When an input error is detected, the application provides clear suggestions for correction (e.g., supported audio codecs). |

---

## 5. Principle 4: Robust

| Criteria | Conformance Level | Remarks & Explanations |
|---|---|---|
| **4.1.1 Parsing (Level A)** | **Supports** | HTML markup is validated: elements have complete start and end tags, elements are nested according to specification, and IDs are unique. |
| **4.1.2 Name, Role, Value (Level A)** | **Supports** | All custom controls expose valid ARIA roles, states, and properties (`aria-expanded`, `aria-selected`, `aria-controls`, `aria-modal`). |
| **4.1.3 Status Messages (Level AA)** | **Supports** | Live progress updates, batch completion notices, and error logs use `role="status"` or `role="alert"` with `aria-live="polite"` or `"assertive"`. |

---

## 6. Attestation & Governance Limitations

1. **Scope of Claim:** This report applies strictly to the web front-end application within tested staging branch `antigravity/spe-staging-round2-qual-20261001` (PR #88).
2. **Third-Party Disclaimers:** SPE does not claim endorsement or certification from W3C, ITI, or Section 508 bodies.
3. **Continuous Conformance:** Automated CI regression tests execute on every pull request to ensure that no changes introduce new WCAG 2.1 AA violations.
