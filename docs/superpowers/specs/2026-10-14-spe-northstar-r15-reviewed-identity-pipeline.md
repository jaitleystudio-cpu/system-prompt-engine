# SPE Ω North Star R15 — Real Provider ID to Internal SPE Review Integration

State: EXPERIMENTAL / DRAFT / NO PUBLIC RELEASE
Parent: R14 signed identity bridge PR #168 at b699ffffed8c14123db4998fd14028982e422a8c.

## Problem
Original R4 and R10 assumed external provider event IDs equal internal
SPE-FG IDs. Real provider events have distinct identifiers. R14 introduced
an authenticated mapping, but reviewer/editorial owners did not yet use it.

## R15 integration within existing owners
- R4 internal reviewer now optionally accepts external event ID only when
  an owner-signed proposal can be cryptographically reverified against the
  latest exact R2 journal entry, source revision, chain head and model scope.
- R10 editorial release staging accepts the same external ID only when
  an actual Failure Genome case AND fresh owner-signed mapping are supplied;
  the existing two independent editorial/release signatures are still required.
- Neither reviewer trusts a precomputed boolean or caller supplied
  IncidentLinkAssessment. Identity is rechecked at the point of use.
- Any source revision, replaced head, private case or signer failure HOLDs.
- A provider RETRACTION continues to suppress positive staging.
- The original same-ID synthetic/legacy test path remains for compatibility;
  it is not a substitute for independent external-source review.

## Proof limitations
Signed source identity only certifies the mapping's owner review.
Independent primary-source authenticity, current real-model reproduction,
causal explanation, effective repair, G6-H human results and separate
public deployment remain HOLD. R4 outputs noindex reviewer-only HTML.
R10 outputs noindex staging-only HTML. No real visitor page is published.

## Test gates
1. Real external IDs differ from SPE IDs and unsigned bridge fails closed.
2. Authenticated mapping permits only noindex review and staging.
3. Self-certified truth flags and untrusted receipt roots fail.
4. Changed provider source versions invalidate prior link.
5. Private or forged source records remain blocked.
6. Retractions never yield positive staging.
7. Existing full regression, CLI/WASM, zero-egress and governance tests PASS
   at exact commit before independent integration review.
