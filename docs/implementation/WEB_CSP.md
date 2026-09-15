# SPE Web/PWA Content Security Policy notes

**Status:** foundation notes for Sprint 6 (`not_a_release=true`).  
**NEW_IMPLEMENTATION.** COST ₹0. No paid CDN. No analytics.

## Baseline (shipped in `apps/web/index.html`)

```
default-src 'self';
script-src 'self';
worker-src 'self' blob:;
style-src 'self';
img-src 'self' data:;
connect-src 'self';
font-src 'self';
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
```

## Rationale

- All compile/evaluate work is local: UI → Web Worker → `spe_wasm.wasm`.
- `worker-src` allows module workers (Vite may use `blob:` URLs in dev).
- No `unsafe-inline` / `unsafe-eval` in the foundation baseline.
- System fonts only — no `fonts.googleapis.com` / `fonts.gstatic.com`.
- `connect-src 'self'` — zero third-party egress during compile.

## Service worker

Precache app shell + WASM bytes only. Never cache private prompts or POST bodies.

## Deployment note

Hosting CSP headers (when a host exists later) should mirror this document. Sprint 6 does not deploy.
