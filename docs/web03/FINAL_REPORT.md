# SPE-WEB-03 cinematic rebuild report

## Source and scope

Requested upstream baseline: `0730cfb1f2013490bbd08dcde35193feed684603`, PR #37. The GitHub connector reported PR #37 had subsequently advanced to `d9248e5176b05548221250c39a08e7ecb04a3b30`; this build deliberately uses the requested 0730cfb snapshot. Source was downloaded through the authenticated GitHub connector, then committed locally as `f871122` because shell GitHub authentication was unavailable. That local snapshot commit is not the original upstream commit.

Local branch: `spe-web-03-semantic-press`. WEB-02 visible composition rejected and replaced. Upstream PR #6 untouched/unmerged. No `spe_runtime/omega/` created. No `sources/` files edited.

## What changed

Original procedural folded-metal semantic press, generated studio lighting, pointer-responsive camera, actual output-driven count/assembly, integrated composer, returned semantic readout and artifact reveal. Editorial scroll narrative covers request, structure, unknowns, artifact portability and privacy. Workspace retains category/target, Simple/Inspect/Pro, prompt/intent/changes/techniques/artifact views, .spe/JSON and optional local history.

No invented free-text understanding: the baseline represents the request as a goal atom, with supplied constraints/preferences/questions. Visualization reads only returned envelope collections. Unknowns remain offset; visible scene elements are capped at 12 and the cap is disclosed. Engine phases use their real technical meaning.

New responsive composition uses static dimensional imagery by default on small/coarse-pointer devices, with explicit 3D opt-in. Reduced-motion stays static. Desktop 3D is lazy-loaded, pauses offscreen/when the document is hidden, and caps device-pixel ratio at 2. HTML contains the meaningful information independently of canvas.

Fixed discovered baseline issues: service-worker registration missing an already-fired load event; incomplete precaching of hashed chunks; cache matching with Vary headers during offline module loads; stale intent after workspace request edits; output keyboard focus; incomplete tab roles; Linux-only Node paths in conformance tests. Added clipboard feedback and workspace navigation reset.

## Preserved engine and privacy

Rust source, Python runtime, WASM host, Worker and web-runtime semantics are unchanged. WASM was rebuilt from the unchanged locked Rust source with the local toolchain: 238,183 bytes; SHA-256 `1d0bb18e1c92c1777c80ad34bb8defb90c7b489781f6f61277eb23da6d5af116`. Binary differs from the historical shipped binary because it was rebuilt; integrity metadata matches it. The integrity gate rejects tampering. No TypeScript semantic fallback, analytics, required provider, external fonts, stock assets or mandatory model spend.

The protected-path diff is empty for `portable`, `spe_runtime`, `packages`, `benchmarks`, and `evaluations`. Frozen G6-H artifacts were not modified; no ratings were created. The requested baseline snapshot does not contain the separate G6-H study dataset, so no claim is made about its external status.

## Verification

Python full: 450 passed, 0 failed, 0 skipped, exit 0. Web subset: 37 passed. Rust core: 27 passed across integration suites; WASM: 2 passed. Release WASM build and TypeScript/Vite production build pass. Dependency-policy, zero-egress and asset-budget scripts pass. Initial setup failures and historical baseline counts were not used as final evidence.

Browser: genuine compile, five actual returned elements, .spe export, offline page reload and compilation, reduced-motion static fallback, no overflow at tested widths or 200% root text scaling. Deliberate byte corruption produces WASM_INTEGRITY_MISMATCH with no result. Zero page errors in the completed browser audit. Four axe runs have zero violations. Browser trace and desktop/mobile recordings retained.

Mobile Lighthouse: performance 100, accessibility 100, best practices 100; LCP 1.4s, TBT 10ms, CLS 0, in one local lab run. Earlier live-3D mobile startup scored 65 with TBT 3870ms; this drove the third refinement. Field INP and real-device GPU/battery behavior are not established.

Initial app JS approximately 179 KB / 58 KB gzip; lazy Three.js scene approximately 829 KB / 224 KB gzip; CSS approximately 26 KB / 7 KB gzip. No font, texture or external model files. The build emits a warning for the large lazy scene chunk; it is not executed by default on mobile. Full runtime bytes remain within the repository's 1.5 MB JS/CSS budget.

## Visual review

Round 1 rejected broad flat plates and oversized plinth; refined silhouette, materials and hero sizing. Round 2 rejected mobile startup cost and fixed accessibility findings. Round 3 uses smooth parametric surfaces, removes detached decorative edges, provides mobile opt-in, tests static and live outputs, and captures 3840×2160 proof. Review records and screenshots are under `proofs/web03/visual_review/`.

Five-perspective internal assessment is in SCORECARD.md. No independent human jury was recruited. The ten-act narrative, real-device testing, and independent award-level visual approval are not complete. Therefore the verdict remains **SPE_WEB03_VISUAL_REBUILD_REQUIRED**, not a fabricated 10/10.

## Tools and plugins

Used: authenticated GitHub source access; Vercel React guidance and deployment investigation; Sites hosting workflow; Three.js/React Three Fiber; Playwright screenshots/video/trace; axe-core; Lighthouse; Rust/Python/Node regression tools; recovered reference image and original brief. MockFlow connection skill confirmed its bridge was unavailable. Vercel account reads worked but deployment tool returned `Tool deploy_to_vercel not found`; private Sites hosting is the fallback.

Figma, Adobe, Gamma, Ace Knowledge Graph and Replit were inspected for relevance/availability but not invoked to create unrelated deliverables. The scene uses original procedural geometry; a stock-image edit, duplicate Replit app, presentation, or knowledge graph would not improve this implementation or preserve its baseline more reliably. Visualize did not expose a dedicated callable tool in this session. No claim that every named plugin was used.

## Claim boundary

Production: NOT QUALIFIED. Independent replication: NOT PROVEN. World #1: NOT PROVEN. Award won: NO CLAIM. Human-value ratings: NOT FABRICATED. This is a working design review build.

## Evidence

- `proofs/web03/visual_review/round-3/hero-4k.png`
- `proofs/web03/visual_review/round-3/artifact-4k.png`
- `proofs/web03/visual_review/round-3/mobile-fresh.png`
- `proofs/web03/visual_review/round-3/mobile-webgl.png`
- `proofs/web03/visual_review/round-3/semantic-transformation.png`
- `proofs/web03/visual_review/round-3/prompt-reveal.png`
- `proofs/web03/visual_review/round-3/workspace.png`
- `proofs/web03/visual_review/round-3/intent-lens.png`
- `proofs/web03/visual_review/round-3/reduced-motion.png`
- `proofs/web03/browser-audit.json`, `browser-trace.zip`
- `proofs/web03/lighthouse-mobile-final.json`
- `proofs/web03/video/desktop-journey.webm`, `mobile-journey.webm`
- `proofs/web03/tests/`
