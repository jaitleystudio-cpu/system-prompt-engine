# C0 CONFLICT_MATRIX: proposed capability vs current law

This matrix lists every place a C0 proposal touches current zero-cost, privacy or security law
(evidence keys in `README.md`).

- **Default resolution** is the proposal's own design choice that avoids the conflict.
- **Override** means changing the law. That needs the named founder decision. Nothing here changes
  any law.

| ID | Current law (evidence) | Proposed capability that conflicts | Default resolution (no law change) | Override requires |
| --- | --- | --- | --- | --- |
| C01 | CSP `script-src 'self' 'wasm-unsafe-eval'` (E1, E2) | Third-party ad, sponsor or affiliate scripts; provider checkout JS | First-party house cards (08); sponsor creatives in house-card format (05); plain affiliate links (06); checkout by top-level navigation to the provider page (01, 02) | F08 (ads) / F03 (provider JS) plus an explicit CSP change review |
| C02 | CSP `img-src 'self' data: blob:` (E1) | Remote sponsor logos; tracking pixels | Self-hosted, reviewed creative assets; no pixels | F08 |
| C03 | CSP `connect-src 'self'` (E1) | Third-party analytics or attribution beacons | Same-origin first-party collector (03, 04) | F07 plus CSP change (not proposed) |
| C04 | `default-src 'self'` (no frame-src), COEP `require-corp`, CORP `same-origin` (E1) | Embedded checkout widgets; ad iframes | Hosted checkout via redirect; no iframes | F03 / F08 plus COEP relaxation review |
| C05 | `Permissions-Policy payment=()` (E1) | Payment Request API / wallet buttons on SPE pages | Not needed with redirect checkout | F03 |
| C06 | CSP `form-action 'self'` (E1) | HTML form POST to an external checkout | Server-created checkout session, then a link/redirect (needs a server, C14) | F03 |
| C07 | CSP `frame-ancestors 'none'`, `X-Frame-Options: DENY` (E1) | Sponsors or partners embedding SPE widgets | No embedding (not proposed) | F09 |
| C08 | `Referrer-Policy: no-referrer` (E1) | Referrer-based affiliate attribution | Explicit, disclosed link parameters / `sub_id` (04, 06) | None (kept) |
| C09 | `audit-deps.mjs:20-39` bans `stripe`, analytics SDKs, `firebase`, `@vercel/analytics`; `:56-61` and E5 ban `stripe.com` in the lock (E3, E5) | Provider or analytics SDKs in the web bundle | Provider-neutral server-side integration; first-party analytics code without SDK | F03 / F07 plus an audit-deps amendment |
| C10 | No `login`/`signup`/`oauth`/`indexedDB` in web source; `localStorage` only behind an opt-in gate (E4, E9) | Accounts (02 L2); stored licence | L1 offline licence with storage behind the existing opt-in gate (no login strings); Team admin as a separate surface (L3) | F04 plus test amendment if L2 |
| C11 | Privacy copy "No ads, no sale, no silent tracking … does not include analytics, ad tracking" (E6); "No prompt analytics are installed" (E11); owner-approved copy inventory (E12) | Any analytics (03), sponsor or affiliate presence (05, 06, 08) | Copy updated through E12 **before** activation; no prompt analytics ever | F07, F08, F15 (privacy-policy change is founder-only, v2 §22) |
| C12 | ZERO_COST law: ₹0 owner spend; no paid analytics; paid billing API keys = NO; no ad SDKs in core; prompt marketplace in core = NO (E7) | Provider fees, collector or licence hosting, CRM/accounting SaaS, packs marketplace | Local or private stores; first-party code; marketplace outside core only (v3 §15) | F18 (scoped amendment) plus F16 (budget ceilings) |
| C13 | Zero audio egress (`user_audio_egress == 0`, E8); zero egress during evaluate (E14) | Hosted compute tier (v2 §3), hosted evaluation (v3 §13) | Hosted offers are explicit opt-in, separate products, never default; local tools unchanged | F19 |
| C14 | `HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE` (E13) | Any server component: collector, webhook receiver, licence issuance | None. Every server feature waits for the hosting decision. | F14 |
| C15 | Static hosting only; `_headers` not applied on Vercel (**BUILDER_OBSERVED; INDEPENDENT_CONNECTOR_VERIFICATION = UNAVAILABLE_CURRENT_SCOPE**, E15) | Server functions; reliance on `_headers` CSP in production | Host choice must apply CSP headers equivalent to E1 and must be confirmed independently | F14 |
| C16 | Repository is public (E19) | CRM contact data, ledger, evidence artifacts, real-metric media kits | Off-repo storage; only schemas in repo | F12, F13 |
| C17 | JSON-LD `Offer price "0"`, `isAccessibleForFree: true` (E10) | Paid tiers | Keep the free-core offer true; add paid offers only when live and approved | F01 |
| C18 | Claim law (v3 §44); claim regexes (E11) | Media-kit and sponsor marketing claims | UNKNOWN rendering; claim lint (07) | None (kept) |
| C19 | Release target 2026-10-26 22:10 IST with open HOLDs (custody report §7.8) | v3 §29 Oct 18–25 commercial qualification | Commercial channels stay OFF until qualified; no date-driven promotion | F14 plus owner release ruling |
| C20 | Copy inventory gate (E12) | Every new commercial string (labels, disclosures, pricing copy) | Submit strings for owner approval | Owner copy approval |
| C21 | No fingerprint, no persistent identifier, "no silent tracking" (E6; spec 03 forbidden fields) | Device-bound offline licence (spec 02, F22) | TRANSFERABLE binding (no device identifier) | F22 plus privacy review, privacy-copy change (E12) and a recovery process |
