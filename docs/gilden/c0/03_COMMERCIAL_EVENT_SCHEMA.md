# 03: COMMERCIAL_EVENT_SCHEMA (proposal, design only)

Directive: v3 §26 (scoreboard), §29 (Oct 8–12 "commercial event schema"); v2 §9 (seven-pillar
board), §24 (attribution), §5 ("100% monetizable-event classification").

## PURPOSE

Define one privacy-safe vocabulary for product and commercial events. Every monetizable event can
then be classified, counted and reconciled without collecting private content. **This is design
only: no analytics is activated.**

## CURRENT STATE

- Analytics, telemetry and event collection: NOT_PRESENT, and banned at SDK level (E3).
- The privacy copy promises no analytics or ad tracking (E6, E11).
- An aggregate-only privacy-analytics design exists only in unmerged draft #69 (E16).
- CSP `connect-src 'self'` allows same-origin beacons only (E1).

## PROPOSED MODEL

There are two event families with separate pipelines.

1. **Product aggregate events** (client → same-origin collector, only if F07 approves).
   - Counters only, with coarse dimensions.
   - No user ID, no cookie, no fingerprint, no free text, no prompt/file/audio/transcript content.
   - Sent batched to a same-origin endpoint, which fits E1 without a CSP change.
   - Honour an in-app opt-out. Respecting Global Privacy Control/DNT is proposed as default-on (F07).
2. **Commercial events** (server-side, from provider webhooks, invoices and partner reports).
   These carry money references and never carry user content. They feed spec 10.

**Event vocabulary.** Product events are aggregate. Revenue engines come from v3 §7–§15.

| Group | Events |
| --- | --- |
| Acquisition | `page_view{surface}`, `tool_start{pillar}`, `tool_complete{pillar, outcome:OK\|ERROR\|CANCEL}`, `export{pillar, format}`, `cross_tool_next{from_pillar,to_pillar}` |
| Commercial surface | `house_card_impression{slot,card_id}`, `house_card_click{slot,card_id}`, `sponsor_impression{slot,campaign_id}`, `sponsor_click{…}`, `affiliate_click{slot,program_id}`, `pricing_view{plan_set}`, `checkout_start{plan_id}` |
| Commercial, server-side | `checkout_complete`, `subscription_renewed`, `subscription_cancelled`, `payment_failed`, `refund_issued`, `chargeback`, `licence_issued` / `licence_revoked`, `invoice_sent`, `invoice_paid`, `affiliate_commission_reported`, `affiliate_payout_received`, `sponsor_contract_signed`, `sponsor_payment_received` |

**Coarse dimensions only:**

- `surface`; `pillar` (the 7 pillars, v2 §9);
- `device_class` (mobile/desktop);
- `country` (optional, F07). If used, it is derived from the request IP address at request time
  by the hosting/edge infrastructure. **The IP address is therefore transiently processed** (as it
  is for any HTTP request) and must be discarded immediately after the country lookup. It is never
  written to the aggregate, the collector store or SPE-controlled logs. Infrastructure access-log
  retention of IPs is UNKNOWN until hosting is chosen (F14) and must be configured and verified.
  If that cannot be verified, `country` is omitted;
- `entry_channel` (organic, direct, referral, AI-referral, campaign; from spec 04);
- `day` (UTC date).

**REPORTING_SUPPRESSION_THRESHOLD:** any report cell whose count is below
`<FOUNDER_DECISION: MINIMUM_CELL_COUNT>` is suppressed.

- This is a **report-count threshold**, not k-anonymity. There is no persistent identifier, so a
  cell count is a count of events, not of distinct people. A cell of N events may come from one
  person. The design must not be described as k-anonymous unless distinct-subject cardinality per
  cell is proven, and this design cannot prove it.

**Counting claim law.** No persistent identifier exists, so:

- event counts ≠ unique users;
- event counts ≠ unique sessions;
- page views ≠ people (visitors, readers, audience size).

Every report, dashboard, media kit (spec 07) and sponsor report (spec 05) must label counts as
event counts (e.g. "page_view events"). They must never be relabelled as users, visitors,
sessions, people, reach or audience.

## DATA MODEL

```text
ProductAggregate { day, event, dims{surface,pillar,device_class,entry_channel,country?}, count }
   — no row-level events stored server-side beyond the batching window
CommercialEvent  { event_id (uuid), type, occurred_at, source: PROVIDER|INVOICE|PARTNER_REPORT|BANK|MANUAL,
                   source_ref (provider event id / invoice no.), plan_id?, campaign_id?, program_id?,
                   amount_minor?, currency?, evidence_ref (→ 10 Evidence), attribution_key? (→ 04) }
Classification   { monetizable_event_type → route_state: ACTIVE|QUALIFIED_CANDIDATE|HOLD|NOT_ELIGIBLE }
```

## AUTHORITY BOUNDARY

- Activating collection, changing privacy copy (E6, E12) and changing the privacy policy are all
  founder-only (v2 §22).
- GILDEN may read aggregates once they exist. It never adds dimensions on its own.

## PRIVACY BOUNDARY

**Forbidden fields:**

- prompt text, file names, transcripts, image or audio data, URLs entered by users;
- emails; IP addresses (never stored or logged by SPE components; transiently processed by request
  infrastructure only, as stated above; no document may claim SPE never processes IP addresses);
- user agents (not stored, except the derived `device_class`);
- precise timestamps per user;
- cross-site IDs.

Rules:

- Private surfaces (`NOINDEX_VIEWS`, E10) emit only `tool_start` and `tool_complete` counters.
- The schema has a CI test that rejects new fields not on an allow-list.

## SECURITY BOUNDARY

- The collector accepts a fixed schema only.
- It is rate-limited.
- It is same-origin, with no CORS opening.
- Webhook events require provider signature verification and idempotency keys.

## ZERO-COST IMPACT

A collector needs a server or edge function plus storage, which conflicts with E7 and E13 (C12,
C14). Commercial events need the ledger store (spec 10).

## FOUNDER DECISIONS REQUIRED

F07 (activate first-party aggregate analytics; opt-out and GPC posture; MINIMUM_CELL_COUNT; country
dimension; privacy copy), F14,
F18.

## IMPLEMENTATION DEPENDENCIES

- Hosting (F14).
- Reconciling with draft #69 (E16) so there is a single analytics owner and no second stack.
- Copy changes through E12.
- An E3 amendment is **not** needed if the collector is first-party code with no SDK.

## QUALIFICATION PLAN

1. Schema allow-list test.
2. Prove no forbidden field via a fuzz test.
3. Network test: only same-origin requests (extend E14).
4. Suppression below MINIMUM_CELL_COUNT.
5. No IP address in collector storage or SPE logs (inspection test); hosting log retention verified
   before `country` is enabled.
6. Report-label lint: no "users", "visitors", "sessions" or "people" label on event counts.
7. Opt-out stops all product events.
8. Webhook replay is idempotent.

## ROLLBACK / DISABLE PATH

- A build-time flag removes the emitter.
- The collector returns 410.
- Aggregates are deleted on rollback if the founder chooses.

## UNKNOWN / HOLD

- All event volumes are UNKNOWN.
- MINIMUM_CELL_COUNT is `<FOUNDER_DECISION>`.
- Unique users, unique sessions and people: NOT_MEASURABLE by design (no persistent identifier).
- Hosting-infrastructure IP log retention: UNKNOWN (F14).

## ACCEPTANCE CRITERIA

- [ ] The vocabulary is reviewed.
- [ ] The forbidden-field list is accepted.
- [ ] The counting claim law (events ≠ users ≠ sessions ≠ people) is accepted.
- [ ] The IP-processing statement (transient processing, immediate discard, no storage) is accepted.
- [ ] F07 is decided.
- [ ] Single-owner reconciliation with #69 is agreed.
- [ ] No CSP change is required (verified against E1).
