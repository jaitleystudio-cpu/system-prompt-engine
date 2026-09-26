# SPE Atmospheric DotPattern Addendum

**Scope:** creative atmospheric backgrounds after completed Batch C  
**Base tip:** `c337cc28783665d1ceb891f01b9da6022f0174bb`  
**Tested implementation tip:** `77cd1ceabab2dbd4cc5a6ecafbbd1831d2dda9d4`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Implementation

- Added `apps/web/src/ui/DotPattern.tsx` under SPE’s existing UI owner.
- Preserved the requested SVG mechanics:
  - React `useId`
  - SVG pattern definitions
  - circles with fully typed numeric geometry props
  - full-surface, pointer-inert, `aria-hidden` rendering
- Composed three pattern layers:
  - fine warm-gold radial field
  - larger rotated cool-ink diagonal sweep
  - sparse oversized corner-depth field
- Added soft elliptical haze and a restrained vignette.
- Added very slow CSS-only drift. `prefers-reduced-motion` removes animation
  while retaining the rotated/static depth composition.
- Added theme-specific gold/ink values and softer mobile density.
- Integrated only behind:
  - Home hero copy and glass story
  - Create heading and composer
- Strengthened dark microcopy contrast without changing product copy.

The pattern remains behind all content, has `pointer-events: none`, and does not
cover the hero stage labels, CTA, mode tabs, fields, or export controls.

## Intentionally not introduced

- no Tailwind dependency or configuration
- no shadcn CLI or shadcn components
- no parallel `apps/web/src/components/ui` tree
- no `clsx` or `tailwind-merge`
- no paid dependency
- no stock photo
- no Three.js or canvas background
- no hosting, DNS, deployment, or workflow changes

## Files touched

- `apps/web/src/ui/DotPattern.tsx`
- `apps/web/src/landing/Hero.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/index.css`
- `apps/web/scripts/test-dot-pattern.mjs`
- `apps/web/package.json`
- `tests/copy/reviewed-inventory.json`
- `proofs/spe_v1_continuation/bg_dot_pattern/**`

## Tests and exits

| Check | Exit |
|---|---:|
| `cd apps/web && npm run build` | `0` |
| `cd apps/web && npm run test:dot-pattern` | `0` |
| `cd apps/web && npm run test:hero-story` | `0` |
| `cd apps/web && npm run test:create-intent` | `0` |
| `cd apps/web && npm run test:artifact` | `0` |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` |
| `cd apps/web && npm run test:predeploy-qa` | `0` |
| `node tools/copy-check.mjs` | `0` |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` |
| `node proofs/spe_v1_continuation/bg_dot_pattern/capture_backgrounds.mjs` | `0` |
| `node tools/deployment-safety-gate.mjs` | **`2`** (expected fail-closed) |

## Screenshot evidence

- `home-dark-bg.png`
- `home-light-bg.png`
- `create-dark-bg.png`
- `create-light-bg.png`
- `reduced-motion-bg.png`
- `mobile-bg.png`
- `screenshot-manifest.json`

All files are under `proofs/spe_v1_continuation/bg_dot_pattern/`; the manifest
binds them to the tested implementation SHA.

## Residuals

1. Atmospheric motion is intentionally slow and understated; still captures
   demonstrate composition and masks, not drift speed.
2. Background aesthetic acceptance remains a founder visual decision.
3. Aikido was invoked for the touched files but remains blocked on integration
   authentication; no alternate credential or bypass was used.
4. The accumulated manual browser agent reached its image limit after the prior
   Batch A–C walkthroughs. Final proof uses fresh automated browser captures,
   computed motion/opacity checks, and a separate visual-design review.

## Explicit stop

Atmospheric backgrounds are ready for founder PASS/HOLD. Batch D was not started.
