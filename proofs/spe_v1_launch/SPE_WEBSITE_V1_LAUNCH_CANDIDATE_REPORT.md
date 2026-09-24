# SPE WEBSITE V1 LAUNCH CANDIDATE REPORT

Date: 2026-09-24 (Asia/Calcutta)
Branch: `grok/spe-v1-launch-20260924`
Base: `646d3765153f66c3951d812b8adfd87fcbf766b1` (PR #40)
PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/41 — **OPEN, DO NOT MERGE**

## 1. Verdict

**SPE_V1_REBUILD_REQUIRED**

P0 correctness defects from the defect-closure brief were closed on this branch (intent desync, Daily Lab contamination, async races, URL trust boundary, .spe export, media bounds). Product meaning and visual polish improved honestly. **Launch-candidate READY is blocked** primarily by apex not serving SPE, plus remaining capability quality gaps that must not be marketed as READY.

## 2. Custody SHAs (fill tip after final commit)

| Token | Meaning | SHA |
| --- | --- | --- |
| IMPLEMENTATION_TESTED_SHA | Last implementation commit with suites green | _(see section 12)_ |
| VISUAL_EVIDENCE_SHA | Commit containing round-3 screenshots + reviews | _(see section 12)_ |
| REPORT_SHA | Commit that authors/updates this report | _(see section 12)_ |
| CURRENT_PR_HEAD | Tip of `grok/spe-v1-launch-20260924` after push | _(see section 12)_ |

## 3. Product law compliance

| Law | Status |
| --- | --- |
| UI → Web Worker → spe_wasm.wasm → spe-core-rs | PASS (engine fixture VALID; browser Text→Prompt Ready to use) |
| Media = observations, not second K3 writer | PASS |
| No JS semantic mock / WASM integrity fail-closed | PASS |
| Zero mandatory paid APIs / vision / proxy | PASS |
| No spe_runtime/omega/ | PASS |
| No fabricated READY / G6-H / World #1 | PASS (this report corrects prior inflated READY matrix) |

## 4. Capability matrix (truthful)

| # | Capability | Status | Notes |
| --- | --- | --- | --- |
| 1 | Text→Prompt (WASM) | READY_WITHIN_TESTED_SCOPE | Browser E2E + engine fixture VALID |
| 2 | Speech→Prompt | IMPLEMENTATION_PRESENT / DEVICE_QUALIFICATION_PENDING | Browser speech varies; honesty copy in SpeechInput |
| 3 | Image→Prompt | IMPLEMENTATION_PRESENT / QUALITY_GAP | Local pixel observations + human summary; no semantic vision |
| 4 | Screenshot→Code | IMPLEMENTATION_PRESENT / QUALITY_GAP | Six human-labeled targets; brightness IR; honest scaffolds |
| 5 | Video→Prompt | IMPLEMENTATION_PRESENT / QUALITY_GAP | Bounded sampling, dedupe, sequence summary |
| 6 | URL→Website | IMPLEMENTATION_PRESENT / QUALITY_GAP | Bounded stream, timeout, finalUrl, DOMParser brief when available; UNTRUSTED_SOURCE |
| 7 | 3D Daily Lab /lab | PRODUCT_DIRECTION_MISMATCH | Prompt gallery with honesty banner; not premium daily 3D experiences |

## 5. P0 fixes landed (Wave 1)

- **C** Intent: `AUTO_DERIVED_INTENT` vs `USER_EDITED_INTENT`; Create/simple rederives; Inspect/pro preserves edits
- **D** Daily Lab open resets intent + maps specimen category; mode=simple
- **E** Screenshot `codeTarget` canonical; changing target updates request; human labels for all 6
- **F–G** Composer `valueRef` / opId / `AbortController`; ignore stale results
- **H** Mode switch clears mode-specific state; revoke object URLs
- **I** Clipboard `await` + real success/fail (App + composer)
- **J** Export `.spe` (not `.spe.json`); import accept includes `.spe`
- **K–N** File bounds before decode; source vs analysis dims; alpha-consistent grid; transparent PNG fixture
- **Y–AB** URL bounded stream read; timeout/abort; final URL; failures **not** appended as user intent
- **AC–AD** `UNTRUSTED_SOURCE` provenance boundary; adversarial HTML injection tests

## 6. Wave 2–3 product / copy / a11y

- Image human summary + diagnostics separated; status stays QUALITY_GAP
- Screenshot band-contrast confidence; honest scaffold wording
- Video scene dedupe + sequence summary
- URL DOMParser website build brief
- Daily Lab: removed “Same date, same set…”; marked PRODUCT_DIRECTION_MISMATCH gallery
- Privacy benefit-first; technical proof expandable (`data-copy-depth=PROOF`)
- Hero IDEA→MEANING→STRUCTURE→PROMPT; Create premium copy
- Speech qualification honesty; focus-visible + reduced-motion CSS
- Copy gate: reviewed inventory refreshed (1073 entries, 0 violations)

## 7. Test commands (fresh this session)

| Suite | Command | Result | Exit |
| --- | --- | --- | --- |
| Full pytest | `python -m pytest -q` | **516 passed** | 0 |
| Web gates | `python -m pytest tests/web -q` | **51 passed** | 0 |
| spe-core-rs | `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --quiet` | **19 passed** (4+2+13) | 0 |
| spe-wasm | `cargo test --manifest-path portable/spe-wasm/Cargo.toml --quiet` | **2 passed** | 0 |
| Engine fixture | `cd apps/web && npm run test:engine` | VALID, `used_ts_fallback: false` | 0 |
| Production build | `cd apps/web && npm run build` | PASS (copy gate 0 unreviewed) | 0 |
| Media unit | `node apps/web/scripts/test-media-observe.mjs` | ok (alpha, 6 labels, UNTRUSTED, stream bound, dedupe) | 0 |

## 8. Deployed-header honesty

Live apex `https://systempromptengine.com` returns **HTTP 200**, `Content-Length: 114` — parked lander-class response, **not** the SPE app.

`https://systempromptengine.com/lander` sets `lander_type=parkweb` cookies. **Do not claim SPE CSP / frame-ancestors on apex.**

Static `apps/web/public/_headers` still ships CSP + nosniff + referrer for hosts that honor `_headers`.

Evidence: `proofs/spe_v1_launch/apex_headers.txt`, `lander_headers.txt`.

## 9. Visual QA (3 genuine rounds)

Under `proofs/spe_v1_launch/visual_rounds/`:

| Round | Focus | review.md |
| --- | --- | --- |
| 1 | Post Wave 1–3 baseline | `round-1/review.md` |
| 2 | Narrow composer chip density | `round-2/review.md` |
| 3 | Lab title contrast + privacy lede wrap | `round-3/review.md` |

Canonical recaptures also in `proofs/spe_v1_launch/screenshots/` (fresh from final implementation; Playwright + system Chrome; CSP-safe waits).

Uniqueness: 03≠04 and 06≠07 verified each capture.

## 10. Remaining CT blockers

1. **Apex does not serve SPE** (`/lander` park) — absolute blocker for LAUNCH_CANDIDATE_READY
2. Image / Screenshot / Video / URL **QUALITY_GAP** (zero-cost lite path; not semantic READY)
3. Speech **DEVICE_QUALIFICATION_PENDING**
4. Daily Lab **PRODUCT_DIRECTION_MISMATCH** vs premium daily 3D website experiences
5. Founder DNS/hosting required to put SPE on a real production origin

## 11. What was not done (guardrails)

- Did **not** merge PR #41 / #6 / #37 / #38
- Did **not** create `spe_runtime/omega/`
- Did **not** rebase for obsolete mergeable=false
- Did **not** fabricate READY / production qualification / apex header proof
- Did **not** spend owner ₹ on paid vision/proxy APIs

## 12. Branch / tip (updated at report commit)

See git tip after this file is committed and pushed. Parent agent should treat `CURRENT_PR_HEAD` as `git rev-parse origin/grok/spe-v1-launch-20260924` post-push.

## 13. Final token

**SPE_V1_REBUILD_REQUIRED**
