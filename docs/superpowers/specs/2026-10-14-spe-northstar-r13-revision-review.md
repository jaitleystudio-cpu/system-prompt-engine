# SPE North Star R13 — Independently Reviewed Provider Revisions

State: DRAFT / NO PUBLICATION / NO AUTONOMOUS RECLASSIFICATION
Parent: R12 PR #166 @ 853b52ff1c015e2d1efac6fcb85b2d179cc1a055.

## Actual failure mode
The R6 public Statuspage adapter records a change as UPDATE, even when the
provider's surrounding text suggests a correction or withdrawal. This is
intentionally conservative. Classifying CORRECTION or RETRACTION from raw
untrusted text would allow fake stories to self-certify a retraction.

## Existing-owner integration
R13 uses the existing R2 EventKind/CORRECTION/RETRACTION and journal ingest,
the R1 Ed25519 receipt verifier, and the R11 lock/commit session owner.
The signer must have separately reviewed the actual provider notice and
must be enrolled in an owner-managed trust root. The exact request binds
source id, incident id, original URL/model-scope, new and predecessor
source-content SHA-256 digests, publication/observation times, journal head,
event kind, and source-review reason.

Without independently signed metadata R13 returns HOLD. A trusted receipt
is about the authorized reviewer, not independent evidence that the
provider's model had a specific bug, why it failed or that a fix works.

## Adversarial matrix
- Plain source UPDATE cannot auto become CORRECTION/RETRACTION.
- Unsigned or self-signed request cannot reclassify an incident.
- Wrong predecessor, URL, model revision/scope, digest, parent head,
  timestamps, review reason and duplicate source versions are refused.
- A confirmed RETRACTION is terminal under existing R2 journal law.
- Single-use signatures are bound to the current journal head.
- No production site, sitemap, provider bill, G6-H or LVT mutation.

## Production release law
Existing release owner must independently authenticate source and
receipts, approve correction text/rights, rerun R10's dual-signature
staging gate and publish any retraction to existing site. No direct
web publication or notification is performed by this code.
An external trust root and source-review workflow are not provisioned
here; exact-commit CI is necessary but not sufficient.
