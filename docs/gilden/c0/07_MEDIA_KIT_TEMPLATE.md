# 07: MEDIA_KIT_TEMPLATE (proposal: no invented audience numbers)

Directive: v3 §29 (Oct 8–12 "media kit"), §44 (claim law), §43 (anti-vanity); v2 §12 ("Do not
promise audience numbers not measured"), §1.10–11.

## PURPOSE

Provide a media-kit structure for sponsors in which every metric is sourced from measured data or
shown as UNKNOWN.

## CURRENT STATE

- Media kit: NOT_PRESENT.
- Measurement: NOT_PRESENT (E20). Every audience field is therefore **UNKNOWN today**.
- The copy policy rejects "#1" and "guaranteed" claims (E11).

## PROPOSED MODEL

These template sections are the product of this spec. The values shown are the current truthful
state.

| Section | Field | Current value | Source rule |
| --- | --- | --- | --- |
| About SPE | One-paragraph description | Drawn from approved copy (E12) | No superlatives (v3 §44) |
| Product surfaces | Public tools and pages | List from `routing.ts` public views (E10) | Only live surfaces (F14) |
| Audience: traffic | Monthly visits, organic share, return rate | **UNKNOWN** | Spec 03 aggregates; period and method stated |
| Audience: geography and device | Top countries, device split | **UNKNOWN** | Spec 03, k-suppressed |
| Audience: profile | Developer, designer or creator share | **UNKNOWN** | Measurable only via voluntary survey (F11); never inferred from prompts |
| Inventory | Slots per surface | From spec 08 slot registry | — |
| Packages | Pilot, monthly, benchmark-suite | Rates: `<FOUNDER_DECISION>` | F09 |
| Policies | Separation of influence; disclosure; privacy | From specs 05, 06 and 08 | Verbatim |
| Reporting | What sponsors receive | Aggregate impressions and clicks, k-suppressed | Spec 03 |
| Contact | Sponsorship contact | `<FOUNDER_DECISION>` | F17 |

**Rules.**

1. Each metric shows its value, period, method and the date it was generated.
2. Missing data renders as `UNKNOWN`. It never renders as an estimate, range or projection.
3. Targets (v3 §5) never appear in a media kit.
4. Logos of past sponsors only with a signed agreement and permission.

## DATA MODEL

```text
MediaKit { version, generated_at, metrics[{name, value|UNKNOWN, period, method, source_ref}], inventory_ref,
           packages[{name, price: <FOUNDER_DECISION>}], policies_ref, approved_by, approved_at }
```

## AUTHORITY BOUNDARY

- GILDEN may generate drafts from approved data.
- Publishing or sending a kit is founder-only (F11, F17).

## PRIVACY BOUNDARY

Aggregates only. No individual or company visitor identification. No prompt-derived audience
profiling.

## SECURITY BOUNDARY

A kit file holds no internal URLs, credentials or private repo data. The repo is public (E19), so
drafts with real metrics stay out of the repo until approved.

## ZERO-COST IMPACT

None.

## FOUNDER DECISIONS REQUIRED

F09 (packages and rates), F11 (which metrics may be published, survey use), F17.

## IMPLEMENTATION DEPENDENCIES

Spec 03 (metrics), spec 05 (packages), spec 08 (inventory), and a live surface (F14).

## QUALIFICATION PLAN

1. Generator test: any metric without a `source_ref` renders as `UNKNOWN`.
2. Claim-law lint (E11 patterns plus v3 §44 list) passes.
3. The founder approval record is present.

## ROLLBACK / DISABLE PATH

Withdraw the kit version. Sponsors are told which version is superseded.

## UNKNOWN / HOLD

All audience metrics are UNKNOWN. Rates are `<FOUNDER_DECISION>`.

## ACCEPTANCE CRITERIA

- [ ] The template is accepted.
- [ ] The UNKNOWN-rendering rule is accepted.
- [ ] No number appears without a source.
