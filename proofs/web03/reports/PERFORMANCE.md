# WEB-03 performance report

## Result

PASS against the defined hard delivery budgets.

## Production build

| Measurement | Fresh result | Budget | Status |
|---|---:|---:|---|
| WASM | 249,893 bytes | 2,000,000 bytes | PASS |
| JavaScript + CSS | 1,062,638 bytes | 1,500,000 bytes | PASS |
| Full `dist/` | 1,315,196 bytes | informational | — |
| Production files | 10 | informational | — |
| Authored image/texture/model payload | 0 bytes | 1,500,000 mobile | PASS |

WASM SHA-256: `8e535b8a6972a2af1505000d43b570b2966ed6950777fbb705dccc2e74655129`.

Key build artifacts:

- Main JS: 182.56 kB raw / 57.72 kB gzip.
- CSS: 45.53 kB raw / 9.40 kB gzip.
- Lazy Semantic Forge/Three.js chunk: 829.41 kB raw / 223.62 kB gzip.
- Worker: 3.21 kB raw.

The 3D chunk is deliberately lazy. Vite emits a warning because its raw size exceeds 500 kB; this is a recorded optimization opportunity, not a hard-budget failure.

## Production-preview browser observations

The evidence harness targeted the built app through `vite preview`, not the development server.

- 1440×900 navigation DOMContentLoaded/load: 25 ms / 25 ms on the local test machine.
- Hero resource transfer: approximately 292–294 kB across tested viewports.
- Initial resource count: 4; 5 after the real interaction sequence.
- External resource hosts: none.
- Console errors: 0.
- Page errors: 0.
- DOM nodes: 329 on the home state; 338 after the compiled interaction state.

These are local laboratory observations, not field-user latency claims.

## Device tiers

- CINEMATIC observed at desktop fine-pointer viewports.
- STANDARD observed at 390×844, 360×800, and 320×568.
- LITE observed for reduced motion and forced no-WebGL.
- LITE creates no canvas.
- CINEMATIC/Standard DPR is capped in code at 1.6/1.15 respectively.

## Network and privacy

- Browser resource inspection reported zero external hosts.
- Evaluation egress proof reported 0 fetches and 0 WebSockets during evaluate.
- No remote font, model, image, video, analytics, ad, or tracking request is required.

## Evidence

- `../asset-budget.json`
- `../egress-proof.json`
- `browser-performance.json`
- `../logs/web-production-build.txt`
- `../logs/asset-audit.txt`
- `../logs/egress-audit.txt`
