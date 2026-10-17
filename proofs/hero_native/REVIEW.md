# SPE native hero — founder review

**Status: HOLD for founder PASS/HOLD. Local-only implementation; not pushed. HOSTING=FORBIDDEN.**

## Custody

PR #44 is OPEN DRAFT. Its head and original checkout were verified twice at `1ff61b1b236971a30492a923c28d3d65a7cd9458`, branch `grok/spe-v1-full-product-continuation-20260925`. Work is isolated in `/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review`. The original checkout, its untracked evidence and the remote PR are unchanged. The final local commit SHA is supplied in the chat handoff; source hashes are in [custody.json](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/custody.json).

## Result and scoped design audit

1. **Messy human thought — implemented:** six real note/question/image/document/voice/URL fragments. The reference PNG is absent from hero markup and network requests.
2. **Meaning — implemented:** extracted sample facts travel into GOAL / CONTEXT / BOUNDARY groups; visible sample text explains each group.
3. **SPE — implemented:** compact typographic seal with a restrained transformation motion; no 3D runtime or new dependency.
4. **Structure — implemented:** ROLE / OBJECTIVE / CONSTRAINTS / OUTPUT arrive in order.
5. **Perfect prompt — implemented, copy-policy HOLD:** the final artifact assembles line by line and remains readable. This exact requested label is flagged by the existing shared copy policy. The illustration is visibly marked as an example and asks the visitor to review the prompt.

The original headline/CTA content stays intact. Desktop is an editorial split; mobile is a complete vertical sequence. Light, dark and live system theme changes work. Motion is finite, user-pausable/replayable, paused when offscreen or the document is hidden, and disabled for reduced motion. Semantic text is present independently of animation.

## Exact production/test files changed

- [apps/web/src/landing/HeroStory.tsx](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/apps/web/src/landing/HeroStory.tsx): native narrative and motion controls.
- [apps/web/src/landing/hero-native.css](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/apps/web/src/landing/hero-native.css): new hero-scoped responsive/theme/motion styles.
- [apps/web/src/index.css](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/apps/web/src/index.css): removed only the obsolete final PNG hero override block.
- [apps/web/scripts/test-hero-story.mjs](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/apps/web/scripts/test-hero-story.mjs): replaces the rejected PNG contract with browser behavior, theme, responsive and a11y checks.
- [apps/web/scripts/test-final-craft.mjs](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/apps/web/scripts/test-final-craft.mjs): changes only two hero assertions; non-hero assertions stay intact.

All other additions are local review evidence under `proofs/hero_native/`; [FILES.txt](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/FILES.txt) enumerates them exactly. No Create, Capabilities, Execution Contract, Daily Lab, SEO, architecture, routing, providers, .spe, Context Protocol, K3, G6-H, workflow, hosting, deployment or DNS change. The founder PNG is retained byte-for-byte as reference; it remains a public-folder file but is not rendered or requested by this hero.

## Validation

| Check | Result |
|---|---|
| Focused browser checks | **57/57 PASS** — keyboard pause/resume, frozen timeline, replay, preference changes, offscreen pause, source absence, semantics |
| Axe hero checks | **PASS**, zero reported violations in dark, light and both system-theme states; WCAG 2/2.1/2.2 A/AA tag set |
| Responsive | **PASS** at 320, 390, 700, 768, 1024, 1440, 1920px; 200% zoom has no horizontal overflow |
| Theme/routes smoke | **PASS**, unchanged theme/routing owners |
| Final-craft smoke | **PASS**, non-hero assertions preserved |
| TypeScript | **PASS** |
| Direct Vite web build | **PASS**, inherited large-chunk warning remains |
| Copy gate / full packaging | **HOLD / exit 1**: 52 unreviewed hero copy entries; policy also flags the requested “perfect prompt” phrase. No gate weakened. |
| Existing WASM packaging | Baseline standard build rejected local WASM containing developer paths. Engine artifact not changed. |
| Deployment gate | **Expected exit 2**, fail closed. Exact unchanged gate and headers executed in a temporary evidence sandbox to avoid rewriting older proofs. |
| Scope / custody / diff whitespace | **PASS** |

Full evidence: [tests](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/tests.json), [copy-gate log](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/copy-check.log), [baseline packaging log](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before-build.log), [deployment gate](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/deployment-gate.json).

## Measured assets and performance

- Founder PNG request removed: **1,270,110 bytes** per cold page load.
- Built JS/CSS total: **+13,735 raw bytes; +3,418 gzip bytes**. No dependency or lockfile changes.
- Desktop encoded resource bodies: **1,697,312 → 430,620 bytes** in matched fresh contexts with service workers blocked for measurement.
- Three local frame samples per version: p95 roughly **16.7–16.8 ms**. Baseline CLS 0; updated CLS about **0.000223**. Startup long tasks exist in both; results are noisy local headless measurements, not a field performance claim.
- Hero DOM adds 119 elements to the page; no hero Canvas, Three.js or image request.

[Asset measurements](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/performance.json) · [frame samples](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/frame-check.json). The retained reference PNG means packaged public-directory size is not reduced; the improvement is the hero's load path.

## Before / after evidence

Screenshots use 1440×1000 desktop and 390×844 mobile viewports. Full hero captures include content below the fold. Each video is an actual local browser recording; the updated mobile video scrolls through all five stages.

| Mode | Before screenshot | After screenshot | Before recording | After recording |
|---|---|---|---|---|
| Dark desktop | [Before](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/dark-desktop-hero.png) | [After](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/dark-desktop-hero.png) | [Before video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/dark-desktop.webm) | [After video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/dark-desktop.webm) |
| Light desktop | [Before](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/light-desktop-hero.png) | [After](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/light-desktop-hero.png) | [Before video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/light-desktop.webm) | [After video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/light-desktop.webm) |
| Mobile | [Before](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/mobile-hero.png) | [After](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/mobile-hero.png) | [Before video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/mobile.webm) | [After video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/mobile.webm) |
| Reduced motion | [Before](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/reduced-motion-hero.png) | [After](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/reduced-motion-hero.png) | [Before video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/before/reduced-motion.webm) | [After video](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/after/reduced-motion.webm) |

## Residuals and gate

Founder aesthetic acceptance and user comprehension are unmeasured. Physical-device Safari and spoken screen-reader testing remain unverified; axe and DOM checks do not establish full WCAG conformance. Full application packaging is not green for the reasons above. Old proof harnesses that assume the PNG are retained as historical evidence; the new hero harness replaces their hero checks. No independent third-party replication is claimed.

Stop here for founder **PASS/HOLD**. Any copy-policy reconciliation, engine packaging repair, push or deployment is outside this local hero handoff.

Product Design audit skill and the Codex in-app browser were used. [Research, contradictory evidence and decision record](/Users/prawinpalisetty/.codex/.chatgpt-projects/g-p-6aa32fc67f688191aae39cb61faa5250/spe-hero-review/proofs/hero_native/RESEARCH_AND_DECISIONS.md) includes the W3C, MDN and Norrly references and the 12-option elimination record.
