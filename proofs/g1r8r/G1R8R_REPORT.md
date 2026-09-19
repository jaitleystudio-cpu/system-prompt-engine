# SPE Ω v2.4.1 — G1R-8 INDEPENDENT K6 RECHECK REPORT

## FINAL VERDICT

**G1R8_RECHECK_PASS**

Finding G1R8R-F01 (digest↔payload inconsistency on load) was real and repaired with the minimum K6 validation/reconstruct path. Claim scope narrowed to **PORTABLE_SEMANTIC_BINDING_ARTIFACT**.

## SOURCE CUSTODY

| Field | Value |
|-------|-------|
| Base | `931128b384c3055ecef876124f787e5b8e67651b` |
| Implementation HEAD | `10de55ea3d8649ab701f185d6492ac73402b9711` |
| Review HEAD | `682cc55601f9136a3e41f79fd65d0a43a36711f8` |
| Branch | `cursor/g1r8r-k6-artifact-recheck-0d6e` |
| PR #16 | implementation |
| PR #6 | OPEN @ `4e6c694` — untouched |
| Working contract SHA | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |

## SOURCE SCOPE

Expected: `spe_runtime/storage/*` + K6 error codes · Unexpected K7/G2/G3: **none**

## K6 CANONICAL OWNERS

SpeArtifact / artifact identity / lineage: `build_spe_artifact` (1)  
Snapshot identity: **K2** · Prompt digest: **K3** · Qualification: **UNOWNED**

## ARTIFACT IDENTITY

Algorithm: SHA-256 · Bits: 256 · Prefix: `spe-` · Hex: 64 (full digest)  
Preimage: identity-bearing fields excluding `artifact_id`  
Domain discriminator: `format=spe`, `format_version=1` inside preimage  
Self-hash excluded: **YES**

## ID DOMAIN SEPARATION

pad / snap / led / rcpt / spe: **DISTINCT**

## SNAPSHOT BINDING

ID+version bound · Mismatch rejected · Snapshot writer remains K2: **YES**

## PROTECTED INTENT / REQUIREMENT GRAPH

Embedded: **YES** · Round-trip preserves kinds/provenance · Graph embedded in payload.graph · Reconstructable from `.spe` alone: **YES**

## REPLAY CAPABILITY

| Object | Mode |
|--------|------|
| ProtectedIntent | EMBEDDED / RECONSTRUCTABLE |
| RequirementGraph | EMBEDDED / RECONSTRUCTABLE |
| SemanticSnapshot | DIGEST_ONLY |
| PromptArtifact | DIGEST_ONLY |
| ProofLedger | DIGEST_ONLY / ABSENT |
| Direct lineage | field bound; existence NOT verified |

## PORTABILITY CLAIM

**PORTABLE_SEMANTIC_BINDING_ARTIFACT**  
(not SELF_CONTAINED_REPLAY_ARTIFACT)

## LINEAGE

Root null · Direct parent spe- · Parent existence verified?: **NO** · Self-parent: **REJECT** · Full ancestry-cycle: **OUT OF SCOPE** · Quality?: **NO**

## SERIALIZATION / TAMPER

Canonical UTF-8 JSON · Cross-process PASS · Duplicate keys REJECT · Unknown fields REJECT  
CONTENT INTEGRITY: **YES** · AUTHENTICITY: **NO** · SIGNATURE: **NO** · CONFIDENTIALITY: **NO**

## IMPORT TRUST BOUNDARY

Mutates K0/K1?: **NO** · Mints proof?: **NO** · Authority?: **NO** · Qualification?: **NO**

## CLAIM-SCOPE MATRIX

See `proofs/g1r8r/claim_scope_matrix.json` (section 57 complete).

## G1 GAP STATE

UNOWNED: **1** · MISSING: **2** (K7 only)

## G1 GATES

artifact_lineage_owner_unique: **PASS** · qualification / no_unowned: **FAIL** (K7)

## TESTS

G1R-8: 33/33 · G1R-8R: 17/17 · Full Python: 583/581/2 · compileall: PASS

## REVIEW FINDINGS

| ID | Finding | Severity | Resolution |
|----|---------|----------|------------|
| G1R8R-F01 | Load accepted pid-/rg- digests disagreeing with embedded payload if artifact_id recomputed | SEMANTIC | **REPAIRED** — reconstruct + digest match in validate_spe_artifact; stop list reordering in builder |
| G1R8R-F02 | Docs implied self-contained replay while snap/prompt/ledger are digest-only | CLAIM | **CORRECTED** — PORTABLE_SEMANTIC_BINDING_ARTIFACT |

## PROMOTION DECISION

**G1R-8: PASS_EXTERNAL**

## NEXT TASK

**G1R-9 — K7 ClaimQualification + QualificationEvidence** — DO NOT EXECUTE

## CLAIM BOUNDARY

G0 PASS · G1 BOUND_WITH_GAPS · G1R-7 PASS_EXTERNAL · **G1R-8 PASS_EXTERNAL** · Full Ring-0 NOT IMPLEMENTED · Production NOT QUALIFIED

## STOP

NO K7. NO G2. NO G3. NO PR #6 MERGE.
