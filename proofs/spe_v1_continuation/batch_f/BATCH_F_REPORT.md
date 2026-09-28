# SPE Ω — Batch F Report (SEO/AEO capability pages)

**Scope:** Capability-oriented crawlable page + AEO FAQ JSON-LD, reusing existing SEO owners  
**Base tip (Batch E PASS):** `2be1eaa46944b59319164ed2545b04e56c5f9147`  
**Final tip:** post-commit `git rev-parse HEAD` on this branch (message starts `feat(batch-f):`). No self-hash in-blob — amend would drift.  
**Branch:** `grok/spe-v1-full-product-continuation-20260925`  
**PR:** #44  
**HOSTING:** **FORBIDDEN**  
**WORLD #1 / INDEPENDENTLY_REPLICATED:** **NOT_PROVEN**

## Custody

| Field | Value |
|-------|-------|
| Machine | Mac checkout `0d308a2c-330c-430b-85e3-74d647e69e59` |
| Push | Allowed when Batch F green (this report) |
| Cloud Agent | **Not used** |
| Workflows | **Not edited** |
| Deploy / host / DNS | **Not done** |
| Batch G+ | **Not started** |

## Requirement matrix (inspect)

| requirement | owner | PRESENT/PARTIAL/MISSING (pre-F) | action (Batch F) |
|---|---|---|---|
| History routes + `ROUTE_META` | `apps/web/src/routing.ts` | PRESENT | Add `capabilities` → `/capabilities` + meta |
| Canonical / OG / Twitter | `apps/web/src/ui/SeoHead.tsx` | PRESENT | Reuse; inject capabilities JSON-LD when view matches |
| JSON-LD WebApplication | `routing.ts` `jsonLdSoftwareApplication` | PRESENT | Unchanged (still global) |
| FAQ / AEO structured answers | — | MISSING | Add `FAQPage` + `WebPage` JSON-LD + visible FAQ |
| Capability landing copy | — | MISSING | New `pages/Capabilities.tsx` (honest features) |
| Sitemap entry | `apps/web/public/sitemap.xml` | PARTIAL (no capabilities) | Add `/capabilities` |
| robots Allow | `apps/web/public/robots.txt` | PARTIAL | Allow `/capabilities` |
| Nav / footer / home SEO links | `Nav.tsx`, `App.tsx`, `SeoContent.tsx` | PARTIAL | Link Capabilities |
| Theme/route smoke | `scripts/test-theme-routes.mjs` | PRESENT | Include `/capabilities` |
| Capability SEO smoke | — | MISSING | Add `test-capabilities-seo.mjs` |
| Paid SEO tools / hosting | — | N/A | **Not used / FORBIDDEN** |

## Vertical slice

1. `/capabilities` is a first-class `AppView` with title, description, canonical, OG/Twitter.
2. Page documents real SPE capabilities: local-first, ProtectedIntent, Execution Contract, provider profiles, portable `.spe`, Context Protocol preview.
3. Visible “Plain answers” FAQ mirrors FAQPage JSON-LD for answer engines.
4. Copy denies unproven worldwide ranking claims; no WORLD#1 / fake verified marketing.
5. Sitemap + robots + nav/footer/home SEO links expose the route to crawlers and humans.
6. Existing SEO owners reused — not a redesign, no new router dependency, no paid SEO.

## Files added / changed

| Path | Role |
|------|------|
| `apps/web/src/pages/Capabilities.tsx` | NEW — capability landing + FAQ + PROOF notes |
| `apps/web/src/routing.ts` | `capabilities` view, meta, FAQ/WebPage JSON-LD helpers |
| `apps/web/src/ui/SeoHead.tsx` | Upsert/remove capabilities JSON-LD by view |
| `apps/web/src/App.tsx` | Render + footer link |
| `apps/web/src/layout/Nav.tsx` | Nav link |
| `apps/web/src/landing/SeoContent.tsx` | Home SEO internal link |
| `apps/web/src/index.css` | FAQ / capabilities styling (reuses privacy page shell) |
| `apps/web/public/sitemap.xml` | `/capabilities` URL |
| `apps/web/public/robots.txt` | `Allow: /capabilities` |
| `apps/web/scripts/test-theme-routes.mjs` | Route list includes capabilities |
| `apps/web/scripts/test-capabilities-seo.mjs` | NEW — static SEO/AEO + honest-claim smoke |
| `apps/web/package.json` | `test:theme-routes`, `test:capabilities-seo` |
| `tests/copy/reviewed-inventory.json` | Refreshed for Batch F copy |
| `proofs/spe_v1_gap_closure/a11y_verify.mjs` | Needed routes include `/capabilities` |
| `proofs/spe_v1_continuation/batch_f/*` | Evidence + this report |

## Tests executed

| Check | Exit | Result |
|---|---:|---|
| `cd apps/web && node scripts/test-theme-routes.mjs` | `0` | PASS theme+routes smoke |
| `cd apps/web && node scripts/test-capabilities-seo.mjs` | `0` | PASS capabilities SEO/AEO smoke |
| `cd apps/web && npm run spe:copy-check` | `0` | 0 unreviewed, 0 violations |
| `cd apps/web && npx tsc --noEmit && npx vite build && node scripts/cache-shell.mjs` | `0` | TypeScript + Vite + cache shell PASS |
| `cd apps/web && npm run test:predeploy-qa` | `0` | 18 predeploy cases PASS |
| `node tools/deployment-safety-gate.mjs` | **`2`** | expected fail-closed; `HOSTING=FORBIDDEN` |
| `node proofs/.../batch_f/capture_capabilities.mjs` | `0` | dark/light/mobile screenshots |

### Full `npm run build` note

`npm run build` invokes `copy-wasm`, which refuses the **local** `portable/spe-wasm/.../spe_wasm.wasm` because that checkout target embeds `/Users/` path metadata. Shipped `apps/web/public/spe_wasm.wasm` is clean (no home-path markers). Batch F did not rebuild WASM; production build path used the existing public asset via `tsc` + `vite build` + `cache-shell` after copy-check. Residual: remap-path-prefix rebuild of local target if full `npm run build` is required on this machine.

### Runtime SEO probe

`proofs/spe_v1_continuation/batch_f/runtime_seo_probe.json` — on `/capabilities`:

- title: SPE Capabilities — Local Prompt Engine Features
- canonical: `https://systempromptengine.com/capabilities`
- JSON-LD: `WebApplication` + `WebPage` + `FAQPage`
- `#capabilities-title` and `#faq` present

## Screenshots

| File | Notes |
|------|-------|
| `capabilities-dark.png` | Desktop 1440 dark |
| `capabilities-light.png` | Desktop 1440 light |
| `capabilities-mobile.png` | 393×852 dark |
| `screenshot-manifest.json` | SHA-256 per shot |

## Allowed claims

| Claim | Status | Evidence |
|-------|--------|----------|
| `BATCH_F_IMPLEMENTATION_PRESENT` | **SUPPORTED** | `/capabilities` route, page, sitemap/robots, JSON-LD, nav/footer links |
| `BATCH_F_TESTED_WITHIN_DECLARED_SCOPE` | **SUPPORTED** | Commands + exits above (local Mac checkout) |
| `WORLD#1` | **NOT_PROVEN** | Explicitly denied in FAQ + meta; no ranking claim |
| `HOSTING` | **FORBIDDEN** | Deploy safety gate exit `2` |

## Residuals

- Full `npm run build` on this Mac needs WASM remap-path-prefix rebuild of local target (pre-existing; not Batch F).
- Live apex crawl / Search Console verification **not** run (HOSTING forbidden).
- HowTo schema not added (FAQPage sufficient for this slice).
- Batch G+ not started.
