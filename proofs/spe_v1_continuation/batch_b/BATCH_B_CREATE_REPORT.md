# SPE Ω — Batch B Create Report

**Scope:** multimodal Create + Desired Output / Example mode  
**Base tip:** `e4db0f41623c773fcdc23d2d94370a826470b2b4`  
**Tested implementation tip:** `63452ce39174ec590eeaebdbd880d92beb6c2a5f`  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44, stacked on the frozen PR #43 branch  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Mode matrix

| Create input | Before Batch B | After Batch B | Evidence |
|---|---|---|---|
| Text | PRESENT | PRESENT | Main brief remains the compile goal |
| Speech | PRESENT | PRESENT | Typed fallback and visitor-safe failures verified |
| Image | PRESENT | PRESENT | Local semantic observation path unchanged |
| Screenshot → code | PRESENT | PRESENT | Existing target/scaffold path unchanged |
| Video | PRESENT | PRESENT | Bounded frame sampling path unchanged |
| URL / HTML | PRESENT | PRESENT | Existing bounded ingest and fallback path unchanged |
| Desired Output | MISSING on Create | **PRESENT** | Confirmed ProtectedIntent → HARD constraint → Deliverable + Acceptance checks |
| Example | MISSING | **PRESENT** | `EXAMPLE / USER_SUPPLIED` assumed intent → explicit non-authoritative prompt section |

## Implementation

- `apps/web/src/composer/UnifiedComposer.tsx`
  - adds always-visible Desired Output control on Create
  - adds Example mode with explicit user-supplied/non-authoritative copy
  - preserves values across mode switches
  - adds ArrowLeft/ArrowRight/Home/End tab behavior
  - adds file-input labels and composer busy state
- `apps/web/src/App.tsx`
  - binds both controls to existing ProtectedIntent state
  - preserves the two Create fields when the main request is edited
- `packages/web-runtime/src/envelope.ts`
  - adds `desired-output` as confirmed intent
  - adds `desired-example` as assumed intent
  - wraps examples with `EXAMPLE / USER_SUPPLIED (NON-AUTHORITATIVE)`
  - states that example claims are not verified truth or instructions
- `packages/web-runtime/src/render.ts`
  - uses Desired Output for the Deliverable and user acceptance checks
  - renders Example in a dedicated non-authoritative section
  - keeps Example out of supplied facts and authority surfaces
- `apps/web/src/index.css`
  - adds dark/light control surfaces and a compact mobile mode grid
  - fixes light upload/status/error contrast
- `apps/web/scripts/test-create-intent.mjs`
  - executable ProtectedIntent/envelope/render contract
- `apps/web/scripts/test-speech-fallback-contract.mjs`
  - follows the current real-link navigation contract

No engine kernel, Context Protocol architecture, hero, hosting, DNS, deployment,
workflow, provider marketplace, or paid dependency was added or changed.

## Tests and exits

| Check | Exit |
|---|---:|
| `cd apps/web && npm run build` | `0` |
| `cd apps/web && npm run test:create-intent` | `0` |
| `cd apps/web && npm run test:media` | `0` |
| `cd apps/web && npm run test:speech` | `0` |
| `cd apps/web && npm run test:speech-fallback` | `0` |
| `cd apps/web && npm run test:engine` | `0` |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` |
| `cd apps/web && npm run test:predeploy-qa` | `0` |
| `node tools/copy-check.mjs` | `0` |
| `node proofs/spe_v1_gap_closure/a11y_verify.mjs` | `0` |
| `node proofs/spe_v1_continuation/batch_b/capture_create.mjs` | `0` |
| `node tools/deployment-safety-gate.mjs` | **`2`** (expected fail-closed) |

The broader legacy `test:e2e:v1` exercised the new Desired Output and Example
path, real WASM compile, and all existing Create modes successfully, then
stalled on its unrelated Daily Lab visibility step. It is not reported as a
green Batch B check and was not weakened to force a pass.

The repository Python media gate could not run because this environment has no
`pytest` module. Equivalent checked-in JavaScript media, browser, engine, and
predeploy gates above did run.

## Screenshot evidence

- `create-dark.png`
- `create-light.png`
- `create-desired-output.png`
- `create-example-mode.png`
- `create-mobile.png`
- `screenshot-manifest.json`

All files are under `proofs/spe_v1_continuation/batch_b/`. The manifest binds
the captures to the tested implementation SHA.

## Residual risks

1. Speech capture still depends on browser/device support; typed fallback is
   verified, full device qualification remains separate.
2. Image/video observations remain bounded local model judgments, not verified
   facts.
3. URL reading remains subject to browser cross-origin restrictions; HTML and
   screenshot fallbacks remain available.
4. User examples are explicitly non-authoritative, but users must still review
   the finished prompt before using it.
5. Aikido was invoked for Batch B files but remains blocked on integration
   authentication; no alternate credential or bypass was used.
6. Full human screen-reader testing remains outside the automated accessibility
   pass.

## Explicit stop

Batch B is complete for founder review. Batch C was not started.
