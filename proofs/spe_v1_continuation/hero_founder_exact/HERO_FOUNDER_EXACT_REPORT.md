# SPE Ω — Emergency Hero Fix: Founder PNG Verbatim

**Scope:** Replace failed DOM/SVG/award-craft hero diagram with the founder-supplied PNG as the live right-side hero art.  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**Base tip before work:** `5d9b5cb9f304d5a6e00c27eafa09ee090ac37164`  
**Implementation tip SHA:** `29d234e516df113e1a65e7e404cb43b0ed0658e1`  
**Branch tip (after bind):** `6ac54840a6999f4c3c8e26fe827964ab29a67cb2`  
**PR:** #44  
**HOSTING:** **FORBIDDEN** · **WORLD #1:** **NOT_PROVEN** · **₹0** · No CloudAgent · Route B Mac

## Explicit claim

**Used founder PNG verbatim as hero art. No new invented CSS/SVG/DOM diagram.**

- Asset path: `apps/web/public/hero/founder-hero-story.png`
- Public URL: `/hero/founder-hero-story.png`
- SHA-256: `fb7edd8fbb1e197fed417a5866441ee950c58600b0c805aa7377d2bc06a6da93`
- Dimensions: 1376×768 PNG
- `object-fit: contain`; soft radial plate only (no heavy rectangular diagram frame)
- Story semantics **IDEA → MEANING → SPE → STRUCTURE → PROMPT** remain true **inside the image** (not rebuilt as stations)

## FREEZE (untouched product surfaces)

- Create / Capabilities / ExecutionContract — not modified
- Left hero copy / headline / CTA / nav / DotPattern / palette — preserved
- FAIL/UNKNOWN laws elsewhere — not weakened

## Implementation

| File | Change |
|---|---|
| `apps/web/src/landing/HeroStory.tsx` | Station/SVG markup removed; clean `<figure>` + `<img>` of founder PNG + a11y alt/aria |
| `apps/web/src/landing/Hero.tsx` | `<HeroStory />`; Pause/Resume story control removed (N/A for static art) |
| `apps/web/src/index.css` | Emergency plate + 42/58 split overrides; hide obsolete station surfaces |
| `apps/web/public/hero/founder-hero-story.png` | Founder attachment committed verbatim |
| `apps/web/scripts/test-hero-story.mjs` | Contract asserts PNG path, SHA, alt story stages, no stations, no Pause |
| `apps/web/scripts/test-final-craft.mjs` | Hero asserts updated for image-based art |
| `tests/copy/reviewed-inventory.json` | New alt/aria strings merged |
| `proofs/spe_v1_gap_closure/a11y_verify.mjs` | Reduced-motion check uses founder art (no `.motion-button`) |
| `proofs/spe_v1_continuation/hero_founder_exact/*` | Capture script, screenshots, manifest, this report |

## Composition

- Desktop ~**42%** copy / **58%** stage (founder art)
- Soft-fade entrance; `prefers-reduced-motion: reduce` disables animation
- Light theme: dark-keyed PNG on subtle ivory/blue radial plate (no muddy box)

## Tests / exits

| Check | Exit | Result |
|---|---:|---|
| `npm run test:hero-story` | `0` | Founder PNG SHA + image contract |
| `npm run test:final-craft` | `0` | Presentation contracts |
| `npm run spe:copy-check` | `0` | 0 unreviewed |
| `npx tsc --noEmit` | `0` | Typecheck |
| `npx vite build` + `cache-shell` | `0` | Dist includes `/hero/founder-hero-story.png` |
| `node …/capture_hero_founder_exact.mjs` | `0` | 4 screenshots; art natural size verified live |
| `CHROME_PATH=… node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` | 15 checks PASS incl. pipeline_aria + reduced_motion |
| `npm run build` (full gate) | blocked | Pre-existing `copy-wasm` home-path guard (unchanged WASM; not hero scope) |

## Screenshots

| File | Viewport | Theme |
|---|---|---|
| `home-hero-dark-desktop.png` | 1440×900 | dark |
| `home-hero-light-desktop.png` | 1440×900 | light |
| `home-hero-dark-mobile.png` | 390×844 | dark |
| `home-hero-light-mobile.png` | 390×844 | light |

See `screenshot-manifest.json` for tip binding (rewritten to post-commit SHA).

## Residuals

- Full `npm run build` still hits pre-existing WASM remap-path gate; public WASM artifact untouched.
- Founder visual acceptance of this exact-PNG hero remains a founder PASS/HOLD.
