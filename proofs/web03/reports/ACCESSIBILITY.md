# WEB-03 accessibility report

## Result

PASS for the tested production-preview states. This is not a certification.

## Automated browser audit

- Tool: current `@axe-core/playwright`, WCAG 2 A/AA and WCAG 2.1 A/AA tags.
- State: real compiled workspace with Intent Lens selected at 1440×900.
- Violations: **0**.
- Machine output: `accessibility-axe.json`.

## Keyboard and names

- First `Tab` focus: `SKIP TO MAIN CONTENT`.
- Activating it sets the destination to `#main`.
- Interactive controls discovered on the home state: 13.
- Named controls: 13.
- Unnamed controls: 0.
- Focus screenshot: `../screenshots/states/keyboard-skip-focus.png`.
- Machine output: `keyboard-navigation.json`.

## Semantic and fallback checks

- The WebGL canvas is decorative and `aria-hidden`; all explanations and controls are real DOM.
- Semantic categories are differentiated by label, color, line weight, shape, and pattern.
- Unknowns use dashed spans; constraints use double/heavy stops; preferences use angled seams.
- Reduced-motion preference resolves to LITE and removes the canvas and ambient animation.
- Forced WebGL failure also resolves to LITE without removing the composer, story, or workspace.
- Buttons and form controls use visible focus rings and minimum 44px interaction dimensions in the authored layouts.
- Prompt output uses selectable text, not text rendered into the canvas.
- No autoplay audio or video exists.

## Responsive review

Reviewed captures:

- Desktop: 1440×900, 1920×1080, 2560×1440.
- Tablet: 768×1024, 1024×768.
- Mobile: 390×844, 360×800, 320×568.
- State variants: reduced motion, forced LITE, Intent Lens, keyboard skip focus.

At 320×568 the supporting lede and runtime ledger are intentionally omitted so the title, spatial cue, input, and primary action do not overlap. The same information remains available at larger mobile sizes and in the workspace.

## Known limits

- Axe was run on one compiled desktop state; source and manual checks cover the additional responsive states.
- Screen-reader speech output was not recorded.
- Physical iOS/Android assistive-technology testing was unavailable in this environment.
