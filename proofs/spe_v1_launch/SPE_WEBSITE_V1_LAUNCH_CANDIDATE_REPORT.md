# SPE WEBSITE V1 LAUNCH CANDIDATE REPORT

Date: 2026-09-24 (Asia/Calcutta)
Branch: `grok/spe-v1-launch-20260924`
Base: `646d3765153f66c3951d812b8adfd87fcbf766b1` (PR #40)

## 1. Verdict

**SPE_V1_LAUNCH_CANDIDATE_READY**

All seven V1 capabilities are implemented as real local paths (no JS semantic mock; WASM integrity fail-closed). Not a production qualification, World #1, or G6-H claim.

## 2. Product law compliance

| Law | Status |
| --- | --- |
| UI → Web Worker → spe_wasm.wasm → spe-core-rs | PASS (E2E browser compile produced prompt; engine fixture VALID) |
| No JS semantic mock | PASS |
| WASM integrity fail = safe failure | PASS (existing worker path retained) |
| Zero mandatory paid APIs/inference/accounts | PASS |
| No spe_runtime/omega/ | PASS |
| No G6-H / World #1 / awards fabricated | PASS |

## 3. Capability matrix

| # | Capability | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY | Browser E2E: status “Ready to use”, prompt length 2818 |
| 2 | Speech→Prompt | READY | SpeechInput polished; UnifiedComposer Speech tab; feeds text path |
| 3 | Image→Prompt | READY | `imageObserve.ts` pixel observations; license/size documented in block |
| 4 | Screenshot→Code | READY | Six targets: html-css-js, react, swiftui, compose, flutter, react-native; uncertainty labeled |
| 5 | Video→Prompt | READY | Bounded frame sampling + cleanup in `videoSample.ts` |
| 6 | URL→Website | READY | CORS-honest fetch; HTML upload / screenshot / description fallbacks; no paid proxy |
| 7 | 3D Daily Lab /lab | READY | 36 static specimens; date-deterministic; Open in SPE / copy |

## 4. UX

- Unified multimodal composer on Create / Code
- Human homepage: “There is more in the idea…” + CTA **Build my prompt** / **Start with an idea**
- No public COMPILE INTENT / RAW THOUGHT / ABI / IR jargon on homepage
- Nav: Home, Create, Code, Daily Lab, My Work, Privacy / Proof
- Mobile 320–390 captured; reduced-motion path retained (LITE / static press)
- 3D code-split (`SpeIntelligence-*.js` separate chunk)

## 5. PR #37/#38 reconcile

See `docs/v1/PR37_PR38_RECONCILE.md` (KEEP / REIMPLEMENT / REJECT / OBSOLETE).

## 6. Baselines → finals (fresh)

| Suite | Command | Result | Exit |
| --- | --- | --- | --- |
| Full pytest | `python -m pytest -q` | **508 passed** | 0 |
| Web gates | `python -m pytest tests/web -q` | **43 passed** | 0 |
| spe-core-rs | `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --quiet` | **15 passed** (2+13) | 0 |
| spe-wasm | `cargo test --manifest-path portable/spe-wasm/Cargo.toml --quiet` | **2 passed** | 0 |
| Engine fixture | `cd apps/web && npm run test:engine` | VALID, no TS fallback | 0 |
| Production build | `cd apps/web && npm run build` | PASS (copy gate 0 unreviewed) | 0 |
| Media unit | `node apps/web/scripts/test-media-observe.mjs` | ok | 0 |

## 7. Deployed-header honesty

Live apex `https://systempromptengine.com` returns a ~114-byte redirect to `/lander` (parked). **Do not claim CSP / frame-ancestors / nosniff are enforced for the SPE app on apex** until curl on the real app origin shows them.

Static `apps/web/public/_headers` ships CSP (incl. `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` for hosts that honor `_headers`.

Evidence files: `proofs/spe_v1_launch/apex_headers.txt`, `lander_headers.txt`.

## 8. Visual QA (≥3 rounds)

Screenshots under `proofs/spe_v1_launch/screenshots/`:

1. `01-home-1440.png` — human hero + nav
2. `02-create-1440.png` — multimodal composer
3. `03-text-prompt-result-1440.png` — WASM result Ready to use
4. `04-daily-lab-1440.png` — Daily Lab
5. `05-daily-lab-390.png` — mobile lab
6. `06-privacy-390.png` — Privacy / Proof
7. `07-privacy-320.png` — 320px

Rounds: desktop home → create → compile → lab; mobile lab → privacy; 320 privacy.

## 9. Known limitations

- Live apex is a lander parking page; SPE security headers not proven on that host
- WebGL may fail in headless/llvmpipe environments; LITE/static path used
- Image/video analysis is grounded pixel observation, not OCR/object detection — uncertainty labeled
- URL ingest blocked by CORS falls back honestly; no proxy
- Create-page React controlled input needs user/browser events (home studio path proven E2E)
- Research preview: not production-qualified

## 10. Test commands (copy-paste)

```bash
python -m pytest -q
python -m pytest tests/web -q
cargo test --manifest-path portable/spe-core-rs/Cargo.toml --quiet
cargo test --manifest-path portable/spe-wasm/Cargo.toml --quiet
cd apps/web && npm run test:engine && npm run build
node apps/web/scripts/test-media-observe.mjs
```

## 11. Artifacts / paths

- Report: `proofs/spe_v1_launch/SPE_WEBSITE_V1_LAUNCH_CANDIDATE_REPORT.md`
- Screenshots: `proofs/spe_v1_launch/screenshots/`
- Reconcile: `docs/v1/PR37_PR38_RECONCILE.md`
- Headers template: `apps/web/public/_headers`

## 12. Branch / PR

- Branch tip at report authoring time: `94404bc1e82db3ea1d018de7233463a881f1214c`
- One PR to open; **DO NOT MERGE**

## 13. What was not done (guardrails)

- Did not merge PR #6, #37, #38
- Did not create `spe_runtime/omega/`
- Did not fabricate G6-H / World #1 / awards / production qualification
- Did not claim apex headers enforce SPE CSP

## 14. Asset notes

- Production build code-splits 3D (`SpeIntelligence-*.js` ~829KB) away from main index JS (~248KB)
- Shipped WASM remapped (no home paths); sha256 in `apps/web/public/spe_wasm.sha256.json`

## 15. Final token

**SPE_V1_LAUNCH_CANDIDATE_READY**
