# 01: PRICING_ARCHITECTURE (proposal)

Directive: v3 §10–§14 and §29 (Oct 8–12 "pricing architecture"); v2 §2 Layers C–F, §13, §19, §21.
Evidence keys: see `README.md`.

## PURPOSE

Define how SPE *could* charge without crippling the free core. This spec covers plan structures,
billing dimensions and trade-offs. **No prices are set:** the owner has fixed none.

## CURRENT STATE

- Pricing, plans and paid tiers are NOT_PRESENT (E20).
- The public structured data asserts the product is free: JSON-LD `Offer price "0"`,
  `isAccessibleForFree: true` (E10).
- Billing dependencies are banned (E3, E5).
- Repo law sets a ₹0 owner-spend target and "Paid API keys (… billing) = NO" (E7).

## PROPOSED MODEL

**Free-core guarantee.** This is a proposed binding rule, F01.

Everything free today stays free, with no feature removal or degradation:

- local prompt compile (/create);
- screenshot→code prompt (/code);
- image→prompt;
- local 3D Studio preview and `.spe-site` export;
- local transcription when a local host is present;
- `.spe` export;
- local history (opt-in).

Paid tiers may only add value that is expensive, professional, collaborative or governed
(v3 §10: "Pro should monetize expensive/high-value capabilities rather than basic usefulness").

**Candidate architectures.** The founder chooses one or a combination (F01).

| Option | Shape | Fits local-first? | Needs accounts? | Needs a server? | Main risk |
| --- | --- | --- | --- | --- | --- |
| A. Pro subscription | Recurring individual plan | Yes, with an offline licence (spec 02) | No, if a licence is used | Yes: licence issuance and provider webhooks (C14, C15) | Churn; billing infrastructure before demand is proven |
| B. Perpetual or term licence | One-time or annual key for local Pro features | Strongest | No | Issuance only | Weaker recurring revenue (v3 §0 prefers recurring) |
| C. Hosted credits (opt-in) | Usage-based, for remote eval and cross-model runs (v3 §13) | Only as an explicit opt-in | Likely | Yes, plus compute cost | Conflicts with zero egress unless strictly opt-in (C13); spend versus ₹0 law (C12) |
| D. B2B-first (Team/Enterprise, sales-led) | Quote → invoice → contract | Yes (on-prem, v3 §12) | Team: yes (C10) | Not for invoicing | Long cycles; needs legal templates (F15) |
| E. Services (paid builds, pilots) | Quoted fixed scope | Yes | No | No | Not product revenue; founder must decide scope (F20) |

**Candidate tier map.** Features are drawn from v3 §10–§12. "Cand." means candidate. All are NOT_PRESENT today.

| Capability | Free | Pro (cand.) | Team (cand.) | Enterprise (cand.) |
| --- | --- | --- | --- | --- |
| Core compile, export, local tools | ✔ (guaranteed) | ✔ | ✔ | ✔ |
| Advanced history, versioning, batch compile | — | ✔ | ✔ | ✔ |
| Larger evaluation runs, cross-model execution, advanced Model Atlas | — | ✔ (hosted parts opt-in) | ✔ | ✔ |
| Private Failure Genome, drift monitoring, evidence archives | — | ✔ | shared | org-private |
| CI capabilities | — | ✔ | enforcement | ✔ |
| Shared projects, RBAC, approval flows, private registry | — | — | ✔ | ✔ |
| On-prem, air-gapped, SSO, audit exports, SLA | — | — | — | ✔ |

**Billing dimensions.** Pick per tier (F01): per seat, per workspace, per licence term, per hosted
compute unit, or per contract. Price points, currency and region are all `<FOUNDER_DECISION>`
(F01, F02).

**Pricing conduct.** Required by v2 §1.7–9 and §19:

- no fake discounts, fake urgency or dark patterns;
- every price change runs as a champion/challenger experiment with guardrails (v3 §25).

## DATA MODEL

```text
Plan        { plan_id, name, tier: FREE|PRO|TEAM|ENTERPRISE|HOSTED_ADDON|SERVICE,
              billing_dimension, price: <FOUNDER_DECISION>|null, currency: <FOUNDER_DECISION>,
              term: MONTH|YEAR|PERPETUAL|CONTRACT, entitlements: [entitlement_key],
              status: DRAFT|APPROVED|ACTIVE|RETIRED, approved_by, approved_at }
EntitlementKey   (defined in 02)
PriceExperiment  { experiment_id, champion_plan_id, challenger_plan_id, guardrails[], status }
```

## AUTHORITY BOUNDARY

- GILDEN may draft options and model economics, but only with founder-supplied inputs (v3 §33).
- Approving any price, publishing a pricing page and changing an active price all need the founder.
- GILDEN never auto-changes a live price.

## PRIVACY BOUNDARY

Pricing pages carry no tracking beyond the first-party aggregate events in spec 03. Prices are
never personalised from prompt content (v2 §1.3).

## SECURITY BOUNDARY

The price shown must match the provider checkout amount. That gets a server-side check in
implementation (dependency on 02 and 10). The client must never be trusted for the amount.

## ZERO-COST IMPACT

- Options A–D introduce provider fees and possibly hosting costs, which conflicts with E7 (C12).
- Option E (services) may operate manually without product infrastructure: no checkout,
  entitlement or collector. It still needs legal templates (F15) and off-repo CRM/ledger stores
  (F12, F13).
- Sponsor inventory is a separate line (spec 05). Even with manual contracting and invoicing, it
  needs an approved, live public surface to deliver placements (F14, F08).
- Any cost needs F18 (zero-cost law amendment) and F16 (budget ceilings).

## FOUNDER DECISIONS REQUIRED

F01 (architecture, free-core wording, prices), F02 (currency, tax, geography), F03 (provider), F19 (hosted opt-in),
F18, F20.

## IMPLEMENTATION DEPENDENCIES

- Spec 02 (entitlements), 03 (events) and 10 (ledger).
- Legal pages: terms and refund (F15).
- Hosting decision (F14).
- Copy approval for the pricing page through E12.
- Updated JSON-LD offers (C17).

## QUALIFICATION PLAN

1. Every plan entitlement maps to a feature flag that exists.
2. The free-core regression proves every free capability still works with no licence present.
3. Price displayed equals checkout amount equals ledger INVOICED/COLLECTED amount (spec 10).
4. No dark-pattern copy (copy review through E12).

## ROLLBACK / DISABLE PATH

- A plan `status → RETIRED` hides the plan.
- Existing paid entitlements are honoured until term end (spec 02).
- The free core is unaffected by any pricing rollback.

## UNKNOWN / HOLD

- Willingness to pay, conversion, churn and ARPU: UNKNOWN.
- Provider fees and tax treatment: UNKNOWN.
- All prices: `<FOUNDER_DECISION>`.

## ACCEPTANCE CRITERIA

- [ ] The founder picks the option(s) and approves the free-core guarantee text.
- [ ] The tier map is reviewed so that no free capability is removed.
- [ ] Billing dimensions are chosen.
- [ ] Every price is either founder-set or explicitly absent.
- [ ] Conflicts C10, C12, C14 and C17 have a recorded resolution.
