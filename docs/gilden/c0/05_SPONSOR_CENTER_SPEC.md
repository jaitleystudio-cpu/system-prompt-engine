# 05: SPONSOR_CENTER_SPEC (proposal)

Directive: v3 §8 ("Never display 'Sponsored by X' until a real agreement exists"), §29 (Oct 8–12
"Sponsor Center"); v2 §1.5–6, §3 (Research: "NEVER: sponsor buys favorable research result"), §12.

## PURPOSE

Define the sponsor lifecycle, where sponsors may appear, and the hard **separation of influence**:
sponsor money buys disclosed placement only.

## CURRENT STATE

- Sponsor surface, policy, media kit and CRM: NOT_PRESENT (E20).
- Third-party scripts and remote images are blocked by CSP (E1, E2).
- The privacy copy promises no ad tracking (E6).

## PROPOSED MODEL

**Lifecycle.** From v3 §8 and v2 §12:

DISCOVERED → QUALIFIED → FIT_SCORED → VERIFIED_COMPANY → OFFER_DRAFTED → OUTREACH_DRAFTED →
*(founder-authorized send)* → NEGOTIATING → FOUNDER_APPROVED → CONTRACT_SIGNED (founder) →
CAMPAIGN_LIVE → MEASURED → INVOICED → COLLECTED → RENEW | REPLACE | ENDED.

**Separation of influence.** Binding rules; any breach means immediate campaign removal.

1. A sponsor can never buy ranking, recommendation order, research conclusions, benchmark
   results, Model Atlas or Model Passport scores, Failure Genome content, evidence, or editorial
   copy.
2. Sponsored placements live in visually distinct, labelled slots ("Sponsor", with a
   `<FOUNDER_DECISION>` wording). They never look like SPE actions (v2 §10).
3. A sponsor in a category being benchmarked is disclosed on that benchmark page. Benchmark
   sponsorship follows "benchmark sponsorship rules" (v2 §12): sponsor any suite, influence none.
4. No sponsor ever receives user data, prompts or private-surface impressions.
5. A sponsor is shown only after `CONTRACT_SIGNED` **and** `FOUNDER_APPROVED` (v3 §8).

**Inventory.** Public surfaces only (spec 08): home, capabilities, daily-lab, public docs and
benchmark pages.

**Delivery.** Sponsor creatives are rendered as **first-party house-card format**:

- self-hosted image or SVG plus text and a link;
- no sponsor script, no pixel, no iframe.

This is CSP-compatible with no change (C01, C02).

**Packages.** Placeholders only:

- 30-day pilot;
- monthly slot;
- benchmark-suite sponsor.

Rates are `<FOUNDER_DECISION>`. Every audience claim in an offer comes only from measured data
(spec 07).

## DATA MODEL

```text
Sponsor     { sponsor_id, legal_name, domain, category, verification_evidence_ref, brand_safety: OK|REVIEW|REJECT, conflicts[] }
Campaign    { campaign_id, sponsor_id, slots[], creative_ids[], start, end, price: <FOUNDER_DECISION>,
              contract_ref, founder_approval_ref, status, disclosure_text }
Creative    { creative_id, type: HOUSE_CARD_FORMAT, asset_path (self-hosted), alt_text, link_url, review_status }
Delivery    { campaign_id, day, slot, impressions, clicks }   — aggregate from 03
→ ledger: QUOTED / INVOICED / COLLECTED in 10; CRM in 09
```

## AUTHORITY BOUNDARY

GILDEN may discover, qualify, score and draft offers and outreach (v3 §33). The founder is needed
for: sending outreach (F17), pricing (F09), contract signing, campaign go-live and accepting
sponsor terms.

## PRIVACY BOUNDARY

Sponsors receive aggregate delivery reports only, with cells below MINIMUM_CELL_COUNT suppressed
(spec 03). Reports state event counts, never users, sessions or people (spec 03 counting claim law). There are no user-level
data, no retargeting and no sponsor tags.

## SECURITY BOUNDARY

- Creatives are reviewed and self-hosted. External links are shown in full on hover.
- No HTML or JS creatives.
- `rel="sponsored noopener"` on links.
- Malware and phishing domain check before go-live (the method is UNKNOWN; F09).

## ZERO-COST IMPACT

- Contracting and invoicing **may** be manual, with no checkout or billing infrastructure.
- **Delivering sponsor inventory is not infrastructure-free.** A placement still needs an
  approved, live public surface: hosting and deploy (F14, C14), the house-card renderer (spec 08),
  ad posture (F08) and copy approval (E12).
- It conflicts with E6 copy (ads/sponsor presence), so an E12 copy change is needed (C11).

## FOUNDER DECISIONS REQUIRED

F08 (ad posture), F09 (sponsor policy, labels, rates, eligible categories), F11 (published
metrics), F17 (outreach send authority), F15 (contract template).

## IMPLEMENTATION DEPENDENCIES

Specs 07, 08, 09 and 10, a live public surface (F14), and measurement (spec 03) before any
audience claim.

## QUALIFICATION PLAN

1. A slot cannot render without a campaign that is `CONTRACT_SIGNED` and `FOUNDER_APPROVED`.
2. No sponsor content on `NOINDEX_VIEWS` surfaces (E10).
3. No network request to a sponsor domain on render.
4. The label is present and accessible.
5. Benchmark pages render the disclosure when a category sponsor exists.

## ROLLBACK / DISABLE PATH

- Campaign `status → ENDED` removes the creative on the next build.
- A global sponsor-off flag falls back to house cards (spec 08).

## UNKNOWN / HOLD

- Sponsor demand, rates and audience: UNKNOWN.
- Legal disclosure wording by jurisdiction: UNKNOWN (F15).

## ACCEPTANCE CRITERIA

- [ ] The separation-of-influence rules are accepted verbatim.
- [ ] The lifecycle gates are accepted.
- [ ] House-card-format delivery is accepted (no CSP change).
- [ ] F09 decided.
