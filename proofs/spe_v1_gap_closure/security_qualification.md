# Production security qualification (no deploy)

**HOSTING=FORBIDDEN. WORLD#1=NOT_PROVEN.**

## Headers (`apps/web/public/_headers`)

Verified / hardened for static hosts that honor `_headers`:

- CSP: `default-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'`; `frame-ancestors 'none'`; `object-src 'none'`; `upgrade-insecure-requests`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `X-Frame-Options: DENY`
- `Permissions-Policy` (camera/mic/geo/payment locked down; mic self for optional speech)
- `Cross-Origin-Opener-Policy: same-origin`
- Cache: `sw.js` no-cache; hashed `/assets/*` + wasm immutable

Meta CSP in `index.html` remains (without frame-ancestors — meta cannot set it; `_headers` carries frame-ancestors).

## Dependency audit

Run: `cd apps/web && npm run audit:deps` — free-deps allowlist; bans analytics/billing/CDN Three.

Also run `npm audit --omit=dev` when recording evidence (exit code logged honestly).

## Service worker

`apps/web/public/sw.js`:

- Precaches shell + wasm only
- Skips non-GET (never caches compile/prompt bodies)
- Navigations: network-first; offline falls back to shell `index.html` only — does not persist navigation bodies
- No third-party origin fetch handling

Regression: `node tools/web-service-worker-regression.mjs`

## Zero-egress local WASM core

- Compile path: `spe_wasm.wasm` via worker; `npm run audit:egress` / eval fixture with `SPE_PROOF_EGRESS=1`
- Optional URL ingest: bounded (`MAX_URL_BYTES=200_000`, `URL_FETCH_TIMEOUT_MS=12_000`), user-initiated, CORS-honest, no paid proxy
- Vision/ONNX: same-origin `/models` + `/ort`, lazy — not on homepage

## Residual risks (honest)

1. Static host misconfiguration could drop `_headers` → weaker CSP/frame protection.
2. XSS via `unsafe-inline` styles remains a residual CSP tradeoff.
3. User-initiated `fetch` of arbitrary http(s) URLs (Create URL mode) can contact third parties — intentional, bounded, not part of compile egress.
4. Browser speech / clipboard APIs are OS-mediated; not an SPE network channel.
5. Supply-chain risk in npm lockfile — audit reduces but does not eliminate it.
6. This qualification is **not** a claim of “fully secure” or production-hardened hosting.

**Do not claim fully secure.**
