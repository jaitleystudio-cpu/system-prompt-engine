# Lane G4 — PR #95 verify and website-export closure

Date: 2026-10-03 (Asia/Calcutta)
Verify worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-g4-pr95-verify` (detached, no commits)
Repair worktree: `/Volumes/4TB-WD/spe-worktrees/spe-lane-g4-website`
START_SHA: `3ee99b911132e37acebb03ab300d05dc51c1713b` (PR #95 head; history not amended)

## PR95_VERIFY = NEEDS_REPAIR

PR #95 (`grok/spe-r2-88-reconcile-20261001`) is an open draft. Its tip matches the requested SHA. The F1–F7 port commit is real and the existing compiler harness passes on that SHA. It is not a clean close of website creation.

| Claim | At 3ee99b9 | Result |
| --- | --- | --- |
| Static website builder (React/web, local TS `website-spec/1`) | `apps/web/src/builder/*` present. Not mounted in `App.tsx`. `ROUTE_MOUNT_STATUS=NOT_INTEGRATED`. `G13_PACKAGE_BOUND=false`. | KEEP the honesty. Not product-mounted. |
| Safe href / escaping | `SAFE_HREF`, `PAGE_PATH`, `escapeHtml` refuse the harness cases (`javascript:`, `https:`, `//`, `../`, raw `<script>`). | KEEP |
| Single-file export | `toStandaloneDocument` inlines CSS and rejects a second doctype. | KEEP the single-doctype check |
| Style breakout | `toStandaloneDocument(html, "body{}</style><script>alert(1)</script>")` emitted a raw script. | DEFECT (reproduced) |
| Page identity | `compileWebsiteSpecToStaticHtml(spec, "missing.html")` silently returned page 0. Duplicate paths accepted. Unknown `kind` dropped. | DEFECT (reproduced) |
| Deterministic export | HTML/CSS compile is pure. Spec JSON download name used `Date.now()`. | DEFECT for the spec filename |
| CSP | Exported document had no Content-Security-Policy. | DEFECT |
| Responsive | Builder chrome and export CSS reflow at 360px. Desktop control was labeled `1200px` while the frame width is `100%`. | LABEL DEFECT |
| Reduced motion | Builder chrome CSS has `prefers-reduced-motion`. Exported CSS did not. | DEFECT on the artifact |
| a11y | Builder chrome has `:focus-visible` and 44px targets. Export had no focus ring, no `<main>`, and `--site-accent: #6366f1` with white text at contrast 4.47 (below 4.5). UI said `Status: VERIFIED` and `WCAG 2.1 AA Styled CSS` with no audit. | DEFECT / false claim |
| Three.js / 3D | Builder constant `SCENE_3D=NOT_AVAILABLE`. Preview is Canvas 2D isometric, not WebGL. Hero `SpeIntelligence` is real Three.js and is not this export. | KEEP the builder truth label. Do not claim a 3D website export. |
| AI generation | `AI_GENERATION=NOT_AVAILABLE` in model and banner. | KEEP |
| URL reconstruction / webrecon | No webrecon package on this SHA. `ReconstructionSummary` is workspace restore UI. `urlIngest.ts` is media-owned and was not edited. | HOLD |

Existing harnesses on the verify SHA (before this branch): compiler PASS, builder UI contract PASS. Those harnesses did not cover the defects above.

## Repair on this branch

Failing tests landed first (`test(web): reproduce static website export fail-open defects`), then the compiler/UI fix.

- Unknown active page, duplicate paths, unknown section kind, empty heading, and non-string items throw `WebsiteCompileError`.
- Standalone export refuses CSS that closes `style` or introduces `script`.
- Export carries a script-refusing CSP, one `<main>`, a skip link, `:focus-visible`, and `prefers-reduced-motion`.
- Button accent is `#4338ca` (white contrast about 7.9, both themes). This is not a WCAG certificate.
- Preview iframe `sandbox=""` (no `allow-scripts`, no `allow-same-origin`).
- Spec download name is `website-spec.json`.
- False `VERIFIED` and `WCAG 2.1 AA` labels removed. Desktop control says `Desktop (fluid)`.
- Canvas wireframe is `aria-hidden`. 3D and AI banners stay `NOT_AVAILABLE`.

Not changed: `App.tsx` routing (G5), media, scholarly, codevision, project library, ledger, WASM, hero Three.js.

## Tests

- `node --experimental-strip-types apps/web/scripts/test-static-website-compiler.mjs` PASS after the fix (failed before the fix on missing-page fallback).
- `node apps/web/scripts/test-static-website-builder.mjs` PASS after the fix (failed before the fix on `Status: VERIFIED`).
- `python3 -m pytest tests/web/test_static_website_builder.py` not run: `No module named pytest` on this machine. The pytest file only shells out to the node harness above.

## Browser

Chrome headless `--dump-dom` of the generated standalone file at `/tmp/g4-web-qual/index.html` returned the document with the CSP meta, `<main>`, accent `#4338ca`, and zero `<script` tags. The headless process did not exit on its own and was killed (`user-data-dir=/tmp/g4-chrome-profile` only).

BROWSER=EXPORT_DUMP_ONLY
React builder UI qualification = WAITING_EXTERNAL (component is still `NOT_INTEGRATED` and was not opened in a browser).

## Still HOLD

- URL reconstruction library is ported from frozen c1/PR #64 and is not route-mounted. PR #78 website-generator was not copied. Hosted/live reconstruction stays NOT_AVAILABLE.
- Hosted publish remains HOLD. No deploy.
- Route mount remains NOT_INTEGRATED.
- G13 Python website package remains unbound.
- Hero Three.js scene contract receipt (hardcoded draw/triangle estimates) was not treated as a website-export owner and was not rewritten.
- Full interactive browser pass of the builder UI is WAITING_EXTERNAL.

## WebRecon port (2026-10-03)

Source (read-only, frozen): `spe-c1-webrecon-r1` tip `1259bd4`, which is PR #64 `f2f67c0` plus the R1 quarantine repair `4f5a770` / qualification `89bc11e` / `1259bd4`. PR #78 is `packages/website-generator` only and was not copied. Live lane worktrees were not read.

Port is the library only: `spe_runtime/webrecon/`, schema, foundation tests, and `qualification/webrecon_r1/oracles.py`. No `App.tsx`, `Nav.tsx`, shell, or route table edits. `ROUTE_MOUNT_STATUS` stays `NOT_INTEGRATED`.

Labels added on the package (not in the frozen donor): `LIVE_RECONSTRUCTION=NOT_AVAILABLE`, `HOSTED_PUBLISH=HOLD`, `SCENE_3D=NOT_AVAILABLE`, `AI_GENERATION=NOT_AVAILABLE`. The donor already refuses non-allowlisted and non-http(s) URLs and does not fetch. No new 3D qualification was run. Hero Three.js was not touched.

Tests after the port: `test_webrecon_g4_url_closure.py`, `test_webrecon_foundation.py`, `test_webrecon_r1_qualification.py` — 39 passed. Compiler and builder harnesses re-run PASS.

## Website-generator port (2026-10-03)

Source: PR #78 commit `85f9ebda420936142cb864f281ad3a3a02a55e2c` via `git archive` (not a live lane worktree). The change is only `packages/website-generator/`. No App.tsx, nav, shell, or route table. It is a library, not a UI route.

Compiled output keeps `hosted: false`, `ai_site_engine: false`, `three_d: false`. `hosted_export` is HOLD and `sandbox_preview` is UNSUPPORTED. Neither is a pass. `javascript:` and network hrefs raise `WebsiteSpecError`. A `<script>` body is escaped and is not emitted as a script element. `LIVE_RECONSTRUCTION` remains `NOT_AVAILABLE` on `spe_runtime.webrecon` and is not claimed by the generator.

Tests: `test_website_generator_g4_closure.py` failed closed on missing module, then passed with the donor compiler tests and `test_webrecon_g4_url_closure.py` (14 passed). Compiler harness and builder harness re-run PASS.
