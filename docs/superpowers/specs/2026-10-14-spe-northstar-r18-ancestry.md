# SPE Ω North Star R18 — Pin the complete PRIOR metadata checkpoint

**DRAFT / release HOLD / no signing authority or external trust store provisioned.**
Parent: R17 PR #171 at 28e7a74af68d5c606356203fa86500973f524580.

## Security failure corrected
R16 signs the current complete durable metadata document. However the
external `OwnerPinnedFloor` retained only prior sequence, count and R2
chain head. The R2 head does not commit the source URL or model-scope.
A subsequent otherwise valid signature could therefore cover a rewritten
old URL/model field without verifying its provenance against the prior
owner-approved metadata state. This matters whenever an external signing
owner mistakenly signs a changed historical state.

## R18 verified policy
- The next externally stored floor candidate includes the complete current
  metadata document SHA-256, not only count and R2 chain head.
- For any non-genesis floor, the prior full metadata SHA-256 is mandatory.
- Deterministically replay exactly the first N journal observations under
  existing R2 ingest and R11 metadata canonicalization, recompute the prior
  full-document digest, and require equality to the owner-pinned prior digest.
- Reject a reused checkpoint sequence if the metadata digest changed even
  when the R2 chain head and count are unchanged.
- A genesis floor may omit the previous metadata digest only when its
  sequence AND historical record count are both zero.
- Old incomplete non-genesis floors require trusted requalification and
  must not silently inherit upgraded authority.

## Adversarial qualification
Tests reproduce unchanged R2 head and freshly correctly signed latest R16
checkpoint, while historical source URL or model-scope is changed. R18
rejects these against the prior owner-pinned metadata floor. Also tests
legitimate history extension, old-floor downgrade, forged prior digest,
sequence replay on metadata-only changes, and malformed pinned metadata.

## Explicit external gaps
R18 remains code-level local evidence. True rollback protection requires
separately managed owner trust keys, secure monotonic off-host floor storage,
fresh-machine recovery, hardware fault/power-loss proof, and independent
review. This PR cannot sign, approve, publish or deploy any content. It
makes no genuine provider-model diagnosis or worldwide #1 claim.
