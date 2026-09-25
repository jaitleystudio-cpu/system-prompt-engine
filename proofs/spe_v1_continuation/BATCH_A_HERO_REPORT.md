# SPE Ω — Batch A Hero Report

**Scope:** Batch A only — final hero storytelling  
**Base SHA:** `9d5a37a913b5a30122d19734af106f5c85b085cb`  
**Tested implementation tip SHA:** `f8ef085ab7cfe4cc6c06a0d41119619b4dc8d8a6`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**Stack base:** `grok/spe-v1-gap-closure-20260925` (PR #43 head)  
**HOSTING:** **FORBIDDEN**  
**WORLD #1:** **NOT_PROVEN**

The implementation is stacked directly on the accepted PR #43 head. PR #43
remains unchanged; this continuation contains only Batch A hero work and its
evidence.

## Approved story implemented

`MESSY HUMAN THOUGHT → IDEA → MEANING → SPE → STRUCTURE → SYSTEM PROMPT`

- Desktop uses a 42/58 editorial split: real HTML headline, copy, and CTA on the
  left; semantic story illustration on the right.
- Human fragments include note, question, image, code, document, waveform, and
  URL specimens. They resolve into an idea and meaning clusters.
- A compact brushed-titanium SPE semantic engine sits specifically between
  MEANING and STRUCTURE.
- Structure resolves into a calm ivory system-prompt artifact facing the viewer.
- Mobile is a dedicated vertical sequence with headline and CTA before the
  story. It is not a scaled desktop composition.
- The hero is HTML/CSS and available on first paint. It no longer hydrates the
  Three.js scene; the accepted downstream scene remains unchanged.
- Motion is restrained, pausable, and disabled by `prefers-reduced-motion`.

## Files changed

- `apps/web/src/landing/Hero.tsx`
  - renders the semantic hero story and reduced-motion-aware motion control
  - removes the hero-only lazy WebGL scene path
- `apps/web/src/landing/HeroStory.tsx`
  - semantic six-stage editorial illustration and accessible process label
- `apps/web/src/index.css`
  - dark/light materials, desktop split, mobile vertical composition, motion,
    reduced-motion static state, and mobile overflow repair
- `apps/web/scripts/test-hero-story.mjs`
  - contract for approved stage order, required fragments, mobile layout,
    reduced motion, and no orb/reactor/turbine concept
- `apps/web/package.json`
  - `test:hero-story` command
- `tests/copy/reviewed-inventory.json`
  - editorial approval records for the new hero vocabulary
- `proofs/spe_v1_continuation/batch_a/capture_hero.mjs`
  - deterministic clean capture and SHA manifest
- `proofs/spe_v1_continuation/batch_a/*.png`
  - fresh desktop dark/light, mobile, and reduced-motion screenshots
- `proofs/spe_v1_continuation/batch_a/screenshot-manifest.json`
  - binds screenshots to the tested implementation SHA

No Context Protocol, ProtectedIntent, WASM engine, SEO/routing, security header,
hosting, DNS, deployment, or workflow files were changed.

## Tests and exits

| Check | Exit | Result |
|---|---:|---|
| `cd apps/web && npm run build` | `0` | copy gate, WASM copy, TypeScript, Vite, and cache shell pass |
| `cd apps/web && npm run test:hero-story` | `0` | approved semantic and responsive contract passes |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` | theme and route smoke passes |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` | 15 browser checks pass, including reduced motion and pipeline ARIA |
| `cd apps/web && npm run test:predeploy-qa` | `0` | 18 predeploy cases pass |
| `node tools/copy-check.mjs` | `0` | 0 unreviewed strings, 0 violations |
| `node proofs/spe_v1_continuation/batch_a/capture_hero.mjs` | `0` | four clean screenshots captured |
| `node tools/deployment-safety-gate.mjs` | **`2`** | expected fail-closed result; `HOSTING=FORBIDDEN` |

Engine tests were not required because no engine, WASM, ProtectedIntent, or
compiler behavior was changed.

The required Aikido local scan was invoked on all changed code files, but the
integration returned an authentication requirement and produced no scan result.
No alternate credentials or bypass were used.

## Screenshot evidence

- `proofs/spe_v1_continuation/batch_a/home-dark.png`
- `proofs/spe_v1_continuation/batch_a/home-light.png`
- `proofs/spe_v1_continuation/batch_a/mobile-home.png`
- `proofs/spe_v1_continuation/batch_a/reduced-motion.png`
- `proofs/spe_v1_continuation/batch_a/screenshot-manifest.json`

The mobile capture is `390 × 1877` and contains the complete vertical story
through the SYSTEM PROMPT artifact before the prompt studio begins.

## Residuals

1. Overall premium-design founder HOLD remains; this Batch A evidence does not
   claim final founder acceptance.
2. Full human screen-reader testing remains outside this automated browser pass.
3. The downstream scroll story and Daily Lab still use the accepted lazy 3D
   chunks; only the hero first-paint path was made lightweight.
4. Aikido authentication is required before its local scan can return findings.
5. Existing dependency audit state was not changed or remediated in this
   visual-only batch.

## Claims not proven

- **WORLD #1 is NOT_PROVEN.**
- **Hosting readiness is NOT_PROVEN.**
- No deploy, DNS, hosting, production traffic, live headers, DDoS protection,
  bandwidth ceiling, abuse controls, or founder hosting unlock was performed.
- The deployment safety gate correctly remains fail-closed at exit `2`.

## Explicit stop

Batch A is complete. Batches B–I were not started.

## Founder HOLD repair — desktop story clarity

**Tested repair tip SHA:** `b2447eb2d086a2d994da3060ad54a962723eb817`
**Target:** the three founder-supplied cinematic glass references, interpreted
without tracing foreign branding.

- Replaced the dense six-column board with five prominent numbered stages:
  `IDEA → MEANING → SPE → STRUCTURE → PROMPT`.
- Kept messy notes, question, image, code, document, waveform, and URL fragments
  visible inside IDEA, resolving through warm-gold flow lines.
- Added translucent MEANING filter panes; kept the compact rectangular SPE
  semantic engine specifically between MEANING and STRUCTURE.
- Increased stage hierarchy, removed competing desktop micro-chrome and the
  orb-like IDEA mark, and strengthened the organized cards and illuminated
  `PERFECT SYSTEM PROMPT` artifact.
- Light mode uses the same hierarchy with restrained warm graphite/gold
  contrast. Reduced motion keeps a static equivalent. Mobile remains a complete
  unclipped vertical story.

| HOLD-repair check | Exit |
|---|---:|
| `cd apps/web && npm run build` | `0` |
| `cd apps/web && npm run test:hero-story` | `0` |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` |
| `cd apps/web && npm run test:predeploy-qa` | `0` |
| `node tools/copy-check.mjs` | `0` |
| `node proofs/spe_v1_continuation/batch_a/capture_hero.mjs` | `0` |
| `node tools/deployment-safety-gate.mjs` | **`2`** (expected fail-closed) |

Fresh captures:

- `proofs/spe_v1_continuation/batch_a/home-dark.png`
- `proofs/spe_v1_continuation/batch_a/home-light.png`
- `proofs/spe_v1_continuation/batch_a/reduced-motion.png`

Residuals: founder visual acceptance remains pending; the references are a
directional target, not a claim of pixel equivalence. Aikido was invoked again
for the repair files but remains blocked on integration authentication.
`HOSTING=FORBIDDEN`; `WORLD #1=NOT_PROVEN`; Batches B–I were not started.
