# Privacy and egress

SHA: `e0497f79898689a00a30abeab67652d5f6a9193c`

## Declared

- Hero and privacy copy: no analytics, no ad tracking, no sale of prompts.
- History is opt-in and local.
- Speech copy: the browser may send audio to its speech service; SPE does not save audio.
- Privacy page: reading a website contacts that address.
- LOCAL_WASM profile: requires_network false.

## Observed

- `audit:egress` on fixture POS-001: fetch 0, websocket 0, external_hosts [], zero_egress true, used_ts_fallback false.
- `audit:deps`: banned_hits [], free_deps_only true.
- predeploy: `no_unexpected_third_party_connect` passed.
- CSP in `apps/web/index.html` and `public/_headers`: `connect-src 'self'`; `script-src 'self' 'wasm-unsafe-eval'`.
- Source search under `apps/web/src` found no gtag, posthog, sentry, or plausible.
- `urlIngest.ts` contains `fetch`. That call is user-triggered. CSP is expected to block cross-origin connections.
- Engine worker fetches `/spe_wasm.wasm` and the sha256 json, same origin.
- Clipboard writes found are explicit Copy actions.
- No login route and no email form in the app routes reviewed.
- IndexedDB is asserted absent by a Python privacy test that was not executed. Source search did not find an IndexedDB client.

## Mismatch

DECLARED: reading a website contacts the address.
OBSERVED: CSP does not allow that connection.

This is not undisclosed data leaving the device. Severity is P1, not P0. No secret leak, authority bypass, mandatory paid API, login, email gate, or analytics SDK was found.

Speech vendor contact is disclosed and optional. It is not the core compile path.
