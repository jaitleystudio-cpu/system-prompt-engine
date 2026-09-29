# Web Content Security Policy and Security Foundation

This document defines the security architecture and boundary enforcement for the SPE Web Application (`apps/web`).

## Threat Model and Principles

1. **Zero-Egress by Default**: All core prompt shaping, semantic structuring, and validation run on-device inside WebAssembly (`spe_wasm.wasm`). Zero telemetry, analytics, advertising, or remote evaluation occurs.
2. **Same-Origin Constraint**: Scripts, workers, fonts, and connects are strictly bound to `self`. Third-party CDNs and unverified scripts are forbidden.
3. **No Unsafe Eval**: Traditional `unsafe-eval` is prohibited. `wasm-unsafe-eval` is restricted exclusively to loading and compiling the cryptographically verified local WebAssembly binary.
4. **Frame & Clickjacking Prevention**: `X-Frame-Options: DENY` and `frame-ancestors 'none'` prevent any embedding of the SPE interface into malicious iframes.
5. **No Sniffing & No Referrer Leakage**: `X-Content-Type-Options: nosniff` stops MIME-confusion attacks. `Referrer-Policy: no-referrer` prevents path/query leakage to external sites.
6. **Hardware & Feature Isolation**: `Permissions-Policy` disables all ambient sensors, location, camera, payment, USB, and screen capture. Microphone is restricted strictly to `(self)` for explicitly user-triggered speech input.

## Policy Directives Breakdown

| Directive | Value | Purpose |
|---|---|---|
| `default-src` | `'self'` | Fallback default to same-origin only |
| `script-src` | `'self' 'wasm-unsafe-eval'` | Local application scripts only + WASM compilation |
| `worker-src` | `'self' blob:` | Web Worker for WASM offload execution |
| `style-src` | `'self' 'unsafe-inline'` | Local CSS stylesheets + React/Three.js dynamic styles |
| `img-src` | `'self' data: blob:` | Local assets, inline icons, and user-provided image previews |
| `connect-src` | `'self'` | Local fetches only (app shell, WASM assets, SHA digests) |
| `font-src` | `'self'` | System and locally packaged fonts only; no external Google Fonts |
| `object-src` | `'none'` | Blocks Flash, Java applets, and legacy plugin execution |
| `base-uri` | `'self'` | Prevents DOM `<base>` injection hijacking |
| `form-action` | `'self'` | Disallows form submissions to external endpoints |
| `frame-ancestors` | `'none'` | Complete clickjacking defense across all modern browsers |
| `upgrade-insecure-requests` | (enabled) | Upgrades all HTTP links to HTTPS |
| `block-all-mixed-content` | (enabled) | Strict rejection of unencrypted active content |

## Response Headers Specification (`apps/web/public/_headers`)

Static hosts supporting `_headers` enforce the following production response headers:

- `Content-Security-Policy`: Complete policy with `frame-ancestors 'none'` and mixed-content blocking.
- `X-Content-Type-Options: nosniff`: Mandatory MIME type enforcement.
- `Referrer-Policy: no-referrer`: Full referrer suppression.
- `X-Frame-Options: DENY`: Legacy frame prevention.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`: 1-year HSTS with preload readiness.
- `Permissions-Policy`: Strict zero-trust sensor lockdown.
- `Cross-Origin-Opener-Policy: same-origin`: Isolation from opener windows.
- `Cross-Origin-Resource-Policy: same-origin`: Prevents cross-origin reads of static assets.
- `X-Permitted-Cross-Domain-Policies: none`: Blocks cross-domain policy files (Flash/Silverlight).
- `X-DNS-Prefetch-Control: off`: Disables background DNS prefetching.

## Service Worker Security Boundary (`apps/web/public/sw.js`)

1. **Precache Integrity**: Pre-caches only immutable static shell assets (`/index.html`, `/manifest.webmanifest`, `/icon.svg`, `/spe_wasm.wasm`, `/spe_wasm.sha256.json`).
2. **Zero Prompt Caching**: The service worker explicitly rejects non-GET requests. User prompt content, compile payloads, and private state are never written to the Cache API.
3. **Query Parameter Exclusion**: Requests containing query parameters (`url.search`) are completely bypassed to eliminate the risk of accidental query-string data retention.
4. **Offline Shell Fallback**: Navigation requests use network first and fall back exclusively to `/index.html`. Arbitrary navigation responses are never stored.

## Software Bill of Materials (SBOM) & Supply Chain Verification

Dependencies are inventoried and audited using `apps/web/scripts/generate-sbom.mjs`:
- CycloneDX 1.5 JSON standard format: `proofs/generated/web_sbom_cyclonedx.json`.
- Dependency inventory: `proofs/generated/web_dependency_inventory.json`.
- Zero banned packages verified (no remote trackers, telemetry, ad networks, or cloud authentication).
- Permissive open-source licenses verified across all packages.

