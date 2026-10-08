# R9-S Task 4 — Real safe cross-origin URL fetch: assessment

Builder evidence only. This is not a product claim, a qualification, or a PASS.
Candidate assessed: `8a3ae11bd82c8b56237e2216035711b5291a3ca5`
(`cursor/r9-integration-q0-q9-895a323`).

## Result

| State | Value |
| --- | --- |
| CROSS_ORIGIN_REMOTE_RETRIEVAL_REQUIRED_BY_PRODUCT_CONTRACT | NO (current contract explicitly excludes it) |
| REAL_PRODUCT_PINNING_TRANSPORT | NOT_PRESENT |
| Cross-origin browser URL | url_reference_only, zero remote-content reads (unchanged) |
| Same-origin browser URL | may be read; destination identity UNVERIFIED_BROWSER (unchanged; never socket-level proof) |
| Non-browser hostname via `ingestUrl` | REQUIRE_PINNED_RESOLUTION → no pinning transport → reference-only, zero requests (unchanged) |
| Implementation in this branch | NONE (no transport added; no fetch stack added) |

## 1. Does the product contract require cross-origin page retrieval?

No. Every product-contract surface on 8a3ae11 states that live / remote URLs
are not fetched:

- `apps/web/src/website/mount-contract.ts` — `capabilities.liveUrlReconstruction: "NOT_AVAILABLE"`, `silentFetch: false`, `localSavedHtmlIsLiveUrl: false`.
- `apps/web/src/website/productFlow.ts` — `LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"`; `runWebsiteProduct` with `kind === "live_url"` returns `REFUSED` with reasons `LIVE_URL_NOT_FETCHED`, `NO_ACQUISITION_GRANT` ("Live URLs are not fetched.").
- `apps/web/src/shell/mountStatus.ts` — `WEBSITE_MOUNT.LIVE_URL: "NOT_AVAILABLE"` (and the Studio mount likewise).
- `apps/web/src/routing.ts` — `/website` description: "Turn a local website spec into a preview and a saved file. This does not open a web address or publish a site."
- `apps/web/src/composer/UnifiedComposer.tsx` — URL panel copy: "Under this product's same-origin network policy, SPE does not fetch arbitrary remote page HTML. A URL is kept as a reference so you can still build a prompt. Upload page HTML or a screenshot when you need grounding."
- `apps/web/index.html` and `apps/web/public/_headers` — product CSP `connect-src 'self'`. The browser product cannot open cross-origin connections at all; `ingestUrl` returns `csp_connect_src_self` reference-only before the boundary.
- `spe_runtime/webrecon/scoped_grant.py` — `PRODUCT_LIVE_URL_RECONSTRUCTION = "NOT_AVAILABLE"`; the only socket in the webrecon package is a one-URL (`https://example.com/`) evidence grant labelled `LIVE_URL_SCOPED` on the receipt only.
- `docs/ZERO_COST_PRODUCT_LAW.md` — "Hosting / SaaS required for proofs: NO". The shipped product is a static browser app with no product backend.

So URL→site is defined today as: URL kept as a reference, plus grounding from
uploaded HTML / screenshot / pasted text. Cross-origin retrieval is
a future capability, not a requirement of the current product contract.

## 2. Could the existing runtime provide a safe pinning transport?

Not in the product, and not without a new network stack:

- **Browser (the product runtime).** `fetch` exposes neither the resolved nor the connected peer, cannot pin a connection to a pre-validated address, and hides redirect `Location` (opaqueredirect). It cannot meet "pin + report the actual connected peer". The canonical `defaultTransport()` in `urlSecurity.ts` is correctly `pinsResolvedAddress: false`.
- **Product backend.** None exists (static hosting; zero-cost law). There is no product-side Node/Python server that a browser request could route through.
- **Local Node scripts** (`apps/web/scripts/serve-local-product.mjs`, `local-media-host.mjs`) are local dev/media hosts, not URL-fetch owners; adding a remote fetcher there would be a new parallel fetch stack wired to nothing in the product.
- **Python `spe_runtime/webrecon/scoped_grant.py`.** It uses `http.client.HTTPSConnection(host)`, which performs its own DNS resolution at connect time and does not pin to a pre-validated address or report the connected peer. It is hard-scoped to one URL and does not follow redirects. Using it as a general pinning transport would mean rewriting it into a new general fetcher, i.e. a duplicate stack, outside this wave's scope.

A correct transport would need: trusted resolution → forbidden-range rejection
→ connect to the validated IP while keeping TLS SNI/certificate validation for
the original hostname → manual per-hop redirect validation → report the socket
peer → fail closed on mismatch or missing proof. `guardedPublicFetch` already
enforces the policy side of that (connected-address binding, `DESTINATION_BINDING_MISMATCH`
as a hard refusal, `DESTINATION_BINDING_UNVERIFIABLE` → reference-only). What is
absent is the transport, and a product runtime to host it.

## 3. Decision

Cross-origin content stays reference-only. No transport and no mock was added,
and test doubles are not used to claim a pinning transport.
`REAL_PRODUCT_PINNING_TRANSPORT = NOT_PRESENT`.

To revisit, the owner must first (a) change the product contract to require
live retrieval, and (b) choose a product runtime that can host a server-side
transport (this conflicts with the static, zero-cost hosting model). Then
implement it once, inside the canonical boundary, with real-socket TLS tests.

## 4. Guard added

`apps/web/scripts/test-network-execution-boundary.mjs` section B11 statically
asserts that the assessed state still holds: no `pinsResolvedAddress: true`
transport in `apps/web/src`; `ingestUrl` passes no custom transport; the
product live-URL contract and CSP still exclude cross-origin reads. If a
pinning transport is introduced, B11 fails and this assessment must be redone.
It is a drift guard, not a proof of safety.
