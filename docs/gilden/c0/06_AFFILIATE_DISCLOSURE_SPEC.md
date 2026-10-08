# 06: AFFILIATE_DISCLOSURE_SPEC (proposal)

Directive: v3 §9 ("NO hidden affiliate injection. NO ranking a bad product higher merely because
commission is higher. Disclosure must remain clear."), §29 (Oct 8–12 "affiliate disclosure");
v2 §1.4, §2 Layer G (RELEVANT, DISCLOSED, USEFUL, MEASURABLE), §11.

## PURPOSE

Define when an affiliate link may appear, how it is disclosed, and how recommendations stay
independent of commission.

## CURRENT STATE

- Affiliate links, disclosure UI and program records: NOT_PRESENT (E20).
- The provider-profile registry exists with `pricing_metadata_if_known: null` (E18). It is a
  candidate surface.
- `Referrer-Policy: no-referrer` is set (E1).

## PROPOSED MODEL

**Eligibility.** A link may appear only if all four Layer G tests pass:

- **RELEVANT** to the current public surface's task;
- **USEFUL** compared with non-affiliate alternatives;
- **DISCLOSED**;
- **MEASURABLE** (spec 04).

**Ranking independence.**

- Lists and recommendations are ordered by a documented, commission-blind criterion.
- The commission field is not available to the ranking function. A code-level separation test is
  required.
- Non-affiliate options appear when they are better.
- An "affiliate" marker never changes position.

**Disclosure.**

- An inline label sits adjacent to each link. Proposed text: "Affiliate link: SPE may earn a
  commission"; the final wording is `<FOUNDER_DECISION>` through E12.
- A page-level disclosure notice goes on any page with affiliate links.
- A public disclosure policy page is linked from the footer.

**Surfaces.** Public pages only (spec 08). Never inside private tool output, prompts or exports.
Never auto-injected into user-generated content or Studio exports (no hidden injection).

**Links.**

- Plain first-party `<a>` elements with `rel="sponsored noopener"`.
- No affiliate scripts, redirect-tracking iframes or pixels (C01–C03).
- Attribution uses the program's link parameter or `sub_id` (spec 04).
- No referrer is sent (C08).

## DATA MODEL

```text
AffiliateProgram { program_id, partner, network: <owner-stated/UNKNOWN>, commission: UNKNOWN until terms fetched,
                   recurring: UNKNOWN, cookie_window: UNKNOWN, geography, approval_status: NOT_APPLIED|APPLIED|APPROVED|REJECTED,
                   restrictions, payout_threshold: UNKNOWN, terms_date, terms_url, content_fit, user_value_note }   (v2 §11 fields)
AffiliateLink    { link_id, program_id, surface, url, disclosure_text, ranking_basis_ref, status }
AffiliateReport  { program_id, month, clicks (from 03), conversions (program-reported), commission_reported, cash_received (→10) }
```

## AUTHORITY BOUNDARY

- GILDEN may research programs and record terms with the fetch date (v3 §33).
- Applying to a program, accepting terms and publishing links are founder-only (F10).

## PRIVACY BOUNDARY

- No user data goes to programs beyond what the click itself carries.
- No referrer is sent.
- No prompt-derived link selection (v2 §1.3).

## SECURITY BOUNDARY

- Links are allow-listed by domain.
- Periodic dead-link and redirect-hijack check (method TBD).
- No URL shorteners that hide the destination.

## ZERO-COST IMPACT

No infrastructure cost. Programs may require account creation, which is founder-only.

## FOUNDER DECISIONS REQUIRED

F10 (program selection, applications, disclosure wording), F15 (disclosure legal review), F11.

## IMPLEMENTATION DEPENDENCIES

Spec 04 (attribution), spec 08 (surfaces), spec 10 (commission → payout reconciliation), and the
E12 copy inventory.

## QUALIFICATION PLAN

1. Every affiliate link has an adjacent disclosure (DOM test).
2. The ranking function has no access to commission (static check).
3. No affiliate link on `NOINDEX_VIEWS` (E10) or in exports.
4. No third-party request on render.
5. Each program record has a `terms_date`.

## ROLLBACK / DISABLE PATH

- Program `status → RETIRED` removes its links on the next build.
- A global affiliate-off flag.

## UNKNOWN / HOLD

- Commissions, cookie windows, approval odds and payout timing: UNKNOWN.
- Owner-stated ecosystems (PartnerStack, impact.com) are unverified.

## ACCEPTANCE CRITERIA

- [ ] Layer G tests accepted as gating.
- [ ] Commission-blind ranking accepted.
- [ ] Disclosure placement accepted.
- [ ] No-injection rule accepted.
