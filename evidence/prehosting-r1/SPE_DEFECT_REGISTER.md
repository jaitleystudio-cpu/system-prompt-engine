# Defect register (all OPEN — no fixes applied in r1)
| ID | Sev | Area | Finding | Evidence |
|---|---|---|---|---|
| PH-001 | HIGH | Claims | Unsupported absolute claims in shipped UI: "zero hallucinations" (SpeStorytellingCinema.tsx:436, AudioStudio.tsx:119), "100% private" (index.html:122, ValueComparisonMatrix.tsx:144), "100% offline air-gap · $0.00 spend" (ValueComparisonMatrix.tsx:200), "Guaranteed test pass" (BeforeAfterDiffSlider.tsx:69), "Zero-Egress Guarantee" (App.tsx:1588), "Mathematical proof guarantees the agent never loops" (SpeStorytellingCinema.tsx:127), "100% offline" meta descriptions (evidence-pages/tools_audio-to-text.html). Fix = copy change -> HUMAN_COPY_REVIEW_REQUIRED | rg output |
| PH-002 | HIGH | Governance | `spe:copy-check` and `test:copy` PASS while PH-001 claims ship -> prohibited-claim gate has a coverage gap | t_spe:copy-check.log |
| PH-003 | HIGH | A11y | axe WCAG 2.x AA: color-contrast (serious) on every page (13 nodes on /, 29 on /capabilities); label-content-name-mismatch (17 on /); `label` critical on /capabilities; target-size (2.2) x4 on /capabilities; link-in-text-block on evidence privacy page | raw/browser-audit.json |
| PH-004 | MED | A11y/QA | Repo harness `test:a11y` reports "100% PASSED" (WCAG 2.1 only) while axe finds serious violations -> harness under-reports; WCAG 2.2 target not covered | t_test:a11y.log |
| PH-005 | HIGH | Perf | Lighthouse mobile perf 33 (/), 44 (/create); TBT 3.1 s; main chunk index-*.js 1.12 MB (339 KB gz) + r3f 832 KB; LCP mobile 5.0–6.0 s (lab) | raw/lighthouse |
| PH-006 | MED | SEO | Home page has no <h1> | browser-audit |
| PH-007 | MED | SEO | Unknown routes return HTTP 200 with "Page not found" (soft 404) on preview; host-level 404 config unverified | curl /nonexistent-xyz |
| PH-008 | MED | Product | /studio renders "Page not found" and is Disallowed in robots.txt, yet C13-B onboarding text points users to the Studio | browser-audit |
| PH-009 | MED | Product/Policy | /pricing "Plans & Pricing" page and ContextualAdSlot component present; conflicts with C13-Q D-10 (no prices in UI) pending owner decision | build output |
| PH-010 | HIGH | Security | npm audit: 3 high (vite, playwright[dev], source-map-js), 1 moderate (esbuild). vite is build/dev-time; runtime exposure UNVERIFIED | raw/npm-audit.json |
| PH-011 | LOW | Perf | dist is 62 MB incl. 11 MB onnxruntime WASM | du |
| PH-012 | LOW | UI | Horizontal overflow at 390px on /evidence-pages/privacy.html | browser-audit |
| PH-013 | LOW | A11y | /daily-lab: 50 links/buttons with no accessible text by heuristic (axe did not flag; needs manual check) | browser-audit |
