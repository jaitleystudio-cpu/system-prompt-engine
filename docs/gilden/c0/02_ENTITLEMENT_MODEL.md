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
| **L1. Offline signed licence** (default proposal) | After purchase, the user receives a licence token signed with an SPE private key. The app verifies it locally with an embedded public key. No phone-home. | Yes. There is no login, but the stored licence needs the E4 opt-in gate or a test amendment (C10). | Yes | Issuance only, triggered by the provider webhook | Honour-based only: no seat enforcement (see threat model) |
| **L2. Optional account** | Email or passkey login; server-side entitlement lookup | No: conflicts with E4 and E9 (C10) | Grace period only | Yes, always | Yes |
| **L3. Hybrid** | L1 for Pro; L2 only for Team/Enterprise admin consoles, as a separate surface outside the free app bundle | Free app stays account-free | Pro: yes | Yes, for Team | Yes |

**Recommendation:** L3. It is presented for founder choice (F04); GILDEN does not choose.

**Licence claims** (L1):

- `licence_id`, `plan_id`, `entitlement_keys[]`, `issued_at`, `expires_at|null`, `seats|null`,
  `licence_subject_id`, `binding` (`TRANSFERABLE` / `ACCOUNT_BOUND` / `DEVICE_BOUND`, F22),
  `issuer_key_id`.
- `licence_subject_id` is a **random opaque identifier** from a CSPRNG (at least 128 bits),
  generated at issuance. It is **not** derived from, or a hash of, any email, name, payment or
  device data. Its mapping to the purchaser exists only in the off-repo ledger/provider record
  (specs 10, 09). A salted hash of personal data is not used because hashed PII stays linkable and
  re-identifiable; there is no specific reason to prefer it.

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
                  licence_subject_id (random opaque, CSPRNG), binding: TRANSFERABLE|ACCOUNT_BOUND|DEVICE_BOUND (F22),
                  issuer_key_id, signature (Ed25519 or <FOUNDER_DECISION>) }
EntitlementEvent { event_id, licence_id, type: ISSUED|RENEWED|EXPIRED|REVOKED|REFUNDED,
                   provider_event_ref, at }   → feeds 10_REVENUE_LEDGER
Account (L2/L3 only) { account_id, auth_method: <FOUNDER_DECISION>, org_id?, role? }
```

## AUTHORITY BOUNDARY

- Choosing the model, the signing-key custody and the refund→revocation policy is founder-only
  (F04, F05, F06).
- GILDEN may observe entitlement events, but it never issues or revokes licences by hand.

## PRIVACY BOUNDARY

- The licence holds no email or name, only a random opaque `licence_subject_id`.
- Verification is local; the app sends no usage telemetry to check a licence.
- The optional revocation-list fetch is a plain same-origin request. Like any HTTP request it
  exposes the client IP address to the hosting infrastructure transiently; it carries no licence
  identifier, and the IP must not be stored by SPE components (spec 03 IP rule).
- **Device binding has privacy consequences.** It needs a stable device identifier or
  fingerprint, which conflicts with the no-fingerprint and no-persistent-identifier posture (spec
  03; E6). It may only be adopted with explicit founder approval (F22; C21).
- An account (L2/L3) stores only email and org/role, and only on the separate admin surface.

## SECURITY BOUNDARY

- Private signing key custody: `<FOUNDER_DECISION>`, ideally offline or HSM-held (F05).
- The public key is pinned in the app build.
- Licence parsing is strict-schema with a size limit.
- Licence tampering, expiry and replay all get tests.

**Threat model (L1).** L1 is a convenience and honour mechanism. It is **not** DRM and **not**
strong seat enforcement.

| Threat | Reality under L1 | Mitigation options (founder decides) |
| --- | --- | --- |
| Copying | A signed offline token is a bearer artifact: anyone holding a copy can use it unless it is bound | Choose a binding (F22). Accept copying as a licence-terms matter (`TRANSFERABLE`). |
| Browser storage | `localStorage` and other browser storage are **not secure key storage**. The device user, extensions and any script running on the origin (e.g. via XSS) can read them. | Store only the public signed token, never a secret. No private or signing key ever reaches the client. |
| Client patching | The client is public source (E19), so a user can patch out the gate locally | None technical under L1. Paid value that cannot be patched out (hosted services, updates, support, licence terms) is a founder pricing question (F01). |
| Forgery | Prevented by signature verification, provided the signing key stays private (F05) | Key custody (F05); key rotation via `issuer_key_id`. |

**Binding options (F22):**

- **TRANSFERABLE (bearer):** simplest and most private. No enforcement against sharing.
- **ACCOUNT_BOUND:** requires an account (L2/L3), so it conflicts with E4/E9 in the free app
  (C10).
- **DEVICE_BOUND:** requires a device identifier (privacy conflict C21). It creates recovery
  burdens: a new device, a browser reset or cleared storage loses the licence. It needs a
  re-issue and recovery process, which touches support and the ledger. **Founder approval
  required** for both the privacy and the recovery consequences.

None of the options makes L1 strong seat enforcement.
- The webhook receiver must verify the provider signature and be idempotent: duplicate webhook
  produces no duplicate licence (v3 §29 Oct 18–22).

## ZERO-COST IMPACT

L1 issuance needs a small server function. L2/L3 needs an auth service and storage. Both add cost
and hosting, so they conflict with E7 and E13 (C12, C14).

## FOUNDER DECISIONS REQUIRED

F04 (model), F05 (key custody), F06 (refund→revocation), F22 (licence binding: transferable /
account-bound / device-bound, including device-binding privacy and recovery consequences), F14
(hosting), F18 (cost).

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
- confirm no `login`/`signup` strings in the free bundle under L1 and L3;
- confirm `licence_subject_id` is random (not derivable from purchaser data) and that no secret or
  signing key is present in the client bundle or browser storage;
- if F22 selects DEVICE_BOUND: recovery and re-issue path tested, and privacy review recorded.

## ROLLBACK / DISABLE PATH

- A global "paid features off" build flag.
- Existing licences keep verifying locally.
- Issuance can be paused without affecting any free user.

## UNKNOWN / HOLD

- Seat enforcement under L1: NONE. L1 is honour-based under every binding option, and is never
  described as strong seat enforcement.
- Licence binding: HOLD pending F22.
- Provider webhook semantics: UNKNOWN until a provider is chosen.

## ACCEPTANCE CRITERIA

- [ ] F04 and F05 decided.
- [ ] The licence schema is reviewed.
- [ ] The C10 resolution is recorded (gate or test amendment).
- [ ] The fail-safe "paid off, free on" rule is accepted.
- [ ] No PII in the token; random opaque `licence_subject_id` accepted.
- [ ] L1 threat model accepted (copyable, browser storage not secure, not seat enforcement).
- [ ] F22 decided.
