# SPE-WEB-03 Performance Budget

These are implementation gates, not claims about achieved performance. Measured results belong in `proofs/web03/`.

## Delivery budgets

| Surface | Budget | Gate |
|---|---:|---|
| Shipped WASM | ≤ 2,000,000 bytes | `npm run audit:assets` |
| Built JavaScript + CSS | ≤ 1,500,000 bytes | `npm run audit:assets` |
| Initial authored 3D models/textures | 0 bytes preferred; ≤ 1,500,000 compressed mobile / 3,000,000 desktop if later added | build inventory |
| Unapproved remote font/image/video | 0 requests | source/egress inspection |
| Analytics, ads, billing, remote telemetry | 0 packages and requests | dependency + egress gates |

WEB-03 uses procedural Three.js geometry and system fonts. The supplied design references are not production assets.

## Runtime targets

Targets are evaluated where browser tooling exposes the metric:

- Desktop CINEMATIC: stable interaction with device-pixel-ratio capped at 1.6.
- Tablet/mobile STANDARD: device-pixel-ratio capped at 1.15 and reduced curve segmentation.
- LITE: no WebGL dependency for comprehension or product operation.
- Reduced motion: static authored plate, no camera interpolation or ambient animation.
- Long tasks: none above 200 ms during idle story navigation on the available test machine.
- Layout shifts: no avoidable shifts after initial render.
- Keyboard interaction and compile controls remain responsive while the 3D chunk loads.

These are acceptance targets. Any unavailable metric is reported as unavailable rather than inferred.

## Loading strategy

- `SpeIntelligence` remains lazy-loaded from the hero.
- Real product controls, headings, and semantic explanations are DOM content.
- The canvas is explanatory and `aria-hidden`; WebGL failure does not block compilation.
- No external model, texture, font, audio, or video fetch is required.
- The service worker caches shell, local bundles, and WASM only; prompt bodies are never cached.

## Quality tiers

### CINEMATIC

- Desktop fine pointer, WebGL available, no reduced-motion preference, and more than 4 GB reported device memory when the API exists.
- Higher curve segmentation, antialiasing, DPR range 1–1.6.

### STANDARD

- Coarse pointer, narrow viewport, or reported memory of 4 GB or less.
- Reduced curve segmentation, DPR range 0.8–1.15.
- Same semantic composition and controls.

### LITE

- WebGL unavailable or reduced motion requested.
- CSS-authored graphite workpiece, gates, semantic filaments, and ceramic artifact.
- Same story, workspace, compile path, and accessibility semantics.

## Browser measurement plan

Fresh proof must record:

1. Production build asset inventory and gzip-independent raw bytes.
2. WASM bytes and SHA-256.
3. Browser navigation resource list and external hosts.
4. `performance.getEntriesByType("navigation")` timing where available.
5. DOM node count, canvas dimensions, active visual tier, and reduced-motion result.
6. Screenshot matrix for desktop, tablet, mobile, reduced motion, and forced LITE.
7. Accessibility scan plus manual keyboard/focus review.

## Failure policy

Exceeding a hard delivery budget, requiring a remote runtime asset, blocking compile without WebGL, or producing materially broken mobile/reduced-motion layouts blocks PASS. Unavailable performance metrics are documented as unavailable and do not become invented evidence.
