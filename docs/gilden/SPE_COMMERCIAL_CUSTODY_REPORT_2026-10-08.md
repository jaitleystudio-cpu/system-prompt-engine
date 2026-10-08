# SPE_COMMERCIAL_CUSTODY_REPORT — 2026-10-08

| Field | Value |
| --- | --- |
| Type | Read-only, evidence-first audit. Docs only: no product code, no payment, ad or analytics code. |
| Builder | Grok (GILDEN commercial custody: first action under directive v3 §47 and v2 §34) |
| Governing text | `docs/gilden/COMMERCIAL_DIRECTIVE_v3_2026-10-08.md` (TEXT_CUSTODY = COMPLETE). v3 governs; Appendix A (v2) applies as a union of constraints. |
| Audit time | 2026-10-08, about 16:30 IST; re-checked against the complete directive about 17:00 IST. |
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

## 1. Directive v3 §47 template, filled

```text
SPE_COMMERCIAL_CUSTODY_REPORT

CURRENT_RELEASE_TARGET= 2026-10-26 22:10 IST (directive v3 title block). No repo file records
  this date: grep for 2026-10-26 / release_target found nothing relevant. Repo hosting gate is
  HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE (SPE-CHANGELOG:10@8a3ae11).
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
SPONSOR_READY= NOT_PRESENT. No Sponsor Center, sponsor surface, disclosure policy or media kit.
AFFILIATE_READY= NOT_PRESENT. No affiliate links or disclosure component.
  data/provider_profiles_v1.json exists (pricing_metadata_if_known=null) and is a future candidate
  for affiliate links.
PRO_READY= NOT_PRESENT
TEAM_READY= NOT_PRESENT
ENTERPRISE_READY= NOT_PRESENT
API_OEM_READY= NOT_PRESENT. Partial primitives: portable WASM/ABI (portable/spe-core-rs,
  spe-wasm@3abe3df); no commercial API, licence or SDK terms. v3 §14 requires capabilities to be
  "production-qualified" first.
MARKETPLACE_READY= NOT_PRESENT. No .spe registry. "Prompt marketplace in core | NO"
  (docs/ZERO_COST_PRODUCT_LAW.md). v3 §15 forbids monetizing before package integrity,
  provenance, licensing and publisher identity are hardened.
TRAFFIC_NOW= UNKNOWN. No analytics source anywhere; Vercel Web Analytics not enabled.
  ACTUAL_MONTHLY_VISITS=UNKNOWN. TARGET_MONTHLY_VISITS = ~20M mature / 100M+ moonshot (v3 §5:
  owner targets, not forecasts).
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
BLOCKERS= see §5–§8. In short:
  (1) no live owned domain and an unresolved hosting custody conflict;
  (2) no qualified RC (R9 HOLDs);
  (3) repo policy and tests forbid billing, analytics, ads and accounts;
  (4) no measurement, so no traffic proof;
  (5) no payment entity or provider;
  (6) the v3 §29 Oct 8–12 commercial specs do not exist yet;
  (7) founder decisions pending.
NEXT_HIGHEST_VALUE_ACTION= founder decision on public hosting custody: domain plus host, and the
  status of the existing Vercel production deployment. Every ads, SEO, affiliate, sponsor and
  self-serve route depends on a live, qualified, owned surface. In parallel and within authority:
  draft the v3 §29 Oct 8–12 commercial specs as docs.
FOUNDER_AUTHORITY_REQUIRED= YES
```

## 2. Directive v2 §34 template, filled

```text
SPE_COMMERCIAL_CUSTODY_REPORT

release_candidate_status= HOLD. R9 integration candidate 8a3ae11 (tree e21a2552…) =
  R9_FROZEN_CANDIDATE_PRESENT__PARTIAL_WITH_EXPLICIT_HOLDS:
  - Q0 PASS (owner adjudication);
  - Q1 HOLD;
  - Q4/Q5 HOLD_EXPLICIT;
  - Q8 57/57 killed.
  Successor PRs: #135 f96f9cd, #136 614fb2e, #137 f55e78b accepted for successor integration;
  #138 2131157 HOLD (audio hardening). R8 release PR #121 d1c927f is open and unmerged.
  main = 3abe3df (2026-09-24). No qualified RC.
public_release_status= NOT_PRESENT on the owned domain. systempromptengine.com is a GoDaddy
  parking page (/lander; NS domaincontrol.com). The repo hosting gate is FORBIDDEN_PENDING_FOUNDER
  (SPE-CHANGELOG:10@8a3ae11).
  Unreconciled: Vercel production deployment dpl_5buNqLTEg8bGs9iEqaQ1bBtsVW8n READY since
  2026-10-05 18:01 IST at system-prompt-engine-six.vercel.app. Older build (robots lacks
  /studio); source SHA UNKNOWN; authorization UNKNOWN. HOLD.

seven_pillars_status=
  1 Audio→Text — PARTIAL / HOLD. /media via local whisper.cpp host
    (spe_runtime/media_product/route_host.py, local_backend.py@8a3ae11). #138 HOLD. Unavailable
    on static hosting.
  2 Video→Text — PARTIAL / HOLD. Same /media path; no separate qualification.
  3 AI + 3D Websites — PARTIAL / HOLD. /studio (apps/web/src/website-studio/*@8a3ae11). Local
    preview and .spe-site export; no publish, share or remix (routing.ts meta: "does not publish a
    site"). R9 PARTIAL.
  4 System Prompt Engine — PRESENT_VERIFIED (code, local WASM: portable/spe-core-rs, spe_wasm.wasm
    @3abe3df/@8a3ae11). Release HOLD.
  5 Screenshot/URL → Code/Site — PARTIAL. /code gives a prompt plus scaffolds
    (App.tsx:1036@8a3ae11). URL ingest is reference-only (urlIngest.ts@8a3ae11). Cross-origin fetch
    transport NOT_PRESENT (#137).
  6 Image → Prompt — PARTIAL. Composer image mode (UnifiedComposer.tsx:65,330@8a3ae11).
  7 Research/Utilities — PARTIAL / HOLD. /research shows a stored receipt only; live index and
    retraction HOLD (#128). OCR is via the local host only.

pricing_status= NOT_PRESENT. No pricing page or plan matrix. JSON-LD Offer price "0"
  (routing.ts@8a3ae11).
Pro_status= NOT_PRESENT
Team_status= NOT_PRESENT. login/signup/oauth/indexedDB are test-forbidden
  (tests/web/test_web_privacy_pwa.py:47-73@8a3ae11).
Enterprise_status= NOT_PRESENT. No on-prem package, SSO, licence or audit-export product.
  Primitives only: spe_runtime/authority, proof receipts, provider profiles @8a3ae11.
hosted_services_status= NOT_PRESENT

checkout_status= NOT_PRESENT and blocked: audit-deps.mjs:26 bans stripe; the lock test bans
  stripe.com; _headers sets payment=() and form-action 'self' @8a3ae11.
billing_status= NOT_PRESENT. No subscription, invoice or receipt code; no webhook handler.
refund_status= NOT_PRESENT. No refund or cancel flow; no refund policy page.
entitlement_status= NOT_PRESENT. No entitlement, licence key or offline-licence code.

analytics_status= NOT_PRESENT, by policy: audit-deps.mjs:27-38 bans analytics SDKs; PrivacyProof
  says "does not include analytics" @8a3ae11. Aggregate-only design exists only in draft PR #69
  f7c2e66 (not in R9). Vercel Web Analytics: not enabled.
revenue_attribution_status= NOT_PRESENT
reconciliation_status= NOT_PRESENT. No revenue ledger. "ledger" hits are evidence ledgers only
  (apps/web/src/authority/evidenceRegistry.ts@8a3ae11).

ads_status= NOT_PRESENT / HOLD. No slots and no HOUSE_CARD_FALLBACK (v2 §10). CSP script-src and
  connect-src are 'self', with COEP require-corp (_headers@8a3ae11). Privacy copy promises no ad
  tracking. No live domain for network review.
affiliate_status= NOT_PRESENT. No links, disclosure or program records (v2 §11 fields all unrecorded).
sponsor_status= NOT_PRESENT. No Sponsor Center, media kit, placement inventory or 30-day pilot.
  Media-kit audience evidence is impossible without measurement (v2 §12: "Do not promise
  audience numbers not measured").
enterprise_pipeline_status= NOT_PRESENT in repo; off-repo UNKNOWN. No CRM. Draft PR #67 d02b4cb
  (Gilden ops contract, network_mode NONE) is unmerged.

SEO_status= PARTIAL.
  - robots.txt and sitemap.xml are PRESENT_VERIFIED on R9 (six public URLs; tool routes
    Disallow/noindex) and NOT_PRESENT on main.
  - Static meta, canonical and OG tags are in index.html.
  - Per-route meta and JSON-LD are injected client-side (SeoHead.tsx@8a3ae11). No prerender
    (crawl documents exist only in draft PR #60).
  - AuthorityHub.tsx and GuideArticle.tsx are unrouted.
  - The sitemap points to the parked domain.
Search_Console_status= NOT_PRESENT. No verification token or file; the domain is parked; DNS
  change is founder-gated.

monthly_operating_cost= UNKNOWN. Vercel billing API 403 for the team scope. GoDaddy and other
  spend: no source. Repo target ₹0 (docs/ZERO_COST_PRODUCT_LAW.md).

active_revenue_channels= NONE evidenced. Router coverage: ACTIVE 0, QUALIFIED_CANDIDATE 0 (§4).

verified_cash_collected_to_date= UNKNOWN (not guessed; no transaction or payout record available).

MRR= UNKNOWN. Repo code path is structurally 0 (no billing); off-repo is unproven.

commercial_HOLDs=
  (1) no qualified RC (R9 Q1, Q4/Q5, #138);
  (2) no live owned domain;
  (3) zero-cost / no-ads / no-analytics / no-accounts laws and tests (§7);
  (4) no measurement, so no media-kit or ad-network eligibility;
  (5) no legal privacy policy, terms or refund pages;
  (6) URL fetch NOT_PRESENT;
  (7) research live index HOLD;
  (8) package ecosystem not hardened (v3 §15);
  (9) API/OEM not production-qualified (v3 §14).
authority_HOLDs= every item below needs founder authority (v3 §33, v2 §22):
  - hosting and deploy decision; fate of the Vercel deployment;
  - DNS change and Search Console;
  - payment entity and provider account opening;
  - acceptance of network, affiliate or partner terms;
  - pricing approval; legal text (privacy policy, terms, refund);
  - budget ceilings (v3 §34 Budget Kernel: none granted, so all spend = STOP);
  - scoped email/send authority (v3 §36: none granted, so outreach is draft-only);
  - copy changes to privacy claims (owner-approved copy-check inventory).

next_10_actions_in_dependency_order= see §6 (tagged within-authority-now /
  builder-work-needs-owner-tasking / founder-authority-required).

highest_probability_near-term_revenue_action= founder-led direct sales that need no checkout
  code, e.g. paid 3D-website builds using SPE Studio and enterprise prompt-governance / on-prem
  pilots, invoiced manually and recorded in a reconciliation ledger. Hypothesis only. Weak
  evidence: client-style sites exist in the Vercel account. Revenue from them is UNKNOWN.
  Requires founder pricing and contract authority.

highest_expected-long-term-revenue-action= Team/Enterprise assurance MRR: private Failure Genome,
  cross-model CI evaluation, governance and receipts, on-prem (v3 §11, §12, §23, §24). All
  NOT_PRESENT today; existing authority, receipt and portable-ABI primitives are the base.

highest-risk-commercial-dependency= a qualified public surface on the owned domain. Today: domain
  parked, RC HOLD, hosting founder-gated, and an unaccounted Vercel production deploy. Every route
  except direct services sits behind it, as does the 26 Oct target.

owner_decisions_required= see §8.
```

## 3. Directive compliance checks (v3 §3–§45, v2 §3–§33)

### 3a. Pre-launch commercial work, Oct 8–26 (v3 §29; v2 §28)

Today is 2026-10-08, the first day of the Oct 8–12 window.

| Window | Deliverable | State | Evidence / note |
| --- | --- | --- | --- |
| Oct 8–12 | Pricing architecture | NOT_PRESENT | No doc or code in either ref. Docs draft is within authority; approval is founder. |
| Oct 8–12 | Entitlement model | NOT_PRESENT | Conflicts with the no-accounts tests (§7.4); needs a policy decision. |
| Oct 8–12 | Commercial event schema | NOT_PRESENT | None in `schemas/`@8a3ae11. |
| Oct 8–12 | Revenue attribution | NOT_PRESENT | — |
| Oct 8–12 | Sponsor Center | NOT_PRESENT | — |
| Oct 8–12 | Affiliate disclosure | NOT_PRESENT | — |
| Oct 8–12 | Media kit | NOT_PRESENT | Cannot carry audience numbers (no measurement). |
| Oct 8–12 | Public advertising boundaries | PARTIAL | Private surfaces are already noindex (`routing.ts` NOINDEX_VIEWS@8a3ae11); no written ad-boundary policy. |
| Oct 8–12 | CRM schema | NOT_PRESENT | Draft PR #67 has a Gilden ops schema (unmerged); no commercial CRM. |
| Oct 8–12 | Revenue ledger | NOT_PRESENT | — |
| Oct 13–17 | Prospect universe (sponsor, affiliate, B2B, OEM, enterprise, partners); outreach templates; campaign packages; case-study format; pricing proposals; 30-day pilot | NOT_PRESENT | Research and drafts are within authority. Sending is not. |
| Oct 18–22 | Qualify checkout, subscription, refund, cancel, upgrade, downgrade, failed payment, duplicate webhook, licence, offline entitlement | NOT_PRESENT | Nothing to qualify. Blocked by provider and policy decisions. |
| Oct 23–25 | Verify commercial surfaces on RC, analytics, attribution, house-ad fallback, disclosures, pricing, checkout, support, receipts, ledger | NOT_PRESENT | Depends on all of the above plus an RC. |
| Oct 26 | Activate only founder-approved production channels | HOLD | Zero channels approved. |

### 3b. Revenue gates R0–R7 (v3 §31) and commercial stages M0–M6 (v2 §18)

| Gate | State | Note |
| --- | --- | --- |
| R0 FIRST_REAL_REVENUE | NOT_REACHED (UNKNOWN for off-repo) | No transaction or payout evidence available to the builder. |
| R1–R7 | NOT_REACHED | Cannot advance without R0 evidence ("Only advance when the evidence exists"). |
| M0 REVENUE READY | NOT_REACHED | Every criterion is missing: checkout NOT_PRESENT; ad surfaces NOT_PRESENT; affiliate routes NOT_PRESENT; sponsor materials NOT_PRESENT; attribution NOT_PRESENT; commercial policies NOT_PRESENT (and current repo laws conflict, §7). |
| M1–M6 | NOT_REACHED | — |

### 3c. Seven-pillar traffic board (v2 §9) and scoreboards (v3 §26, v2 §26–27)

All per-pillar metrics are **UNKNOWN**: visits, organic, direct, AI referrals, return rate, starts, completions, exports, shares, revenue events, RPM/1k sessions, paid conversion, support failures, cost per session and margin per session. No instrumentation exists, so the monthly scoreboard, cash waterfall (v2 §17) and OWNER_DISTRIBUTABLE_CASH_CANDIDATE (v2 §16) cannot be computed. All are UNKNOWN.

### 3d. Commercial claim law (v3 §44; v2 §1)

I scanned public copy at `apps/web/src`, `index.html`, `manifest.webmanifest` and `packages/human-perspective/src`@8a3ae11 for: world #1, #1, guaranteed, 100% secure, 100% compliant, best model, highest accuracy, official certification, certified, millions of users, Sponsored by, world-class, most accurate.

**No violations found.**

- The only hit is the disclaimer "World #1 NOT PROVEN" (`apps/web/src/ui/TrustPanel.tsx:21`).
- A copy policy actively rejects such claims (`packages/human-perspective/src/policy.ts:88,104`).
- No fake sponsor or affiliate copy exists.
- One truth-adjacent copy inconsistency remains open (§7.11). It is not a claim-law violation, but it must be fixed before commercial launch.

### 3e. Other directive obligations vs repo

| Directive item | State | Evidence |
| --- | --- | --- |
| Revenue Brain opportunity graph (v3 §17) / CRM (v3 §35) | NOT_PRESENT | No CRM. Draft #67 only. |
| Gilden commercial modules, one PolicyKernel (v3 §16; v2 §6) | NOT_PRESENT in R9 | Draft #67 (ops contract) is unmerged. |
| Budget Kernel / Budget Guard (v3 §34; v2 §23) | NOT_PRESENT | No ceilings granted, so all spend effects stop. |
| House-card fallback (v2 §10) | NOT_PRESENT | A CSP-compatible first-party option exists by design. |
| Product-led cross-promotion (v3 §20) | PARTIAL | Daily Lab → Create seed (`LabAcquisitionSeed`, App.tsx:276@8a3ae11). No next-action links from /media, /studio or /research (no `navigateTo` in those dirs). |
| Creation distribution loop: share/remix (v3 §21) | NOT_PRESENT | Studio exports `.spe-site` locally; no share, remix or publish. |
| Model Atlas / Model Passports (v3 §22) | NOT_PRESENT | Provider-profile registry only (`data/provider_profiles_v1.json`). |
| Failure Genome (v3 §23) | NOT_PRESENT | — |
| CI / LSP funnel, `spe adopt .` (v3 §24) | NOT_PRESENT | `spe_runtime/cli/` is empty (`__init__.py` and `.gitkeep` only); no LSP. |
| `.spe` package ecosystem (v3 §15) | NOT_PRESENT | — |
| Runtime gateway / agent governance (v2 §3) | PARTIAL (primitives) | `spe_runtime/authority/*`, C07 execution grants @3abe3df. |
| Retention engine (v3 §37) | NOT_PRESENT | Needs measurement. |
| Email operating loop (v3 §36) | HOLD | No approved email account or authority. |

## 4. Feature → Money router coverage (v2 §3 classification)

Router states: ACTIVE = earning now. QUALIFIED_CANDIDATE = could be switched on within current authority. HOLD = blocked by gates or founder decision. NOT_ELIGIBLE = blocked by law, policy or absence.

| Feature (v2 §3) | PRIMARY (per directive) | Optional routes (per directive) | State | Reason |
| --- | --- | --- | --- | --- |
| Audio → Text | free acquisition | contextual ads; audio-tool sponsors; relevant affiliates; paid higher-compute tier later | HOLD | #138 HOLD; local host required; ads blocked by CSP and privacy copy. A hosted compute tier conflicts with zero audio egress unless it is opt-in (v3 §13). |
| Video → Text | free acquisition | ads; creator/video SaaS affiliates; Pro processing | HOLD | Same media path; no separate qualification. |
| 3D Website Builder | free acquisition; viral sharing/remix | hosting, domain and dev-tool affiliates; sponsors; Pro projects; hosted publishing later | HOLD | R9 PARTIAL; share/remix NOT_PRESENT; no disclosure component. Direct paid builds (services, v2 §4) need founder pricing. |
| System Prompt Engine | free acquisition | Pro; Team; Enterprise; CI; Model Atlas; managed execution | HOLD | No live domain, plans or entitlements; accounts are test-forbidden. |
| Screenshot → Code / URL → Site | free acquisition | developer sponsors; hosting partners; Pro; usage-based compute | HOLD (Screenshot) / NOT_ELIGIBLE (URL, for now) | URL fetch transport NOT_PRESENT (#137). |
| Image → Prompt | free acquisition | public contextual ads; design-tool affiliates; Pro/batch | HOLD | No live domain or disclosure; CSP blocks ads. |
| Research → Prompt | free acquisition; authority building | separated sponsorship; Pro workflow; Team; Enterprise (never "sponsor buys result") | HOLD | Live index and retraction HOLD (#128). |
| Model Atlas / SPE-Bench | developer credibility | Pro; Team; Enterprise; managed model evaluation | NOT_ELIGIBLE | NOT_PRESENT. |
| Failure Genome | moat + reliability | advanced private Genome; team regression; enterprise private corpus | NOT_ELIGIBLE | NOT_PRESENT. |
| LSP / IDE / CI | developer adoption | Pro; Team; Enterprise | NOT_ELIGIBLE | NOT_PRESENT (CLI empty). |
| Runtime gateway / agent governance | security and authority control | Team; Enterprise; OEM/API licensing | NOT_ELIGIBLE | Primitives only; not production-qualified (v3 §14). |
| Public pages (/capabilities, /privacy, /daily-lab) | SEO acquisition | house cards; dev-audience sponsor | HOLD | CSP and COEP block third-party scripts; first-party house cards are possible after the policy decision. |
| Provider profiles | — | disclosed affiliate (v2 Layer G) | HOLD | No disclosure policy or partner accounts. |

**ACTIVE routes: 0. QUALIFIED_CANDIDATE routes: 0.** Every classified event has an explicit state (v2 §5 coverage). FAILOVER A/B routes (v2 §4) cannot be assigned until at least one primary channel is eligible.

## 5. Evidence inventory: what exists

| Area | State | Evidence |
| --- | --- | --- |
| Pricing / plans / checkout / billing / refund / cancel / webhook / licence | NOT_PRESENT | grep stripe, razorpay, paddle, lemon, checkout, pricing, entitlement, subscription, billing, refund, webhook: only fixture text, CI `actions/checkout`, and ban lists. |
| Analytics / telemetry | NOT_PRESENT (policy-forbidden) | `audit-deps.mjs`@8a3ae11; `PrivacyProof.tsx`. "telemetry" hits are the local perf harness only (`website-studio/performance/measureScene.ts`). |
| Ad slots / house cards / affiliate / sponsor | NOT_PRESENT | grep returned 0 product hits. |
| robots / sitemap / meta / JSON-LD | PARTIAL | See SEO_status above. |
| Privacy policy | PARTIAL | `/privacy` is a product privacy-proof page, not a legal policy. It has no terms of service, refund policy or contact/grievance details, all of which payment providers and ad networks require. |
| CSP / security headers | PRESENT_VERIFIED (static) | `apps/web/public/_headers`@8a3ae11 and meta CSP in `index.html`. Vercel does **not** apply `_headers`: the live vercel.app response has no CSP, COEP or frame-ancestors header, only the meta CSP. |

## 6. Next 10 actions in dependency order

| # | Action | Tag |
| --- | --- | --- |
| 1 | Draft the v3 §29 Oct 8–12 commercial specs as docs for owner review: pricing architecture (Free/Pro/Team/Enterprise with the free-core guarantee); entitlement model (offline-licence option vs accounts); commercial event schema; revenue attribution (aggregate, privacy-safe); Sponsor Center spec; affiliate disclosure; media-kit template (no unmeasured numbers); public advertising boundaries plus a CSP-compatible house-card spec; CRM schema; revenue ledger (FORECAST / INVOICE / COLLECTED / RECONCILED). | within-authority-now (docs drafts) |
| 2 | Decide public hosting custody: Cloudflare Pages (R8 plan) or Vercel (existing prod deploy 2026-10-05 18:01 IST, source SHA UNKNOWN); keep or take down the vercel.app deployment; set the go-live gate against the 26 Oct target. | founder-authority-required |
| 3 | Commercial-policy amendment, as an owner-approved doc. Reconcile `docs/ZERO_COST_PRODUCT_LAW.md`, `audit-deps.mjs` bans, `test_web_privacy_pwa.py` (no login/signup/oauth) and the privacy copy with the directive. Explicitly allow: (a) cookieless first-party aggregate analytics; (b) disclosed affiliate links; (c) first-party sponsor/house cards with no third-party scripts; (d) offline licence or optional account for Pro/Team, with the free core unchanged. | founder-authority-required (then builder) |
| 4 | Measurement foundation: same-origin, cookieless aggregate analytics compatible with `connect-src 'self'`, reconciled with draft PR #69, plus the seven-pillar board events. Copy and privacy page updated through the owner-approved copy-check inventory. | builder-work-needs-owner-tasking |
| 5 | SEO crawlability: prerender or static crawl documents for the six public routes (reconcile draft PR #60); route AuthorityHub/guides only if they carry real tool evidence (v3 §19, v2 §30); keep private routes noindex. | builder-work-needs-owner-tasking |
| 6 | Legal pages needed by any payment or ad partner: legal privacy policy, terms, refund/cancellation, contact/grievance. | founder-authority-required (legal text); builder renders |
| 7 | Point systempromptengine.com DNS from GoDaddy parking to the chosen host; Search Console verification and sitemap submission. | founder-authority-required |
| 8 | Oct 13–17 pipeline research: sponsor prospect universe; affiliate candidates (PartnerStack, impact.com, Carbon/BuySellAds, plus provider and hosting programs, each with v2 §11 fields); B2B, OEM and enterprise prospects; payment providers fit for an India entity (Razorpay / Stripe / Paddle / Lemon Squeezy as merchant of record, GST). Outreach templates and 30-day pilot structure as drafts. | within-authority-now (research and drafts); applying, accepting or sending = founder-authority-required |
| 9 | Payment provider choice and account opening; budget ceilings (v3 §34). | founder-authority-required |
| 10 | Build and qualify checkout, subscription, refund, cancel, upgrade, downgrade, failed payment, duplicate webhook, licence and offline entitlement, plus the revenue ledger with payout reconciliation (v3 §29 Oct 18–22; v2 §25). | builder-work-needs-owner-tasking (after #9) |
| (+) | Product-led cross-links from /media, /studio and /research to the next useful action (v3 §20), plus Studio share/remix (v3 §21). | builder-work-needs-owner-tasking |

## 7. Conflicts between the directive and the current repo/policy

1. **CSP vs third-party ad scripts.** `_headers`@8a3ae11 sets script-src/connect-src 'self', img-src 'self' data: blob:, COEP require-corp and CORP same-origin. This blocks AdSense and most ad-network scripts and iframes (v3 §7, v2 §10). Only first-party, same-origin house or sponsor cards fit without weakening CSP.
2. **Permissions-Policy and form-action vs checkout.** `payment=()` and `form-action 'self'` limit Payment Request and embedded checkout. A hosted checkout redirect via link remains possible.
3. **Dependency bans.** `audit-deps.mjs`@8a3ae11 bans stripe, @vercel/analytics, posthog, mixpanel, amplitude, GA, plausible-tracker and firebase. `test_web_cost_and_scope.py` bans stripe.com in the lockfile.
4. **Accounts vs Pro/Team.** `test_web_privacy_pwa.py:47-73`@8a3ae11 asserts no `login`, `signup`, `oauth` or `indexedDB` in web source. v3 §3 ("ACCOUNT / PROJECT VALUE WHERE USEFUL") and the Team engine (v3 §11) need identity. Pro could use an offline licence instead (v3 §29 "offline entitlement"), but that needs a policy decision.
5. **Privacy copy.** `PrivacyProof.tsx` says "does not include analytics, ad tracking…". Any measurement, ad or sponsor change needs an owner-approved copy change, and changing privacy claims needs founder authority (v2 §22).
6. **ZERO_COST_PRODUCT_LAW.** It says ₹0 owner spend, no paid analytics, no ad SDKs in core, and no prompt marketplace in core. This conflicts with v3 §15 / v2 Layer H packs and marketplace unless they are scoped outside core. Hosting cost also conflicts with ₹0 unless a free tier is used.
7. **Hosting gate vs live deploy.** `HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE` (SPE-CHANGELOG) and the R8 note "Vercel is NOT USED" conflict with an existing Vercel production deployment (2026-10-05). On vercel.app, `_headers` security headers are not applied, and its canonical/sitemap point to the parked domain.
8. **Release date vs open HOLDs.** The 26 Oct 22:10 IST target faces open HOLDs: R9 Q1, Q4/Q5, #138 audio, research live index, URL fetch NOT_PRESENT, and #121 unmerged. The v3 §29 Oct 18–25 qualification and verification windows require commercial code that does not exist. The date cannot promote any HOLD.
9. **Local-only / zero-audio-egress vs hosted revenue.** Hosted transcription, "paid higher-compute tier" (v2 §3) or hosted evaluation (v3 §13) conflicts with the zero-audio-egress and local-first posture. Hosted offers must be explicit opt-in and separate.
10. **SEO scale vs Google policy.** Programmatic "evidence pages" must be real tool or evidence pages (v3 §19, v2 §30). Today's SPA injects per-route meta and JSON-LD client-side with no prerender.
11. **Copy inconsistency.** The privacy page says "Media stays on device", while the /media route meta says "request transcription from the configured app host". This needs reconciling before any public commercial launch (truth law, v3 §1).

## 8. Owner decisions required

1. Hosting custody: host choice; fate of the vercel.app production deployment; go-live gate.
2. Approve the commercial-policy amendment (analytics, affiliate, sponsor, account/licence posture) against the current zero-cost/no-ads/no-accounts laws and tests.
3. Payment entity and provider (Indian entity, GST, merchant-of-record or not); account opening.
4. Pricing and plan matrix (Free / Pro / Team / Enterprise) and the free-core guarantee wording.
5. Legal text: privacy policy, terms, refund/cancellation.
6. DNS change and Search Console verification.
7. Whether 3D-website services and enterprise pilots count as SPE revenue lines, and their price lists.
8. Budget ceilings (v3 §34). None granted, so all spend stays stopped.
9. A scoped outreach/email authority for GILDEN, if and when wanted (v3 §36).

## 9. Custody

- `main` stays at `3abe3df`.
- `8a3ae11` is untouched.
- `grok/r9s-audio-vad-telugu` (#138) and its working tree are untouched; this work used a fresh, separate clone.
- No other PR, branch or lane was touched.
- Nothing was sent, posted, spent, applied for or accepted. No DNS or Vercel change was made.
