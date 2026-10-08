# 09: COMMERCIAL_CRM_SCHEMA (proposal)

Directive: v3 §17 (Revenue Brain opportunity graph: fields and states), §29 (Oct 8–12 "CRM
schema"), §35 (outreach tracking: sent→…→reason; "Never fake personalization"), §36 (email loop);
v2 §6, §15, §22.

## PURPOSE

One store for sponsors, affiliates, enterprise, OEM, integration partners, press and research
collaborators. It must record evidence, authority and outcome per opportunity.

## CURRENT STATE

- CRM: NOT_PRESENT (E20).
- Draft #67 (E17) defines a Gilden local operations contract (`network_mode NONE`) with no
  commercial CRM.
- **The repository is public (E19).** Contact data must never be committed to it.

## PROPOSED MODEL

- **Single opportunity graph** with the v3 §17 fields and states.
- **Storage is outside the public repo** at a founder-chosen location (F12). Options:
  - an encrypted local file;
  - a private repository;
  - a CRM SaaS (cost, conflicting with E7).

  Only this schema lives in the public repo.
- **Outreach is draft-only** until F17 grants scoped send authority. Every send records the
  authority reference and the message ID (v3 §36).
- **Single PolicyKernel** (v2 §6). The Sponsor, Affiliate and Enterprise modules write to the same
  graph. There are no parallel CRMs.
- **Data minimisation.** Business contacts only: name, role, work email or public professional
  profile, source URL and collection date. Nothing sensitive. Delete on request.

## DATA MODEL

```text
Organization { org_id, name, domain, type: SPONSOR|AFFILIATE_PARTNER|ENTERPRISE|OEM|INTEGRATION|PRESS|RESEARCH,
               category, verification_evidence_ref, brand_safety }
Contact      { contact_id, org_id, name, role, channel (work email/profile), source_url, collected_at,
               lawful_basis: <DETERMINED_UNDER_APPLICABLE_LAW / LEGAL_REVIEW>, do_not_contact: bool }
Opportunity  { opportunity_id, channel, market, customer_type, expected_value: <estimate|UNKNOWN> (FORECAST only),
               expected_cost, probability_class: LOW|MED|HIGH|UNKNOWN, evidence_refs[], required_work,
               required_authority: [F##], owner, state: DISCOVERED|QUALIFIED|TESTING|ACTIVE|WON|LOST|HOLD|REJECTED|EXPIRED,
               next_action, deadline, actual_result, cash_collected_ref (→10, never typed by hand), lessons }   (v3 §17)
Interaction  { interaction_id, opportunity_id, contact_id, type: DRAFT|SENT|DELIVERED|REPLY|POSITIVE_REPLY|MEETING|PROPOSAL|WON|LOST,
               authority_ref (required when type ≥ SENT), message_id?, at, reason? }   (v3 §35)
```

## AUTHORITY BOUNDARY

GILDEN may:

- create and qualify opportunities;
- draft offers and outreach;
- update state on observed evidence.

The founder decides (F12, F17, F15):

- sends;
- any `WON` that implies a contract;
- the storage location;
- the CRM operating policy and retention scope.

**Lawful basis** for contact processing is **determined under applicable law through legal review**
(F15). It is not a founder preference or a GILDEN choice. The founder approves the operating policy
and retention scope (F12) within whatever basis legal review establishes.

`cash_collected_ref` links to the ledger. It can never be entered directly (spec 10).

## PRIVACY BOUNDARY

- No end-user (SPE user) data in the CRM.
- Contact PII is kept off the public repo (E19).
- Retention: `<FOUNDER_DECISION>`.
- Honour `do_not_contact`.

## SECURITY BOUNDARY

- Encrypted at rest.
- Access limited to the founder and authorised agents.
- No credentials or tokens stored in CRM records.
- Any export is redacted before sharing.

## ZERO-COST IMPACT

A local or private-repo store costs nothing. A SaaS CRM would conflict with E7 (C12).

## FOUNDER DECISIONS REQUIRED

F12 (storage, operating policy, retention scope), F17 (send authority), F15 (legal review of
outreach and contact data handling, including determination of the lawful basis under applicable
law).

## IMPLEMENTATION DEPENDENCIES

- Spec 10 for cash linkage.
- Specs 05 and 06 for sponsor and affiliate states.
- Reconciliation with draft #67 (E17) so there is one Gilden contract.

## QUALIFICATION PLAN

1. Schema validation.
2. An Interaction of type SENT without `authority_ref` is rejected.
3. `cash_collected_ref` must resolve to a ledger entry in COLLECTED or later.
4. A secret/PII scan on the public repo finds no CRM data.

## ROLLBACK / DISABLE PATH

Freeze writes. Export to the founder. Delete on instruction.

## UNKNOWN / HOLD

- Pipeline contents: UNKNOWN (none recorded).
- Lawful basis for contact processing: UNKNOWN until determined by legal review under applicable
  law (F15).

## ACCEPTANCE CRITERIA

- [ ] Schema accepted.
- [ ] Off-repo storage rule accepted.
- [ ] Send-requires-authority rule accepted.
- [ ] F12 decided (operating policy, retention scope, storage).
- [ ] Lawful basis determined by legal review (F15).
