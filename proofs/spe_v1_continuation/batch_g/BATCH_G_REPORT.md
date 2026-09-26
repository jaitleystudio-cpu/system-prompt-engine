# SPE Ω — Batch G Report (Daily Lab acquisition)

**Scope:** Daily Lab → Create acquisition handoff + honest provenance (extend existing Lab owners)  
**Base tip (Batch F PASS):** `90adbaedba8afcd9b1d48cad7d10b7d21c865e40`  
**Final tip:** post-commit `git rev-parse HEAD` on this branch (message starts `feat(batch-g):`). No self-hash in-blob — amend would drift.  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44 — https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/44  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Custody

| Field | Value |
|-------|-------|
| Machine | Mac checkout `0d308a2c-330c-430b-85e3-74d647e69e59` |
| Start HEAD verified | `90adbaedba8afcd9b1d48cad7d10b7d21c865e40` |
| Safety tag | `local-pre-batch-g-20260926` |
| Push | Allowed when Batch G green (this report) |
| Cloud Agent | **Not used** |
| Workflows | **Not edited** |
| Deploy / host / DNS | **Not done** |
| Batch H+ | **Not started** |

## Requirement matrix (inspect → action)

| # | Requirement | Pre-G | Batch G |
|---|---|---|---|
| 1 | Finite honest queue + date-deterministic | PRESENT (14) | Kept |
| 2 | Premium 3D stage + reduced-motion | PRESENT | Kept; soft WebGL ErrorBoundary added |
| 3 | Open in SPE → Create fields | PARTIAL (inline App) | Single owner `labAcquisition.ts` + `applyLabAcquisition` |
| 4 | Acquisition provenance on Create | MISSING | Chip “From Daily Lab: {title}” / gallery; dismissible |
| 5 | Invalidate prior draft (`invalidate`) | PRESENT | Kept in apply path |
| 6 | Desired Output / Example compatibility | PARTIAL | Seed Desired Output from blurb when empty |
| 7 | Deep-link `?specimen=` | MISSING | Present on `/daily-lab`; mount preserves search |
| 8 | Copy build prompt CTA | PRESENT | Kept |
| 9 | Gallery separated from Daily 3D | PRESENT | Kept |
| 10 | Tests handoff + route + honesty | PARTIAL | `test-lab-acquisition.mjs` + adversarial + theme-routes |
| 11 | Screenshots | MISSING for G | dark/light/mobile + post-Open Create |

Full matrix: `proofs/spe_v1_continuation/batch_g/ACQUISITION_MATRIX.md`.

## Vertical slice

1. Specimen or gallery card → structured seed (`userRequest`, category, mode simple, provenance, optional Desired Output).
2. Create shows dismissible provenance chip; prior protocol/execution cleared via `invalidate()`.
3. `/daily-lab?specimen=d3d-01` selects that finite-queue specimen without a new router.
4. Finite 14-day 3D honesty unchanged; gallery remains ordinary prompt cards (36).
5. WebGL failure no longer blanks editorial + Open in SPE (LabStageBoundary).

## Files added / changed

| Path | Role |
|------|------|
| `apps/web/src/lab/labAcquisition.ts` | NEW — acquisition handoff owner |
| `apps/web/src/lab/LabStageBoundary.tsx` | NEW — soft WebGL/Canvas boundary |
| `apps/web/src/lab/DailyLab.tsx` | `?specimen=` + boundary wrap |
| `apps/web/src/App.tsx` | `applyLabAcquisition`, chip, preserve search on mount |
| `apps/web/src/index.css` | Acquisition chip styles |
| `apps/web/scripts/test-lab-acquisition.mjs` | NEW — handoff + honesty smoke |
| `apps/web/scripts/test-adversarial-v1.mjs` | Asserts labAcquisition owner |
| `apps/web/package.json` | `test:lab-acquisition` |
| `tests/web/test_v1_media_and_lab.py` | Clean-open asserts → acquisition owner |
| `tests/copy/reviewed-inventory.json` | Batch G copy refresh |
| `proofs/spe_v1_continuation/batch_g/*` | Matrix, capture, screenshots, this report |

## Tests executed

| Check | Exit | Result |
|---|---:|---|
| `cd apps/web && node scripts/test-lab-acquisition.mjs` | `0` | PASS handoff + finite queue + deep-link parse |
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` | `/daily-lab` still mapped |
| `cd apps/web && npm run spe:copy-check` | `0` | 0 unreviewed, 0 violations |
| `cd apps/web && npx tsc --noEmit && npx vite build && node scripts/cache-shell.mjs` | `0` | TypeScript + Vite + cache shell PASS |
| `cd apps/web && npm run test:predeploy-qa` | `0` | 18 predeploy cases PASS |
| `cd apps/web && node scripts/test-adversarial-v1.mjs` | `0` | Includes finite-14 + labAcquisition |
| `node tools/deployment-safety-gate.mjs` | **`2`** | expected fail-closed; `HOSTING=FORBIDDEN` |
| `node proofs/.../batch_g/capture_lab_acquisition.mjs` | `0` | dark/light/mobile + Create provenance |

### Full `npm run build` note

Same as Batch F: local WASM target can embed `/Users/` paths; used shipped `public/spe_wasm.wasm` via `tsc` + `vite build` + `cache-shell`. WASM not rebuilt.

## Screenshots

| File | Notes |
|------|-------|
| `daily-lab-dark.png` | Desktop 1440 dark; finite-queue honesty + Open in SPE |
| `daily-lab-light.png` | Desktop 1440 light |
| `daily-lab-mobile.png` | 393×852 dark |
| `create-from-lab-provenance.png` | Create after Open in SPE — chip “From Daily Lab: Brushed orbit”, Desired Output seeded |
| `screenshot-manifest.json` | SHA-256 per shot |

## Allowed claims

| Claim | Status | Evidence |
|-------|--------|----------|
| `BATCH_G_IMPLEMENTATION_PRESENT` | **SUPPORTED** | Handoff owner, provenance chip, deep-link, boundary |
| `BATCH_G_TESTED_WITHIN_DECLARED_SCOPE` | **SUPPORTED** | Commands + exits above (local Mac checkout) |
| `WORLD#1` | **NOT_PROVEN** | No ranking claim |
| `HOSTING` | **FORBIDDEN** | Deploy safety gate exit `2` |

## Residuals

- Full `npm run build` on this Mac may still need WASM remap-path-prefix (pre-existing).
- Headless Chrome without WebGL shows stage fallback via LabStageBoundary; real device GPU path unchanged.
- Gallery cards do not use `?specimen=` (3D queue only) — intentional.
- Batch H+ not started.
