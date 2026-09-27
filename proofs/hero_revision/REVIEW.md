# SPE hero revision — founder review

Status: **HOLD for founder visual acceptance.** Local implementation and focused checks completed; no award score is claimed. HOSTING remains FORBIDDEN. The founder subsequently authorized committing and pushing this work to PR 44. No merge, deployment or DNS action.

## Custody and scope

PR 44 remains open on `grok/spe-v1-full-product-continuation-20260925`, remote head `1ff61b1b236971a30492a923c28d3d65a7cd9458` (fresh read in `pr-custody.json`). This local revision follows the rejected local commit `c549a281596c12e901cbb2ed6914f6ebd0a0dc9e`. It is an isolated checkout at `spe-hero-review`; the original working tree and its untracked evidence were preserved.

Only the home hero, its focused tests, hero copy-review entries and review evidence changed. The prompt studio portion of Hero.tsx is byte-identical to the prior commit. Non-hero copy inventory entries and dependency manifests are unchanged (`scope-check.json`). Create, Capabilities, Execution Contract, Daily Lab, SEO, routing, architecture, providers, protocols, K3/G6-H evidence, workflows and hosting configuration were not changed.

## What changed

- Replaced the rejected grid diagram with one native, layered scene: six thought fragments, goal/context/boundary, an SPE plate, role/objective/constraints/output, then a prompt whose lines assemble.
- Kept the founder PNG as an unchanged reference asset. It is not rendered or requested by the hero. No new raster artwork, Canvas, Three.js scene or dependency.
- Plain website text: “Have an idea? Let’s make it clear.” / “Make my prompt” / “Your prompt. Ready to use.” Generated prompt logic and professional prompt requirements are unchanged.
- 31 reviewed title pairs rotate by each visitor’s local calendar date. No network or random selection. The title stays stable within the day, changes at local midnight, and refreshes on focus, pageshow and visibility return. The cycle repeats after 31 days.
- Dark, light and live system themes; desktop headline on the left; a vertical story on phones. Five step controls, keyboard pause/resume/replay, offscreen/background suspension and a finite end. Reduced motion shows the finished composition with no animation. A semantic text equivalent explains the entire example.

## Evidence

The original PR’s static hero is in `../hero_native/before/`. The rejected previous local design is in `../hero_native/after/`. Both include screenshots and recordings for dark desktop, light desktop, mobile and reduced motion. Current screenshots and recordings are in `final/`, with the same four modes. `round1/` and `round2/` preserve the visual correction process. `daily-day1.png` and `daily-day2.png` show two date-controlled headline examples.

The founder image is a composition reference, not a pixel-matching requirement: its horizontal photoreal rendering has been translated into native elements, an editorial two-column desktop layout and a vertical mobile layout. See `../../design-qa.md` for comparison findings.

## Checks and measured limits

- **66 browser checks pass**: themes, system changes, reduced motion (initial and live), keyboard pause, motion freezing/resume, offscreen suspension, five steps, replay, no PNG request, semantic equivalent, runtime errors, widths 320–1920, 200% zoom, live midnight/returning-tab changes, all 31 titles at four widths.
- Axe WCAG A/AA checks found **zero violations in the hero** in dark, light and both system states. This is automated coverage, not a screen-reader user study.
- **9,635 daily-title assertions pass**, including four time zones, DST 23/25-hour days, leap years and calendar boundaries.
- TypeScript, Vite preview build, theme-route smoke and final-craft contracts pass. Copy gate: zero unreviewed entries and zero violations. No shared copy policy was relaxed.
- Full release build remains blocked by the pre-existing WASM developer-path packaging check. Direct Vite build is used only for local review; it is not release certification.
- Whole-app JS/CSS gzip total: original PR 489,849 bytes; rejected implementation 493,267; revision 495,193. Delta: **+1,926 bytes** from the rejected version, **+5,344 bytes** from the original PR. No new dependency.
- Cold local desktop resource bodies: **432,546 bytes**, versus **1,697,312** on the original static-PNG PR. Headers excluded. The unchanged PNG remains on disk but is not fetched.
- Three local animation-start samples: p95 frame interval 16.7–16.8 ms, CLS 0. One maximum interval was 166.7 ms; load-time long tasks ranged 52–196 ms. These are whole-page local Chromium observations with other local audit activity, not field Core Web Vitals, low-end-device guarantees or proof that all long tasks originate in the hero.
- Deployment gate replica exits 2, `fail_closed: true`, `would_allow_deploy: false`, `HOSTING: FORBIDDEN`. The existing gate and its protected evidence were not edited.

## Remaining decisions / gaps

Founder visual PASS/HOLD is pending. No independent award jury, worldwide language-comprehension study, physical low-end-phone test or manual assistive-technology study has been performed. The title cycle is 31 days, not an unlimited generator. The full release build is blocked outside hero scope. The app’s browser panel failed to attach during the first open attempt; the local URL and captured Chromium evidence remain available.
