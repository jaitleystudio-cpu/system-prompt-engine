# SPE Ω v2.4.1 — G1R-8 K6 .spe ARTIFACT + LINEAGE REPORT

## FINAL VERDICT

**G1R8_PASS**

## SOURCE IDENTITY

| Field | Value |
|-------|-------|
| Base | `931128b384c3055ecef876124f787e5b8e67651b` |
| Branch | `cursor/g1r8-k6-spe-artifact-0d6e` |
| HEAD | `ec5bb711e8f03b97664dc18ea9c6d5122ddbb942` |
| Working contract SHA | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |
| PR #6 | OPEN @ `4e6c694` — untouched |

## K6 EXISTING SURFACE

Existing packages: empty `spe_runtime/storage/` (RETIRE)  
Reactivated: **`spe_runtime/storage/` → RETAIN**  
Retired duplicates: none competing

## .spe ARTIFACT

| Field | Value |
|-------|-------|
| Canonical type | `SpeArtifact` |
| Canonical builder | `spe_runtime/storage/build.py::build_spe_artifact` |
| Format | `spe` |
| Format version | `1` |

**Design:** embed canonical protected-intent payload; bind snapshot/prompt/proof-ledger by typed digests.

## ARTIFACT IDENTITY

| Field | Value |
|-------|-------|
| Canonical writer | `build_spe_artifact` (1) |
| ID format | `spe-` + sha256[:64] |
| Identity preimage | all identity-bearing fields **excluding** `artifact_id` |
| Hash | SHA-256 via K5 `canonical_dumps` + K2 `content_digest` |
| Identity-bearing | format, version, snapshot_id/version, pid/rg digests, pad digest, led digest, parent_artifact_id, contract_validity, protected_intent_payload |
| Non-identity metadata | none in Ring-0 (no path/filename/timestamps) |

## ID DOMAIN SEPARATION

pad- / snap- / rcpt-/led- / spe- remain distinct. Confirmed.

## SNAPSHOT BINDING

Snapshot owner: **K2** `make_snapshot`  
Artifact fields: `snapshot_id`, `snapshot_version`, pid/rg digests  
Mismatch: `K6_SNAPSHOT_BINDING_MISMATCH`

## LINEAGE

Root: `parent_artifact_id = null`  
Parent: `spe-...`  
Canonical lineage writer: `build_spe_artifact`  
Self-parent: **REJECT** (`K6_INVALID_LINEAGE`)  
Full ancestor-cycle detection: **NOT IMPLEMENTED / OUT OF SCOPE**

## SERIALIZATION

Encoding: UTF-8 canonical JSON  
Round-trip: PASS  
Duplicate keys: REJECT  
Unknown fields: REJECT  
Noncanonical whitespace: accept parse → canonical re-export

## TAMPER DETECTION

Modified identity-bearing field + old ID → `K6_ARTIFACT_ID_MISMATCH`  
CONTENT INTEGRITY CHECK: **YES** · AUTHENTICITY: **NO** · SIGNATURE: **NO**

## K0/K1 PRESERVATION

Provenance / MUST / MUST_NOT / SHOULD / PREFERENCE preserved in embedded payload.  
Conflicts: CONFLICTED preserved (not laundered to VALID).

## K2/K3 BINDINGS

SemanticSnapshot: referenced (snap-)  
ProofLedger: optional led- reference only  
PromptArtifact: referenced (pad-)  
Protected intent: **embedded** canonical payload

## DOMAIN SEPARATION

.spe import → authority? **NO**  
.spe import → proof? **NO**  
.spe import → qualification? **NO**  
.spe hash → truth? **NO**  
.spe lineage → better state? **NO**

## IMMUTABILITY

Top-level: frozen+slots · Nested: MappingProxyType · Copy-on-write: YES

## DETERMINISM

Cross-process bytes/ID: **PASS** · Filename/path independent: **PASS** · No random/time deps

## WRITER AUDIT

spe_artifact_identity: 1 · artifact_lineage: 1 · snapshot: K2 · prompt digest: K3 · qualification_evidence: **UNOWNED**

## G1 GAP MOVEMENT

Before: UNOWNED 2 / MISSING 4  
After: UNOWNED **1** / MISSING **2**  
Resolved: spe_artifact_identity, .spe artifact, snapshot binding, lineage  
Remaining: claim qualification, qualification evidence (K7)

## G1 GATES

artifact_lineage_owner_unique: **PASS**  
no_unowned_required_ring0: **FAIL** (K7)  
qualification_owner_unique: **FAIL** (K7)

## TESTS

Full Python: collected **566** / passed **564** / failed **2** / skipped 0  
G1R-8: 33/33  
compileall: PASS  

Remaining failures are the two expected K7 gates only.

## PRODUCTION FILES CHANGED

- `spe_runtime/storage/{__init__,models,build,validate,serialize}.py`
- `spe_runtime/error_registry.py` (K6_* codes)
- G1 maps / inventories / prior gap assertions
- `tests/unit/test_g1r8_k6_spe_artifact.py`

## RUST/WASM

Rebuilt?: **NO** · Reason: `RUST_WASM_NOT_REBUILT` / `NO_SHARED_ABI_CHANGE`

## BLOCKER STATUS

G1-B01 RESOLVED · G1-B02 RESOLVED · G1-B03 OPEN (K7 only) · G1-B04 RESOLVED · G1-B05 OPEN

## IMPLEMENTATION BINDING

**BOUND_WITH_GAPS** (K7 remains)

## NEXT TASK

**G1R-8R — Independent K6 Artifact + Lineage Recheck**  
DO NOT execute it. DO NOT jump to K7 without external recheck.

## CLAIM BOUNDARY

G0 PASS · G1 BOUND_WITH_GAPS · G1R-1..7 PASS(_EXTERNAL) · **G1R-8 PASS (implementation; external review pending for PASS_EXTERNAL)** · Full Ring-0 NOT IMPLEMENTED · Production NOT QUALIFIED · World #1 NOT PROVEN

## STOP

NO G1R-8R EXECUTION. NO K7. NO G2. NO G3. NO SPRINT 7. NO PR #6 MERGE. NO spe_runtime/omega/.
