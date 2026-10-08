# 02: ENTITLEMENT_MODEL: offline licence vs optional account (proposal)

Directive: v3 §3 ("ACCOUNT / PROJECT VALUE WHERE USEFUL"), §10–§12, §29 (Oct 8–12 "entitlement
model"; Oct 18–22 "license, offline entitlement"); v2 §25 (subscription reconciliation chain).

## PURPOSE

Decide how SPE knows a user may use a paid capability, without breaking local-first operation or
the current no-accounts posture.

## CURRENT STATE

- Entitlement, licence and account code: NOT_PRESENT (E20).
- Tests forbid `login`, `signup`, `oauth` and `indexedDB` in web source (E4, E9).
- `localStorage` is allowed only behind an opt-in gate (E4); the theme preference uses it (`apps/web/src/ui/theme.ts`@8a3ae11).
- There is no server: hosting is founder-gated (E13).

## PROPOSED MODEL

| Model | How it works | No-accounts compatible? | Offline? | Server needed | Team-capable? |
| --- | --- | --- | --- | --- | --- |
| **L1. Offline signed licence** (default proposal) | After purchase, the user receives a licence token signed with an SPE private key. The app verifies it locally with an embedded public key. No phone-home. | Yes. There is no login, but the stored licence needs the E4 opt-in gate or a test amendment (C10). | Yes | Issuance only, triggered by the provider webhook | Weak: seat counting is honour-based |
| **L2. Optional account** | Email or passkey login; server-side entitlement lookup | No: conflicts with E4 and E9 (C10) | Grace period only | Yes, always | Yes |
| **L3. Hybrid** | L1 for Pro; L2 only for Team/Enterprise admin consoles, as a separate surface outside the free app bundle | Free app stays account-free | Pro: yes | Yes, for Team | Yes |

**Recommendation:** L3. It is presented for founder choice (F04); GILDEN does not choose.

**Licence claims** (L1):

- `licence_id`, `plan_id`, `entitlement_keys[]`, `issued_at`, `expires_at|null`, `seats|null`,
  `licensee_ref` (opaque hash, no PII inside the token), `issuer_key_id`.

Rules:

- Revocation is by expiry for subscriptions (short renewable terms), plus an optional published
  revocation list fetched same-origin. The fetch is optional and the app works without it.
- Feature gating fails safely. A missing, expired or invalid licence means the **paid feature is
  off and the free core is unaffected**.
- There is no remote kill of free features.

## DATA MODEL

```text
EntitlementKey  { key: string (e.g. "pro.batch_compile"), tier_min, description, status }
Licence         { licence_id, plan_id, entitlement_keys[], issued_at, expires_at, seats,
                  licensee_ref (salted hash), issuer_key_id, signature (Ed25519 or <FOUNDER_DECISION>) }
EntitlementEvent { event_id, licence_id, type: ISSUED|RENEWED|EXPIRED|REVOKED|REFUNDED,
                   provider_event_ref, at }   → feeds 10_REVENUE_LEDGER
Account (L2/L3 only) { account_id, auth_method: <FOUNDER_DECISION>, org_id?, role? }
```

## AUTHORITY BOUNDARY

- Choosing the model, the signing-key custody and the refund→revocation policy is founder-only
  (F04, F05, F06).
- GILDEN may observe entitlement events, but it never issues or revokes licences by hand.

## PRIVACY BOUNDARY

- The licence holds no email or name, only an opaque `licensee_ref`.
- Verification is local; the app sends no usage telemetry to check a licence.
- An account (L2/L3) stores only email and org/role, and only on the separate admin surface.

## SECURITY BOUNDARY

- Private signing key custody: `<FOUNDER_DECISION>`, ideally offline or HSM-held (F05).
- The public key is pinned in the app build.
- Licence parsing is strict-schema with a size limit.
- Licence tampering, expiry and replay all get tests.
- The webhook receiver must verify the provider signature and be idempotent: duplicate webhook
  produces no duplicate licence (v3 §29 Oct 18–22).

## ZERO-COST IMPACT

L1 issuance needs a small server function. L2/L3 needs an auth service and storage. Both add cost
and hosting, so they conflict with E7 and E13 (C12, C14).

## FOUNDER DECISIONS REQUIRED

F04 (model), F05 (key custody), F06 (refund→revocation), F14 (hosting), F18 (cost).

## IMPLEMENTATION DEPENDENCIES

- Spec 01 (plans) and spec 10 (ledger EntitlementEvent linkage).
- A provider webhook (F03).
- Test amendments to E4/E9, only if the founder approves (C10).

## QUALIFICATION PLAN

Tests to run:

- valid, expired, tampered, wrong-key and oversized licences;
- offline verification with the network blocked (reuse the E14 approach);
- duplicate and out-of-order webhooks;
- refund → revoked at term;
- free-core regression with no licence;
- confirm no `login`/`signup` strings in the free bundle under L1 and L3.

## ROLLBACK / DISABLE PATH

- A global "paid features off" build flag.
- Existing licences keep verifying locally.
- Issuance can be paused without affecting any free user.

## UNKNOWN / HOLD

- Seat-enforcement strength under L1: weak by design.
- Provider webhook semantics: UNKNOWN until a provider is chosen.

## ACCEPTANCE CRITERIA

- [ ] F04 and F05 decided.
- [ ] The licence schema is reviewed.
- [ ] The C10 resolution is recorded (gate or test amendment).
- [ ] The fail-safe "paid off, free on" rule is accepted.
- [ ] No PII in the token.
