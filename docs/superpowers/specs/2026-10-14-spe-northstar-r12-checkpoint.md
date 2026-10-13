# SPE Ω North Star R12 — Owner-Pinned Custody Checkpoint

**State: DRAFT / TEST-SCOPE ONLY / NO PUBLICATION**
Parent: R11 PR #164 at 8289b8662de6dcae9e4b1b878d74eaece685a25b.

## Exact security claim
R11's unsigned local SHA-256 hash chain cannot prevent a privileged attacker
from rewriting the entire file and recomputing digests. R12 accepts an
Ed25519-signed head under an owner-enrolled public key only when a separate
owner-controlled, monotonically increasing floor matches the journal's
historical ancestor and no recorded sequence is reused for different content.

The owner must store key and floor in a *different* independently protected
trust domain, not the watched file, not a news feed and not source control.
A Python argument alone cannot prove the floor was independently sourced.

## Checks
- Exact receipt scope, sequence, count, SHA-256 head and owner allowlist.
- Strict timezone-aware checkpoint freshness (default 48h, max 7 days).
- Ed25519 signature under a separately enrolled owner public key.
- Prior trusted floor is an exact ancestor at its independently pinned count.
- Reject sequence rollback/reuse, changed head, stale date, forged signer,
  missing trust root, tampered local journal and mismatched allowlist.

## NON-CLAIMS
No source-content authenticity, true incident confirmation, real-model
reproduction, causal root-cause proof, repair validation, distributed quorum,
cross-host consensus, public publication, search ranking, model billing or
privileged deployment is performed. Output is only local checkpoint review.
The next floor is a candidate for *external owner* commit, not persisted.

## Independent production gates
1. R11 fresh-machine and concurrent-process restart/recovery validation.
2. R12 exact-commit CI, mutation suite and reviewer-independent signatures.
3. Owner-enrolled separate public-key trust, key revocation, monotonic floor
   persistence, verified signed receipt chain and incident correction policy.
4. Existing XCAT, Rust/WASM, .spe, LVT, G6-H and release gates unchanged.
5. STOP if any independent authority or evidence is UNKNOWN.
