# SPE North Star R16 — Signed Full-Metadata Custody Checkpoint

State: EXPERIMENTAL / DRAFT / NO PRODUCTION RELEASE.
Parent: R15 integration draft PR #169 @ ecb1124f4f7aa2d93d7dba76764c4a1bda76ba60.

## Vulnerability addressed
The original R2 journal chain hash tracks source/event ID, incident body
digest, timestamps, update type and chain parent, but does not hash every
stored source metadata field, including source URL and model scope.
Thus, a self-consistent local history can have the same R2 head while
containing different URL or model-scope data.

R12 v1 signed only count, R2 head and allowlist, which was insufficient to
authenticate the complete normalized durable custody document.

## R16 fix under existing owners
- R11 now exposes the normalized persistent-state document checksum.
- R12 checkpoint schema upgraded to v2, signing the full-document digest
  in addition to source allowlist, count, head, UTC issued time and sequence.
- Verifier recomputes whole-document checksum from the current verified
  R11 observations and rejects changed source URL/model scope even when
  R2 chain head is unchanged.
- Legacy v1 checkpoint receipts fail closed, requiring owner renewal.
- Independent trust-root/monotonic-floor setup remains mandatory and
  cannot be self-created by an incident report or local journal.

## Negative controls
1. Model scope rewritten, original R2 head unchanged: v2 rejects.
2. Source URL rewritten within source allowlist, original R2 head unchanged:
   v2 rejects.
3. V1 head-only receipt reused: v2 schema rejects.
4. Durable restart yields deterministic identical document digest.
5. All R0–R15 unit, CLI, WASM and egress tests must pass.

Passing these gates is NOT production rollback resistance until a separate
owner actually deploys and enforces the external signer/key floor.
No provider real-model failure, causal root, repair, publication, revenue
or global SEO supremacy is established in this branch.
