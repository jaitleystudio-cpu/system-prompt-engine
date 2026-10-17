# URL / CSP CLOSURE

## Previous truth (audited)

Privacy/Create copy implied the browser contacts the typed website address.
Product CSP: `connect-src 'self'` (`apps/web/public/_headers`, `apps/web/index.html`).

## New truth

- CSP unchanged: `connect-src 'self'` only (no `*`, no arbitrary remote hosts).
- Cross-origin URL input returns `status: "url_reference_only"` with reason `csp_connect_src_self`.
- Prompt block may cite the URL as an untrusted **reference**; page HTML is not read.
- Same-origin URLs remain eligible for fetch when CSP allows.
- HTML upload remains local grounding path (no network).

## Behavior owners

- Policy: `connectSrcAllowsRemoteHost`, `readDocumentNetworkPolicy` in `apps/web/src/media/urlIngest.ts`
- UI: Create URL mode copy + “Use URL reference” in `UnifiedComposer.tsx`
- Privacy: `PrivacyProof.tsx` website / egress wording

## Tests

- `npm run test:truth-privacy` — CSP retained; privacy overclaim gone; reference-only ingest
- `npm run test:predeploy-qa` — `connect-src 'self'`
- `npm run audit:egress` — zero egress during evaluate
