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
2. **Attribution metadata at the conversion boundary.** When a user clicks a commercial surface
   (checkout start, affiliate link, sponsor link), SPE attaches **non-identifying** path-level
   metadata: `{entry_channel, entry_surface, pillar, commercial_surface, day}` and nothing
   user-specific. Two integrity options are proposed; the founder chooses (F21).

   | Option | Mechanism | Trust class | Allowed use | Cost / law impact |
   | --- | --- | --- | --- | --- |
   | **A. Deterministic public key** (default, no server) | The client computes `attribution_key` from the public dictionary. The same key is shared by everyone with the same path. | **CLIENT_ASSERTED**: any visitor can read, alter or forge it | Low-trust aggregate channel reporting only | None |
   | **B. Server-minted signed token** | A same-origin SPE endpoint mints a signed token at the commercial-surface click. It contains only approved path-level fields, `day`, `expires_at` and `issuer_key_id`. It holds no user identity, no per-user or per-device identifier and no IP. | **SERVER_SIGNED**: proves the fields were issued by SPE and not altered. It does **not** prove a genuine human click, and a token can be replayed to inflate a path's count. | Higher-integrity aggregate reporting; still aggregate only | Needs a server (C14, F14) and possibly cost (C12, F18) |

   **Integrity law:** entitlement (spec 02), billing (spec 01) and cash truth (spec 10) **never**
   trust client attribution metadata under either option. Attribution metadata may label a cash
   event's channel. It may never create, change, gate or verify an amount, a licence, a ledger
   state or a payout.
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
AttributionKey { key (short hash), entry_channel, entry_surface, pillar, commercial_surface, day,
                 trust_class: CLIENT_ASSERTED }   — option A; public/deterministic; no user data
AttributionToken { fields{entry_channel, entry_surface, pillar, commercial_surface}, day, expires_at,
                 issuer_key_id, signature, trust_class: SERVER_SIGNED }   — option B (F21); no user identity
AttributionJoin { cash_event_id (→10), attribution_key | UNATTRIBUTED, join_method:
                  PROVIDER_METADATA|AFFILIATE_SUBID|CAMPAIGN_LINK|INVOICE_REF|MANUAL, confidence:
                  EXACT|PROGRAM_REPORTED|MANUAL, trust_class: CLIENT_ASSERTED|SERVER_SIGNED|
                  PROGRAM_REPORTED|MANUAL }   — label only; never an input to amounts or states
ChannelReport  { month, channel, surface, pillar, trust_class, cash_collected_minor, currency,
                 n_events (suppressed below MINIMUM_CELL_COUNT) }
```

## AUTHORITY BOUNDARY

- The attribution design and campaign-parameter naming need the founder (F07).
- GILDEN may build reports from approved data. It may not add identifiers.

## PRIVACY BOUNDARY

- No user ID, cookie, fingerprint or cross-site identifier.
- Keys are path-level, not person-level.
- Report cells below MINIMUM_CELL_COUNT are suppressed (spec 03). This is a reporting threshold,
  not k-anonymity.
- Counts are event counts, not unique users, sessions or people (spec 03 counting claim law).
- Option B tokens carry no user identity and no per-user or per-device identifier (F21).
- No prompt-derived dimension (v2 §1.3).
- Outbound affiliate and sponsor links keep `no-referrer`; attribution uses explicit, disclosed URL
  parameters (C08).

## SECURITY BOUNDARY

- Option A keys are **CLIENT_ASSERTED**: validation against the dictionary only rejects malformed
  keys. It cannot detect a well-formed forged key.
- Option B tokens are signature-checked and expiry-checked. The signing key never reaches the
  client.
- Under both options, spoofed or replayed metadata can only distort aggregate channel reports.
  Entitlement (spec 02), billing (spec 01) and cash truth (spec 10) never trust client
  attribution metadata.
- Reports display the trust class next to every attributed figure.

## ZERO-COST IMPACT

- Option A: no cost by itself. It rides on spec 03's collector and spec 10's ledger.
- Option B: needs a minting endpoint, so it adds hosting (C14) and possibly cost (C12).

## FOUNDER DECISIONS REQUIRED

F07 (approve attribution, campaign-parameter naming), F10 (affiliate `sub_id` use), F21 (attribution
integrity: option A CLIENT_ASSERTED vs option B server-minted signed token).

## IMPLEMENTATION DEPENDENCIES

Specs 03 and 10, the provider metadata field (F03), and affiliate program capabilities (UNKNOWN
until programs are chosen; F10).

## QUALIFICATION PLAN

1. The key contains no user data (property test).
2. Two different users on the same path produce an identical key.
3. A webhook round-trip preserves the key.
4. Unattributed cash stays `UNATTRIBUTED`.
5. Outbound requests carry no referrer.
6. A forged or altered key or token never changes an entitlement, amount or ledger state.
7. Option B: a token with an altered field or an expired token is rejected, and it contains no
   field outside the approved list.

## ROLLBACK / DISABLE PATH

Stop appending keys; all cash is then `UNATTRIBUTED`. The ledger is unaffected.

## UNKNOWN / HOLD

- Attribution coverage rate: UNKNOWN.
- Affiliate `sub_id` support: UNKNOWN per program.
- Integrity option: HOLD pending F21. Until then, all attribution is CLIENT_ASSERTED.

## ACCEPTANCE CRITERIA

- [ ] Last-touch, path-level model accepted.
- [ ] No persistent identifier anywhere.
- [ ] `UNATTRIBUTED` rule accepted.
- [ ] CLIENT_ASSERTED classification and the integrity law accepted.
- [ ] F21 decided (option A or B).
- [ ] C08 handling accepted.
