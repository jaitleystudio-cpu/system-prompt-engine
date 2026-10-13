# SPE North Star R14 — Signed External/Local Incident Identity

State: DRAFT / NO PUBLIC CLAIMS
Parent: R13 PR #167 at c349e2ab75b8a56feb26e9ae9d3a0082133d68fe.

## Actual integration defect
Public provider incident IDs (for example provider-inc-777) are NOT
internal SPE Failure Genome IDs (for example SPE-FG-2026-004002).
Existing R4/R10 reviewer code compared those identifiers as if identical,
so it could not qualify a genuine provider Statuspage case without a
dangerous rename/forgery. Do not rewrite the source ID to look like SPE.

## R14 exact binding
Under the existing Failure Genome and Ed25519 receipt owner, build a
separately signed owner-reviewed link between real external source/event
ID, source URL, current journal content+chain digests, UTC snapshot times
and internal SPE failure ID, pinned model-version claim and reproducer hash.

Verify against the actual latest R2 journal, not a reported free-text ID;
later provider corrections or other journal heads invalidate old signatures.
Private/unconsented examples, self-signed keys, changed model/incident
identity, wrong timestamp, forged digest and missing source cannot qualify.

The output is ONLY a reviewer-certified link. It never proves an actual
provider model revision, model failure, internal root cause, repair or
publication authority. Trust-root enrollment occurs out of band.

R15 must teach existing R4/R10 review owners to ACCEPT this verified
mapping without dropping their other publication restrictions. Direct
caller-supplied boolean/assessment objects must never replace independent
cryptographic re-verification at the point of use.
