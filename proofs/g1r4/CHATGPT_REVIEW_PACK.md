# SPE Ω v2.4.1 — G1R-4A review pack (for ChatGPT)

Paste this whole file into ChatGPT.

## Repo / PR
- Repo: https://github.com/jaitleystudio-cpu/system-prompt-engine
- Branch: `cursor/g1r4a-proof-integrity-0d6e`
- Repair PR: https://github.com/jaitleystudio-cpu/system-prompt-engine/pull/10
- Prior PR #9 (`cursor/g1r4-k2-proof-tx-0d6e`): superseded for integrity repair; do not treat its PASS claim as current
- Working contract SHA: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`
- Base: 
- Evidence commit: 
- Implementation HEAD (suite): `931128b384c3055ecef876124f787e5b8e67651b`

## External review response

Prior verdict `G1R4_REVIEW_BLOCKED` accepted. G1R-4A repaired:

1. **Forged PASS** — process-local issuance digest; `commit_semantic_patch` calls `assert_receipt_integrity`; direct `VerificationReceipt(...)` rejected
2. **Adversarial tests** — forge / tamper id / tamper evidence / tamper issuance / mutation oracle
3. **Evidence coherence** — one authoritative manifest; binding JSON / report / PR agree on denominators
4. **Ambient wording** — external `AuthorityGrant` construction ≠ hidden ambient elevation

## Authoritative test manifest

See `proofs/g1r4/AUTHORITATIVE_TEST_MANIFEST.json` (exact command, HEAD, Python version, collected/passed/failed/skipped/exit/duration/SHA-256).

Snapshot at evidence generation (pre-final-hash-sync):

| Field | Value |
|---|---|
| G1R-1 | 5/5 PASS |
| G1R-2 | 27/27 PASS |
| G1R-3 | 37/37 PASS |
| G1R-4 (+4A) | 41/41 PASS |
| Authoritative Python | 414 collected / 411 passed / 3 failed |
| Expected failures | 3 (G1-B03 unowned K3/K6/K7 surfaces) |

## Ownership

UNOWNED = 4: privacy_projection, spe_artifact_identity, prompt_artifact, qualification_evidence

`protected_intent_contract` → K0 owned.

Ambient authority paths = 0 (hidden elevation definition; see writer-map `authority_grant` notes).

## Full report

See `proofs/g1r4/G1R4_REPORT.md`.

## Binding

Root + `proofs/g1/` + `proofs/g1r4/` `SPE_IMPLEMENTATION_BINDING_v2.json` are synchronized copies.

## Boundary (unchanged)

G1R-5 / G2 / G3 / PR #6 merge / Sprint 7 / `spe_runtime/omega/` — NOT STARTED / NOT AUTHORIZED.

## Requested re-review gate

Promote G1R-4 to PASS only if all of:

| Gate | Required |
|---|---|
| Direct forged PASS receipt | Rejected |
| Tampered receipt ID | Rejected |
| Tampered evidence digest | Rejected |
| Wrong proof type | Rejected |
| Wrong obligation | Rejected |
| Wrong snapshot | Rejected |
| Wrong patch | Rejected |
| FAIL / UNKNOWN / missing receipt | Rejected |
| Successful transaction atomicity | PASS |
| Failed transaction leaves input unchanged | PASS |
| G1R-1..G1R-3 regression | 0 |
| Evidence denominator disagreement | 0 |
| Stale canonical proof artifacts | 0 |
