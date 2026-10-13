# SPE North Star R11 — Durable Public-Incident Metadata Custody

State: EXPERIMENTAL / DRAFT / REQUIRES INDEPENDENT REVIEW
Base: R0–R10 integrated draft PR #163 @ b3a51ec9a9639356cddf05aed13d8af7e9c0fe83

## Problem corrected

R6's previously in-memory event ledger lost duplicate/revision history after
a new process began. A scheduled observer could interpret the same public
notice as a brand-new event every run. Hashes inside a one-run journal did not
prove cross-run continuity, rollback resistance or even stable storage.

## Ownership and exact scope

- Existing Failure Genome R2 owns the append-only event chain and its rules.
- R6 owns the narrowly allowlisted public HTTPS observer.
- R11 is the existing event journal's host-side storage adapter; no new AI
  intelligence engine, private prompt telemetry or owner authority is created.
- Existing R1, R3, R4, R7, R9, R10 and Rust/WASM and .spe contracts unchanged.

R11 validates the owner allowlist before any fetch, strictly parses prior
bounded metadata, deterministically re-ingests each source snapshot against
the actual R2 validation owner and verifies every previous content hash and
chain digest. It rejects missing parents, duplicates, truncation, unknown
version, malformed JSON, mismatched authorities and unaudited rewrites. Under
an exclusive POSIX flock session, the host may fetch public metadata and
commit atomically with fsync before returning an observation summary.

The stored record has no raw status-provider body, incident title, user
prompt, email, provider authentication token, or source-search query.

## Boundaries and operational truth

- A **self-consistent SHA-256 ledger is NOT a signed, trusted, rollback-proof
  log**. A privileged actor can rewrite it and recalculate hashes. R12 needs
  an owner-pinned independent checkpoint/fresh-machine proof.
- Local durability covers the approved single POSIX host only, not multi-host
  distributed consensus or arbitrary cloud runner restarts.
- GitHub-hosted scheduled runners are ephemeral. A path inside an Actions
  runner is NOT persistent across jobs. R11 therefore refuses an approved
  live poll unless the owner supplies a separately controlled durable host.
- Configuring repository variables alone cannot establish durable storage.
- This stage never publishes a public solution, verifies a provider's root
  cause, makes a model API call, grants a deployment, or claims rank #1.
- A crash after HTTPS observation but before atomic commit can cause safe
  rediscovery; no external publish action occurs before committing.
- Local metadata integrity is not source authentication; existing R1 external
  source-review signature is still required.

## Independent R11 acceptance tests

1. Restart restores historical updates and makes same-content polls duplicate.
2. Update with exact predecessor appends once, with monotonic observation time.
3. Raw source title/body and private inputs are not persisted.
4. Truncated JSON, forged row, stale allowlist, corrupted chain and wrong
   version fail closed without reset/overwrite.
5. Symlink/hardlink state and lock attacks refuse access.
6. A failed atomic replace preserves previous state and reports an error.
7. A thrown exception before commit preserves the previous durable head.
8. Event budget cannot truncate earlier custody.
9. R6 rejects an injected journal belonging to a different source.
10. CLI remains zero-network default; no private durable host -> zero fetch.

## R12 forward boundary (not implemented here)

Separately trusted, out-of-band append checkpoint receipt with monotonic
head/freshness proof and independently verified rollback detection. Multi-host
or cloud execution requires a dedicated, externally approved storage owner
and contention testing rather than passing a local temp path.

Do not merge or deploy R11 based solely on passing tests. Require exact SHA
CI, independent security review, fresh restart/power-loss exercise, and a
real approved persistent host. All publication and paid-execution boundaries
remain HOLD.
