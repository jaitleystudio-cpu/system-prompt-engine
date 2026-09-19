# SPE-WEB-02 PREMIUM 3D EXPERIENCE REPORT

## SOURCE

base: `931128b384c3055ecef876124f787e5b8e67651b` (requested) / practical WEB-01 HEAD `90cd6094403d7553daefa7c7ee5c0c0287221900`

branch: `cursor/spe-web-02-premium-3d-0d6e`

HEAD: _(see git after final commit)_

PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/37

WEB-01 PR: #36

## VISUAL REBUILD

old dashboard shell removed: YES — narrow status-badge nav, developer telemetry chrome, static before/after debug blocks removed from landing

hero: full-viewport cinematic composition; SPE mark + System Prompt Engine display type; premium command surface; Build with SPE CTA; Local-first · Any AI · Free core

semantic 3D: living SPE intelligence object (`SpeIntelligence`) — states IDLE / LISTENING / UNDERSTANDING / STRUCTURING / COMPILING / READY mapped from compile phases; Three.js + React Three Fiber lazy chunk; LITE CSS orbital fallback

scroll story: problem → intent → strategy → reveal → any AI → .spe → moonshot (COMING/PLANNED honest) → daily → privacy → final CTA

brand system: replaceable `Logo` component; brass/mist material tokens; editorial display + UI body roles; no purple-neon SaaS palette

workspace: Prompt instrument — Simple / Inspect / Pro; lenses Prompt / Intent / Changes / Techniques / Artifact; telemetry only in Inspect/Pro

intent lens: CONFIRMED / ASSUMED / UNKNOWN / CONFLICT with icon + label + surface (not color-only)

prompt lens: Prompt ready meta + typography reveal + Copy / Download .spe / JSON / Import

.spe visualization: scroll section + workspace artifact lens + export path preserved

## 3D

technology: Three.js `0.170` + `@react-three/fiber` `8.17` (locally bundled; CDN banned)

fallback: CSS luminous core + rings + orbits (quality `LITE`)

mobile profile: `BALANCED` when coarse/narrow + WebGL; `LITE` without WebGL or reduced-motion

reduced motion: quality forced `LITE`; CSS animations disabled; premium static composition retained

## ENGINE PRESERVATION

real WASM: YES (`spe_wasm.wasm`, sha256 `8e535b8a6972a2af1505000d43b570b2966ed6950777fbb705dccc2e74655129`)

worker: YES (`engine.worker`)

TS semantic fallback: NO (`used_ts_fallback: false`)

offline: YES (PWA shell + local WASM)

PWA: YES (`sw.js` cache `spe-web-shell-v2`)

integrity: fail-closed `WASM_INTEGRITY_MISMATCH`

## PRIVACY

analytics: NONE

compile egress: 0 (`egress_proof.json` zero_egress)

remote visual dependencies: NONE (no Google Fonts / CDN three)

## PERFORMANCE

bundle: app JS ~174 kB / gzip ~56 kB; SpeIntelligence lazy ~826 kB / gzip ~223 kB; CSS ~18 kB

hero load: shell paints without waiting for 3D chunk (Suspense + LITE fallback)

interaction: Build with SPE → worker → WASM evaluate

mobile observations: shorter hero stack; burger nav; LITE/BALANCED quality tiers

asset budget: within (`dist_js_css` under 1.5 MB; wasm under 2 MB)

## ACCESSIBILITY

keyboard: nav, command (⌘/Ctrl+Enter), workspace tabs, skip-link

screen reader: labels on command, modes, lenses, intent atoms

reduced motion: premium LITE path

320: layout compresses; hero title clamp

200%: fluid type + reflow (no fixed-only chrome)

## TESTS

exact command: `python3 -m pytest -q`

exact count: 450 passed

exit code: 0

web subset: `python3 -m pytest -q tests/web` → 37 passed

engine: `npm run test:engine` → VALID, used_ts_fallback false

audits: `npm run audit:deps` / `audit:assets` / `audit:egress` → ok

## SCREENSHOTS

See `proofs/spe_web_02/ARTIFACT_INDEX.md` and `proofs/spe_web_02/screenshots/`.

Walkthrough copies:

- `/opt/cursor/artifacts/screenshots/spe-web-02-hero-1440x900.png`
- `/opt/cursor/artifacts/screenshots/spe-web-02-midscroll-problem.png`
- `/opt/cursor/artifacts/screenshots/spe-web-02-workspace.png`
- `/opt/cursor/artifacts/screenshots/spe-web-02-intent-lens.png`
- `/opt/cursor/artifacts/screenshots/spe-web-02-hero-mobile.png`

## G6-H

frozen: YES (untouched; PR #6 not merged; no `spe_runtime/omega/`)

## CLAIMS

production: NOT QUALIFIED

human value: pending frozen G6-H

World #1: NOT PROVEN

not_a_release: true

## FINAL VISUAL VERDICT

**PREMIUM_3D_EXPERIENCE_PASS**

Evidence: 1440×900 hero shows unmistakable SPE brand, full-viewport composition, premium typography, dominant Build with SPE command surface, depth + intelligence object, clean nav without telemetry badges, local-first trust line, product purpose clear in &lt;5s. Scroll story and Simple/Inspect/Pro workspace replace the WEB-01 developer dashboard shell while preserving the WASM engine path.

STOP after WEB-02.
