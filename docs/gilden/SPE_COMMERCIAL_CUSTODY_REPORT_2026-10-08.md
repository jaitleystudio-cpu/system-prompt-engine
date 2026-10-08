# SPE_COMMERCIAL_CUSTODY_REPORT — 2026-10-08

| Field | Value |
| --- | --- |
| Type | Read-only, evidence-first audit. Docs only: no product code, no payment, ad or analytics code. |
| Builder | Grok (GILDEN commercial custody, first action under directive v3 §47) |
| Audit time | 2026-10-08, about 16:30 IST |
| States used | PRESENT_VERIFIED, PARTIAL, NOT_PRESENT, UNKNOWN, HOLD. **Nothing in this report is a PASS.** |
| Money fields | Traffic, users, cash, MRR and cost are **UNKNOWN** unless a real source proves them. None are estimated. |

## 0. Refs audited

| Ref | SHA | Notes |
| --- | --- | --- |
| `origin/main` | `3abe3df936082296b6a1ddc94923d757129cfdff` | 2026-09-24 13:26 IST. Expected value confirmed; unchanged by this work. |
| `origin/cursor/r9-integration-q0-q9-895a323` | `8a3ae11bd82c8b56237e2216035711b5291a3ca5` | Tree `e21a2552869858efa8434e3c5df01ac579203fc1`, committed 2026-10-08 11:36 IST. Frozen R9 candidate, read only. |
| Open PRs | #30–#138 | Listed 2026-10-08 via `gh pr list`. All open PRs are drafts or unmerged. |

Citations below use `path@sha`, where `@8a3ae11` is the R9 candidate and `@3abe3df` is main.

**External read-only checks:**

- Public HTTP `curl` of the domain and the Vercel URL.
- DNS-over-HTTPS lookup.
- Vercel connector calls: `list_projects`, `list_deployments`, `list_project_domains`, `list_domains`, `list_teams`, `count_pageviews`, `list_billing_charges`.

Nothing was changed. Gmail was not used. Nothing was sent, applied for, accepted or spent.

---

## 1. Directive §47 template (v3), filled

```text
SPE_COMMERCIAL_CUSTODY_REPORT

CURRENT_RELEASE_TARGET= 2026-10-26 22:10 IST. Stated by the owner in directive v3. No repo file
  records this date: grep for 2026-10-26 / release_target found nothing relevant. Repo hosting gate
  is HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE (SPE-CHANGELOG:10@8a3ae11).
CURRENT_RC= HOLD. The only frozen candidate is the R9 integration candidate 8a3ae11, adjudicated
  R9_FROZEN_CANDIDATE_PRESENT__PARTIAL_WITH_EXPLICIT_HOLDS: Q0 PASS (owner adjudication),
  Q1 HOLD, Q4/Q5 HOLD_EXPLICIT, #138 audio HOLD. Not merged; main is still 3abe3df (2026-09-24).
  R8 release PR #121 (d1c927f) is open and unmerged. No qualified release candidate.
CURRENT_PRODUCT_SURFACES= on R9 8a3ae11 (apps/web/src/routing.ts, App.tsx):
  / (home)
  /create (System Prompt Engine)
  /code (Screenshot → code prompt + scaffolds)
  /daily-lab
  /capabilities
  /privacy
  /my-work (local history)
  /workspace
  /website (local spec preview)
  /studio (Free 3D Website Studio)
  /media (audio/video → text via local host)
  /ocr (via local host)
  /research (stored receipt only)
  main 3abe3df has only the home/workspace shell (apps/web/src/App.tsx, Workspace.tsx@3abe3df).
FREE_TOOLS_LIVE= PARTIAL / HOLD.
  - Owned domain systempromptengine.com: NOT live. Apex and www return a GoDaddy parking page
    (window.location.href="/lander"). NS ns57/ns58.domaincontrol.com; A 3.33.130.190,
    15.197.148.33.
  - Live public deployment: Vercel project "system-prompt-engine" (prj_qEbBf3K4My2dQuGQr37L6J5Lt8h5).
    Production deployment dpl_5buNqLTEg8bGs9iEqaQ1bBtsVW8n READY, created 2026-10-05 18:01 IST,
    served at https://system-prompt-engine-six.vercel.app. Its robots.txt lacks /studio, so it is an
    older build. Its source SHA is UNKNOWN (no git metadata on the deployment).
  - Whether that deployment was founder-authorized is UNKNOWN. It conflicts with the R8 note
    "TARGET HOST = CLOUDFLARE PAGES … Vercel is NOT USED" (PR #121 body).
  - /media and /ocr need /api/* local hosts (apps/web/src/media/pinnedWhisperRuntime.ts@8a3ae11,
    apps/web/scripts/local-media-host.mjs). They are unavailable on static hosting.
PRO_IMPLEMENTED= NOT_PRESENT. No pricing page, plan, tier or paywall in either ref. Only
  JSON-LD Offer price "0" / isAccessibleForFree (apps/web/src/routing.ts@8a3ae11).
TEAM_IMPLEMENTED= NOT_PRESENT. No identity; login/signup/oauth are test-forbidden
  (tests/web/test_web_privacy_pwa.py:47-73@8a3ae11).
ENTERPRISE_IMPLEMENTED= NOT_PRESENT. No on-prem package, licence or SSO. Partial primitives
  exist: authority/receipts/provider profiles (spe_runtime/*, data/provider_profiles_v1.json@8a3ae11).
HOSTED_IMPLEMENTED= NOT_PRESENT. No hosted eval, CI service or API.
CHECKOUT_STATUS= NOT_PRESENT, and actively blocked:
  - "stripe" is a banned dependency (apps/web/scripts/audit-deps.mjs:26@8a3ae11).
  - "stripe.com" is banned in the lockfile (tests/web/test_web_cost_and_scope.py).
  - Permissions-Policy payment=() and form-action 'self' (apps/web/public/_headers@8a3ae11).
PAYMENT_PROVIDER_STATUS= code NOT_PRESENT (no stripe|razorpay|paddle|lemonsqueezy integration).
  Account status UNKNOWN: no evidence of any provider account.
ENTITLEMENT_STATUS= NOT_PRESENT. No entitlement, licence key or offline licence code.
ANALYTICS_STATUS= NOT_PRESENT in the product, by policy.
  - Analytics SDKs are banned (audit-deps.mjs:27-38@8a3ae11).
  - Privacy page: "This preview does not include analytics, ad tracking…"
    (apps/web/src/pages/PrivacyProof.tsx@8a3ae11).
  - Aggregate-only privacy analytics design exists only in draft PR #69 (f7c2e66, unmerged,
    not in R9).
  - Vercel Web Analytics: not enabled (API 400 web_analytics_not_enabled).
REVENUE_ATTRIBUTION_STATUS= NOT_PRESENT.
ADS_READY= NOT_PRESENT / HOLD.
  - No ad slots or house cards.
  - CSP blocks third-party ad scripts: script-src 'self', connect-src 'self', img-src 'self' data:
    blob:, COEP require-corp.
  - Privacy copy promises no ad tracking.
  - No live owned domain (AdSense site review needs one).
SPONSOR_READY= NOT_PRESENT. No sponsor surface, disclosure policy or media kit.
AFFILIATE_READY= NOT_PRESENT. No affiliate links or disclosure component.
  data/provider_profiles_v1.json exists (pricing_metadata_if_known=null) and is a future candidate
  for affiliate links.
PRO_READY= NOT_PRESENT
TEAM_READY= NOT_PRESENT
ENTERPRISE_READY= NOT_PRESENT
API_OEM_READY= NOT_PRESENT. Partial primitives: portable WASM/ABI (portable/spe-core-rs,
  spe-wasm@3abe3df); no commercial API, licence or SDK terms.
MARKETPLACE_READY= NOT_PRESENT. "Prompt marketplace in core | NO" (docs/ZERO_COST_PRODUCT_LAW.md).
TRAFFIC_NOW= UNKNOWN. No analytics source anywhere; Vercel Web Analytics not enabled.
USERS_NOW= UNKNOWN
CURRENT_MRR= UNKNOWN. No billing system exists, so SPE-product MRR via any repo code path is
  structurally 0. Off-repo SPE revenue (invoices, services) is unproven, so the field is UNKNOWN,
  not 0.
CURRENT_REVENUE= UNKNOWN. verified_cash_collected_to_date = UNKNOWN (not guessed).
CURRENT_COST= UNKNOWN.
  - Vercel billing: 403 forbidden for the team scope.
  - GoDaddy domain and other spend: no source.
  - Repo law target is ₹0 owner spend (docs/ZERO_COST_PRODUCT_LAW.md).
EXISTING_PARTNERS= NOT_PRESENT in repo. Off-repo partners are UNKNOWN.
CURRENT_PIPELINE= UNKNOWN. No CRM or pipeline record. Observation only, not revenue: the same
  Vercel account holds client-style projects visakha-motors, vajra-jewels, visakha-furnitures and
  3d-website-portfolio (created around 2026-05). Any revenue from them is UNKNOWN.
BLOCKERS= see §6. In short:
  (1) no live owned domain and an unresolved hosting custody conflict;
  (2) no qualified RC (R9 HOLDs);
  (3) repo policy and tests forbid billing, analytics, ads and accounts;
  (4) no measurement, so no traffic proof;
  (5) no payment entity or provider;
  (6) founder decisions pending.
NEXT_HIGHEST_VALUE_ACTION= founder decision on public hosting custody: domain plus host, and the
  status of the existing Vercel production deployment. Every ads, SEO, affiliate, sponsor and
  self-serve route depends on a live, qualified, owned surface.
FOUNDER_AUTHORITY_REQUIRED= YES
```

## 2. Directive v2 §34 template

**HOLD.** The text of v2 §34 is not available to the builder; the cut is documented in `COMMERCIAL_DIRECTIVE_v3_2026-10-08.md`. Every §47 field above is filled. Once §34 is restored, its fields map onto §1 and §3–§7 of this report and must be re-filled field by field. No field names were invented.

## 3. Evidence inventory: what exists

| Area | State | Evidence |
| --- | --- | --- |
| System Prompt Engine (local WASM) | PRESENT_VERIFIED (code); release HOLD | `apps/web/src/engine/*`, `portable/spe-core-rs`@3abe3df and @8a3ae11 |
| Audio→Text | PARTIAL / HOLD | `/media` route needs a local host (`spe_runtime/media_product/route_host.py`, `local_backend.py` whisper.cpp @8a3ae11). PR #138 (2131157) is HOLD for hardening. |
| Video→Text | PARTIAL / HOLD | Same `/media` path; no separate qualification. |
| Free 3D Website Studio | PARTIAL / HOLD | `/studio`, `apps/web/src/website-studio/*`@8a3ae11. R9 candidate is PARTIAL_WITH_EXPLICIT_HOLDS. |
| Screenshot→Code | PARTIAL | `/code`, composer mode `screenshot` (App.tsx:1036@8a3ae11). Gives a prompt plus scaffolds; it is not a compiler. |
| URL→Website | PARTIAL / HOLD | `apps/web/src/media/urlIngest.ts`@8a3ae11 keeps URLs as references only. Cross-origin fetch transport is NOT_PRESENT (PR #137 f55e78b). |
| Image→Prompt | PARTIAL | Composer `image` mode (`apps/web/src/composer/UnifiedComposer.tsx:65,330`@8a3ae11). |
| Research→Prompt | PARTIAL / HOLD | `/research` shows a stored receipt only; live index and retraction are HOLD (routing.ts meta@8a3ae11; PR #128 HOLD). |
| Model Atlas / Model Passports / Failure Genome / registry-packs / hosted eval-CI / developer assurance / Gilden business modules | NOT_PRESENT | grep found 0 hits in both refs. Gilden ops contract exists only in draft PR #67 (d02b4cb, unmerged). |
| Pricing / plans / checkout / billing / refund / cancel / webhook / licence | NOT_PRESENT | grep stripe, razorpay, paddle, lemon, checkout, pricing, entitlement, subscription, billing, refund, webhook: only fixture text, CI `actions/checkout`, and ban lists. |
| Analytics / telemetry | NOT_PRESENT (policy-forbidden) | `audit-deps.mjs`@8a3ae11; `PrivacyProof.tsx`; "telemetry" hits are local perf-harness only (`website-studio/performance/measureScene.ts`). |
| Revenue ledger / reconciliation | NOT_PRESENT | "ledger" hits are evidence ledgers (`apps/web/src/authority/evidenceRegistry.ts`), not money. |
| Ad slots / house cards / affiliate / sponsor | NOT_PRESENT | grep returned 0 product hits. |
| robots.txt / sitemap.xml | PRESENT_VERIFIED on R9; NOT_PRESENT on main | `apps/web/public/robots.txt`, `sitemap.xml`@8a3ae11. Six public URLs; private tool routes are Disallow/noindex. |
| Meta / canonical / OG / JSON-LD | PARTIAL | Static tags in `apps/web/index.html`@8a3ae11. Per-route meta and JSON-LD (WebApplication, FAQPage) are injected client-side by `apps/web/src/ui/SeoHead.tsx`. No prerender or SSG on R9; crawl-block prerender exists only in draft PR #60. |
| Indexable content pages | PARTIAL | /, /create, /code, /daily-lab, /capabilities, /privacy. `pages/AuthorityHub.tsx` and `GuideArticle.tsx` exist but are **not routed**: no import outside themselves. |
| Search Console verification | NOT_PRESENT | No google-site-verification meta or file. Domain is parked. |
| Privacy policy | PARTIAL | `/privacy` is a product privacy-proof page, not a legal privacy policy. It has no terms of service, refund policy or contact/grievance details, all of which payment providers and ad networks require. |
| CSP / security headers | PRESENT_VERIFIED (static) | `apps/web/public/_headers`@8a3ae11 and meta CSP in `index.html`. Vercel does **not** apply `_headers`: the live vercel.app response has no CSP, COEP or frame-ancestors header, only the meta CSP. |

## 4. Feature → Money router coverage

Router states: ACTIVE = earning now. QUALIFIED_CANDIDATE = could be switched on within current authority. HOLD = blocked by gates or founder decision. NOT_ELIGIBLE = blocked by law, policy or absence.

| Feature / pillar | PRIMARY route | Optional routes | State | Reason |
| --- | --- | --- | --- | --- |
| System Prompt Engine (/create) | Acquisition → Pro (advanced compile targets, batch, project packs) | Contextual sponsor card (non-prompt-derived); disclosed provider affiliate links | HOLD | No live owned domain; no plans or entitlements; billing and accounts are test-forbidden. |
| Audio→Text (/media) | Acquisition → Pro desktop/local (long files, batch, Telugu/medical packs) | Enterprise on-prem | HOLD | #138 HOLD. Needs a local host. A hosted transcription route is NOT_ELIGIBLE under the zero-audio-egress posture. |
| Video→Text | Same as Audio→Text | Enterprise on-prem | HOLD | Same media path; no separate qualification. |
| Free 3D Website Studio (/studio) | Acquisition → Pro export packs / premium recipes | Paid client builds (services, invoiced); disclosed hosting affiliate | HOLD | R9 PARTIAL; no export entitlement; services route needs founder pricing and contracts. |
| Screenshot→Code (/code) | Acquisition → Pro | Disclosed coding-AI affiliate; dev-audience sponsor | HOLD | No live domain; no disclosure component. |
| URL→Website | Acquisition → Pro | — | NOT_ELIGIBLE (for now) | Cross-origin fetch transport NOT_PRESENT (#137). Reference-only. |
| Image→Prompt | Acquisition / SEO | Disclosed image-gen affiliate | HOLD | No live domain or disclosure. |
| Research→Prompt (/research) | Pro / hosted research | Enterprise | HOLD | Live index and retraction HOLD (#128). |
| Public pages (/capabilities, /privacy, /daily-lab) | SEO acquisition | First-party house cards; dev-audience sponsor (Carbon/BuySellAds-class) | NOT_ELIGIBLE (ads now) | CSP and COEP block third-party ad scripts; privacy copy says no ad tracking; no live domain or traffic. |
| Daily Lab | Acquisition / retention | Sponsor slot | HOLD | Publish held behind ungranted gate (draft PR #66). |
| Provider profiles (`data/provider_profiles_v1.json`) | Affiliate (disclosed) | Model Atlas later | HOLD | No disclosure policy or partner accounts. |
| .spe portable artifact / ABI / WASM | Team / Enterprise / OEM licensing | API | NOT_ELIGIBLE (now) | No licence terms, SDK packaging or entitlement. |
| Model Atlas, Model Passports, Failure Genome, registry/packs, hosted eval-CI, developer assurance, Gilden business modules | Team / Enterprise / hosted MRR | Sponsor (public benchmarks: never pay-to-win) | NOT_ELIGIBLE | NOT_PRESENT in code. |

**ACTIVE routes: 0. QUALIFIED_CANDIDATE routes: 0.**

## 5. Next 10 actions in dependency order

| # | Action | Tag |
| --- | --- | --- |
| 1 | Restore the full verbatim directive text (v3 §0–§45 and v2 §2–§34) into `COMMERCIAL_DIRECTIVE_v3_2026-10-08.md`, then re-fill the v2 §34 fields. | within-authority-now (parent/owner supplies text; docs commit) |
| 2 | Decide public hosting custody: Cloudflare Pages (R8 plan) or Vercel (existing prod deploy 2026-10-05 18:01 IST, source SHA UNKNOWN); keep or take down the vercel.app deployment; set the go-live gate against the 26 Oct target. | founder-authority-required |
| 3 | Commercial-policy amendment, as an owner-approved doc. Reconcile `docs/ZERO_COST_PRODUCT_LAW.md`, `audit-deps.mjs` bans, `test_web_privacy_pwa.py` (no login/signup/oauth) and the privacy copy with the directive. Explicitly allow: (a) cookieless first-party aggregate analytics; (b) disclosed affiliate links; (c) first-party sponsor/house cards with no third-party scripts; (d) optional licence or account for Pro/Team, with the free core unchanged. | founder-authority-required (then builder) |
| 4 | Draft commercial specs: Free/Pro/Team/Enterprise matrix with a free-core guarantee; affiliate and sponsor disclosure policy; house-card spec compatible with CSP `'self'`; revenue ledger states (TARGET / APPROVED / INVOICED / COLLECTED / RECONCILED). | within-authority-now (docs drafts for owner review) |
| 5 | Measurement foundation: same-origin, cookieless aggregate analytics compatible with `connect-src 'self'`, reconciled with draft PR #69. Copy and privacy page updated through the owner-approved copy-check inventory. | builder-work-needs-owner-tasking |
| 6 | SEO crawlability: prerender or static crawl documents for the six public routes (reconcile draft PR #60); route AuthorityHub/guides only if they carry real tool evidence (Google scaled-content policy); keep private routes noindex. | builder-work-needs-owner-tasking |
| 7 | Legal pages needed by any payment or ad partner: legal privacy policy, terms, refund/cancellation, contact/grievance. | founder-authority-required (legal text); builder renders |
| 8 | Point systempromptengine.com DNS from GoDaddy parking to the chosen host; Search Console verification and sitemap submission. | founder-authority-required |
| 9 | Partner research shortlist: dev-audience sponsors (Carbon/BuySellAds), PartnerStack/impact.com programs, provider affiliate programs, payment providers fit for an India entity (Razorpay / Stripe / Paddle / Lemon Squeezy as merchant of record, GST). Research only; no applications. | within-authority-now (research); applying or accepting = founder-authority-required |
| 10 | Checkout + entitlement + offline licence + webhook/refund/cancel handling + revenue ledger with payout reconciliation, after provider selection and account opening by the founder. | founder-authority-required → builder-work-needs-owner-tasking |
| (+) | Sponsor, enterprise and OEM outreach drafts for founder review. Sending requires scoped email authority. | within-authority-now (drafts only) |

## 6. Decisions and risks

**Highest-probability near-term revenue action:** founder-led direct sales that need no checkout code. Two examples: paid 3D-website builds for businesses using SPE Studio as the delivery tool, and paid enterprise prompt-governance or on-prem pilots, both invoiced manually and recorded in a reconciliation ledger.

- Evidence is weak but real. The Vercel account already holds client-style business sites (visakha-motors, vajra-jewels, visakha-furnitures).
- Revenue from these is **UNKNOWN**, and this is a hypothesis, not a forecast.
- Pricing, contracts and invoicing need founder authority.

Traffic-dependent routes (ads, affiliate, sponsor) cannot earn before a live owned domain plus measurement exist.

**Highest long-term action:** Team/Enterprise assurance MRR: private Failure Genome, cross-model CI evaluation, governance and receipts, on-prem. These build on the existing authority, receipt and portable-ABI primitives. All are NOT_PRESENT today.

**Highest-risk dependency:** a qualified public surface on the owned domain. Today the domain is parked, the RC is HOLD, hosting is founder-gated, and an unaccounted Vercel production deploy exists. Every revenue route except direct services sits behind it, as does the 26 Oct target.

**Owner decisions required:**

1. Hosting custody: host choice; fate of the vercel.app production deployment; go-live gate.
2. Approve the commercial-policy amendment (analytics, affiliate, sponsor and account posture) against the current zero-cost/no-ads/no-accounts laws and tests.
3. Payment entity and provider (Indian entity, GST, merchant-of-record or not); account opening.
4. Pricing and plan matrix (Free / Pro / Team / Enterprise) and the free-core guarantee wording.
5. Legal text: privacy policy, terms, refund/cancellation.
6. DNS change and Search Console verification.
7. Whether 3D-website services and enterprise pilots count as SPE revenue lines, and their price lists.
8. A scoped outreach/email authority for GILDEN, if and when wanted.
9. Restore the full directive text (truncated in builder context).

## 7. Conflicts between the directive and the current repo/policy

1. **CSP vs third-party ad scripts.** `_headers`@8a3ae11 sets script-src/connect-src 'self', img-src 'self' data: blob:, COEP require-corp and CORP same-origin. This blocks AdSense and most ad-network scripts and iframes. Only first-party, same-origin house or sponsor cards fit without weakening CSP.
2. **Permissions-Policy and form-action vs checkout.** `payment=()` and `form-action 'self'` limit Payment Request and embedded checkout. A hosted checkout redirect via link remains possible.
3. **Dependency bans.** `audit-deps.mjs`@8a3ae11 bans stripe, @vercel/analytics, posthog, mixpanel, amplitude, GA, plausible-tracker and firebase. `test_web_cost_and_scope.py` bans stripe.com in the lockfile.
4. **Accounts vs Pro/Team.** `test_web_privacy_pwa.py:47-73`@8a3ae11 asserts no `login`, `signup`, `oauth` or `indexedDB` in web source. Team entitlements need identity. Pro could use an offline licence instead, but that needs a policy decision.
5. **Privacy copy.** `PrivacyProof.tsx` says "does not include analytics, ad tracking…". Any measurement, ad or sponsor change needs an owner-approved copy change.
6. **ZERO_COST_PRODUCT_LAW.** It says ₹0 owner spend, no paid analytics, no ad SDKs in core, and no prompt marketplace in core. This conflicts with registry/packs and marketplace unless they are scoped outside core.
7. **Hosting gate vs live deploy.** `HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE` (SPE-CHANGELOG) and the R8 note "Vercel is NOT USED" conflict with an existing Vercel production deployment (2026-10-05). On vercel.app, `_headers` security headers are not applied, and its canonical/sitemap point to the parked domain.
8. **Release date vs open HOLDs.** The 26 Oct 22:10 IST target faces open HOLDs: R9 Q1, Q4/Q5, #138 audio, research live index, URL fetch NOT_PRESENT, and #121 unmerged. The date cannot promote any HOLD.
9. **Local-only / zero-audio-egress vs hosted revenue.** Hosted transcription or hosted evaluation conflicts with the zero-audio-egress and local-first posture. Hosted offers must be opt-in and separate.
10. **SEO scale vs Google policy.** Programmatic "evidence pages" must be real tool or evidence pages, not mass AI pages (Google scaled-content-abuse guidance). Today's SPA injects per-route meta and JSON-LD client-side with no prerender.
11. **Copy inconsistency.** The privacy page says "Media stays on device", while the /media route meta says "request transcription from the configured app host". This needs reconciling before any public commercial launch.

## 8. Custody

- `main` stays at `3abe3df`.
- `8a3ae11` is untouched.
- `grok/r9s-audio-vad-telugu` (#138) and its working tree are untouched; this work used a fresh, separate clone.
- No other PR, branch or lane was touched.
- Nothing was sent, posted, spent, applied for or accepted. No DNS or Vercel change was made.
