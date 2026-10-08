# GILDEN × SPE: Commercial Specs Wave C0 (proposal-grade, docs only)

```text
WAVE: C0 — Oct 8–12 commercial architecture specifications (Directive v3 §29; Appendix A §28)
BASELINE: PR #139 head 7a8f2d491448d71696ed31cb121edeffe6cd211e
          (COMMERCIAL_CUSTODY_BASELINE_ACCEPTED__DRAFT_UNMERGED)
STATE: DRAFT_PROPOSALS_FOR_OWNER_REVIEW
IMPLEMENTATION: NONE (documents only)
MERGE: BLOCKED_PENDING_OWNER_ACCEPTANCE

NO:
- production deploy
- DNS changes
- payment-provider setup
- account creation
- partner applications
- outreach sends
- spend
- analytics activation
- ads activation
```

These are **proposals**. None of them is approved, built, qualified or live.

- No provider is chosen and no price is set.
- Every traffic, audience and revenue figure is **UNKNOWN**.
- Placeholders read `<FOUNDER_DECISION>` or `UNKNOWN`.
- Founder decisions are numbered `F01…` in `FOUNDER_DECISION_REGISTER.md`. Conflicts with current repo law are numbered `C01…` in `CONFLICT_MATRIX.md`.

## Index

| # | File | Topic |
| --- | --- | --- |
| 01 | `01_PRICING_ARCHITECTURE.md` | Plan architecture options and trade-offs. No prices. |
| 02 | `02_ENTITLEMENT_MODEL.md` | Offline signed licence vs optional account |
| 03 | `03_COMMERCIAL_EVENT_SCHEMA.md` | Privacy-safe commercial event vocabulary |
| 04 | `04_REVENUE_ATTRIBUTION_SCHEMA.md` | Aggregate, first-party attribution |
| 05 | `05_SPONSOR_CENTER_SPEC.md` | Sponsor lifecycle, inventory and separation of influence |
| 06 | `06_AFFILIATE_DISCLOSURE_SPEC.md` | Affiliate links, disclosure and ranking independence |
| 07 | `07_MEDIA_KIT_TEMPLATE.md` | Media-kit template with no invented audience numbers |
| 08 | `08_PUBLIC_AD_BOUNDARIES_AND_HOUSE_CARD_SPEC.md` | Ad-eligible surfaces and CSP-compatible first-party house cards |
| 09 | `09_COMMERCIAL_CRM_SCHEMA.md` | Opportunity graph and CRM (v3 §17, §35) |
| 10 | `10_REVENUE_LEDGER_SPEC.md` | FORECAST → … → OWNER_DISTRIBUTABLE_CASH_CANDIDATE, with evidence per transition |
| — | `DEPENDENCY_GRAPH.md` | Mermaid dependency graph and ordering |
| — | `CONFLICT_MATRIX.md` | Proposed capability vs current zero-cost, privacy and security law |
| — | `FOUNDER_DECISION_REGISTER.md` | Every founder decision, with options |

## Evidence key (cited as `E#` in all specs)

All `@8a3ae11` paths are on the frozen R9 candidate `8a3ae11bd82c8b56237e2216035711b5291a3ca5`. `main` is `3abe3df936082296b6a1ddc94923d757129cfdff`.

| Key | Evidence |
| --- | --- |
| E1 | `apps/web/public/_headers:2-9`@8a3ae11. Its rules: <br>• CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'` <br>• `Permissions-Policy … payment=()` <br>• `Cross-Origin-Embedder-Policy: require-corp` <br>• `Cross-Origin-Resource-Policy: same-origin` <br>• `Referrer-Policy: no-referrer` |
| E2 | `apps/web/index.html`@8a3ae11: the meta CSP mirrors E1's script, connect and form-action rules. |
| E3 | `apps/web/scripts/audit-deps.mjs:20-39`@8a3ae11 bans `stripe`, `@sentry/browser`, mixpanel, amplitude, posthog, GA, `react-ga*`, `plausible-tracker`, `firebase` and `@vercel/analytics`. Lines `:56-61` ban the `stripe.com` token in the lockfile. |
| E4 | `tests/web/test_web_privacy_pwa.py:47-73`@8a3ae11 asserts no `login`, `signup`, `oauth` or `indexedDB` in web source. `localStorage` is allowed only behind an opt-in gate. |
| E5 | `tests/web/test_web_cost_and_scope.py`@8a3ae11 bans `stripe.com` in the lockfile. |
| E6 | `apps/web/src/pages/PrivacyProof.tsx:59-62`@8a3ae11: "No ads, no sale, no silent tracking … does not include analytics, ad tracking, or a sale of your prompts." |
| E7 | `docs/ZERO_COST_PRODUCT_LAW.md`@8a3ae11 (same on main): ₹0 owner-spend target; no paid analytics; no ad SDKs or user-targeting ad pipelines in core; paid API keys (LLM, search, billing) = NO; prompt marketplace in core = NO. |
| E8 | `spe_runtime/media_product/local_backend.py:13,209-210`@8a3ae11: the runtime journey requires `user_audio_egress == 0`. This is the zero-audio-egress posture. |
| E9 | `apps/web/scripts/test-website-studio-runtime-journey.mjs:77-78`@8a3ae11: no `\bsignup\b` in Studio sources. |
| E10 | `apps/web/src/routing.ts`@8a3ae11: JSON-LD `Offer price "0"`, `isAccessibleForFree: true`, and the `NOINDEX_VIEWS` private surfaces. |
| E11 | `packages/human-perspective/src/policy.ts:81,88,104`@8a3ae11: "No prompt analytics are installed", plus regexes that reject "#1", "world's best" and "guaranteed results" claims. |
| E12 | `tools/copy-check.mjs` and `tests/copy/reviewed-inventory.json`@8a3ae11: the owner-approved copy inventory. New user-facing strings need owner approval. |
| E13 | `SPE-CHANGELOG:10`@8a3ae11: `HOSTING = FORBIDDEN_PENDING_FOUNDER_10_10_ACCEPTANCE`. |
| E14 | `apps/web/scripts/egress-proof.mjs`@8a3ae11: zero external network egress during evaluate. |
| E15 | Vercel deployment `system-prompt-engine-six.vercel.app`: **VERCEL DEPLOYMENT: BUILDER_OBSERVED; INDEPENDENT_CONNECTOR_VERIFICATION = UNAVAILABLE_CURRENT_SCOPE** (custody report §1, @7a8f2d4). |
| E16 | Draft PR #69 `f7c2e66`: aggregate-only privacy-analytics design. Unmerged and not in R9. |
| E17 | Draft PR #67 `d02b4cb`: Gilden local operations contract, `network_mode NONE`. Unmerged. |
| E18 | `data/provider_profiles_v1.json`@8a3ae11: `pricing_metadata_if_known: null`. |
| E19 | The repository `jaitleystudio-cpu/system-prompt-engine` is **public** (GitHub API `visibility=public`, checked 2026-10-08). |
| E20 | Custody report `docs/gilden/SPE_COMMERCIAL_CUSTODY_REPORT_2026-10-08.md`@7a8f2d4: checkout, billing, entitlement, analytics, attribution, ads, sponsor, affiliate, CRM and ledger are all **NOT_PRESENT**. |
| D | Directive `docs/gilden/COMMERCIAL_DIRECTIVE_v3_2026-10-08.md`@7a8f2d4. `v3 §n` refers to the governing text; `v2 §n` refers to Appendix A. |

## External facts

Partner and network facts are **owner-stated, not verified**. They come from directive context note t109u:

- PartnerStack: "100,000+ active partners, recurring-revenue tracking".
- impact.com: "large partner marketplace".
- Carbon/BuySellAds: "developer/design audiences".
- Google AdSense needs original, policy-compliant content (owner-cited: https://support.google.com/adsense/answer/9724?hl=en).

Nothing else external is asserted. Network terms, commissions, fees, payout thresholds and legal disclosure rules by jurisdiction are all **UNKNOWN** until fetched at application-preparation time.

## Global laws every spec obeys

These come from directive v3 §1, §7–§9, §33, §44 and v2 §1, §22.

- The free core stays free.
- No private content goes to ad systems.
- No prompt-derived targeting.
- No hidden affiliates.
- No fake sponsors.
- Sponsored money never buys ranking, research conclusions, benchmarks or evidence.
- No invented numbers.
- No self-granted authority.
- No third-party script that silently weakens CSP (E1, E2).
- Hosted processing is explicit opt-in only (E8, v3 §13).
- **Counting claim law:** no persistent identifier exists, so event counts ≠ unique users, event
  counts ≠ unique sessions and page views ≠ people (spec 03). Counts are labelled as event counts.
- **Suppression wording:** the reporting threshold is called MINIMUM_CELL_COUNT /
  REPORTING_SUPPRESSION_THRESHOLD. It is not called k-anonymity unless distinct-subject
  cardinality is proven.
- **IP wording:** "IP not stored" is allowed; "IP never processed" is not. Any request exposes the
  IP to hosting infrastructure transiently, and SPE components must discard it immediately (spec
  03).
- **Attribution integrity:** client attribution metadata is CLIENT_ASSERTED. Entitlement, billing
  and cash truth never trust it (spec 04, F21).
- **Licence honesty:** an offline licence is copyable unless bound and is never described as
  strong seat enforcement (spec 02, F22).
