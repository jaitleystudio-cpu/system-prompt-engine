# 04: REVENUE_ATTRIBUTION_SCHEMA (privacy-safe, proposal)

Directive: v2 §24 (USER/SESSION CLASS → ENTRY SURFACE → PRODUCT → COMMERCIAL SURFACE → CHANNEL →
PARTNER/PLAN → CONVERSION → CASH EVENT, "while respecting privacy rules"); v3 §29 (Oct 8–12
"revenue attribution"); v2 §5 (attribution "where technically possible").

## PURPOSE

Connect cash events to the surface and channel that produced them, **in aggregate**, without
identifying users or tracking across sites.

## CURRENT STATE

- Attribution: NOT_PRESENT (E20).
- `Referrer-Policy: no-referrer` is set (E1). This governs referrers SPE *sends*. Inbound
  referrers depend on the linking site.
- No cookies; there is no storage beyond opt-in-gated `localStorage` (E4).

## PROPOSED MODEL

1. **Entry channel classification** happens at page load, in memory only.
   - Sources: campaign parameters (`utm_*` or `<FOUNDER_DECISION>` naming) and
     `document.referrer` hostname class.
   - Outputs: `organic` / `direct` / `referral` / `ai_referral` / `campaign`.
   - Kept in memory for the tab session only. Nothing is persisted.
2. **Attribution key at the conversion boundary.** When a user clicks a commercial surface
   (checkout start, affiliate link, sponsor link), SPE appends a **non-identifying**
   `attribution_key`. The key encodes `{entry_channel, entry_surface, pillar, commercial_surface,
   day}` and nothing user-specific. The same key is shared by everyone with the same path.
3. **Join on the server/ledger side.**
   - Checkout: the key is passed as provider "client reference" metadata and returns on the
     webhook.
   - Affiliate: `sub_id` where the program supports it (UNKNOWN per program).
   - Sponsor: per-campaign link.
   - The ledger (spec 10) then attributes cash events to keys.
4. **Last-touch only.** Multi-touch would need persistent identity, which is rejected.
5. **Unattributable cash** is recorded as `UNATTRIBUTED` and never forced into a channel.

## DATA MODEL

```text
AttributionKey { key (short hash), entry_channel, entry_surface, pillar, commercial_surface, day }
                 — dictionary is public/deterministic; contains no user data
AttributionJoin { cash_event_id (→10), attribution_key | UNATTRIBUTED, join_method:
                  PROVIDER_METADATA|AFFILIATE_SUBID|CAMPAIGN_LINK|INVOICE_REF|MANUAL, confidence:
                  EXACT|PROGRAM_REPORTED|MANUAL }
ChannelReport  { month, channel, surface, pillar, cash_collected_minor, currency, n_events (k-suppressed) }
```

## AUTHORITY BOUNDARY

- The attribution design and campaign-parameter naming need the founder (F07).
- GILDEN may build reports from approved data. It may not add identifiers.

## PRIVACY BOUNDARY

- No user ID, cookie, fingerprint or cross-site identifier.
- Keys are path-level, not person-level.
- Reports are k-suppressed (spec 03).
- No prompt-derived dimension (v2 §1.3).
- Outbound affiliate and sponsor links keep `no-referrer`; attribution uses explicit, disclosed URL
  parameters (C08).

## SECURITY BOUNDARY

- Keys are validated against the dictionary.
- Spoofed keys only distort aggregates. They never grant entitlements, because entitlement comes
  from spec 02, not from keys.

## ZERO-COST IMPACT

No cost by itself. It rides on spec 03's collector and spec 10's ledger.

## FOUNDER DECISIONS REQUIRED

F07 (approve attribution, campaign-parameter naming), F10 (affiliate `sub_id` use).

## IMPLEMENTATION DEPENDENCIES

Specs 03 and 10, the provider metadata field (F03), and affiliate program capabilities (UNKNOWN
until programs are chosen; F10).

## QUALIFICATION PLAN

1. The key contains no user data (property test).
2. Two different users on the same path produce an identical key.
3. A webhook round-trip preserves the key.
4. Unattributed cash stays `UNATTRIBUTED`.
5. Outbound requests carry no referrer.

## ROLLBACK / DISABLE PATH

Stop appending keys; all cash is then `UNATTRIBUTED`. The ledger is unaffected.

## UNKNOWN / HOLD

- Attribution coverage rate: UNKNOWN.
- Affiliate `sub_id` support: UNKNOWN per program.

## ACCEPTANCE CRITERIA

- [ ] Last-touch, path-level model accepted.
- [ ] No persistent identifier anywhere.
- [ ] `UNATTRIBUTED` rule accepted.
- [ ] C08 handling accepted.
