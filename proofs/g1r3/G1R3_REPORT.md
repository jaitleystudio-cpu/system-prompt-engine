# SPE Ω v2.4.1 — G1R-3 K0/K1 SEMANTIC FOUNDATION REPORT

## FINAL VERDICT

G1R3_PASS

G1 remains **BOUND_WITH_GAPS**. G1R-4 / G2 were not started.

## SOURCE IDENTITY

Base: `931128b384c3055ecef876124f787e5b8e67651b`
Branch: `feat/g1r1-spec-binding-ownership-repair`
HEAD: `931128b384c3055ecef876124f787e5b8e67651b` (local G1/G1R-1/G1R-2/G1R-3 work uncommitted)
Working contract SHA: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`
PR #6: OPEN, tip `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e`, unmodified

Custody remains **WORKING_CONTRACT_BOUND**. 181/69 still UNAVAILABLE.

## K0 IMPLEMENTATION

Canonical provenance type: `spe_runtime.provenance.Provenance` (str Enum, not a score)
ProtectedIntentContract: `spe_runtime.contract.protected.ProtectedIntentContract`
Explicit intent: `propose_requirement(..., provenance=USER_EXPLICIT)`
Inferred intent: stored separately; cannot overwrite protected
User confirmation: `confirm_requirement(contract, requirement_id)` only
Human-sovereignty precedence: USER_EXPLICIT / USER_CONFIRMED / SYSTEM_REQUIRED cannot be replaced by INFERRED / MODEL_PROPOSED / SPE_SUGGESTED / EXTERNAL_EVIDENCE / UNKNOWN

## PROVENANCE TRANSITION MATRIX

| FROM | OPERATION | TO | ALLOWED? | ERROR |
|---|---|---|---|---|
| INFERRED | propose | INFERRED | yes | — |
| INFERRED | confirm_requirement | USER_CONFIRMED | yes | — |
| MODEL_PROPOSED | propose | USER_CONFIRMED | no | stays MODEL_PROPOSED |
| SPE_SUGGESTED | propose | USER_CONFIRMED | no | stays SPE_SUGGESTED |
| EXTERNAL_EVIDENCE | propose | USER_EXPLICIT | no | stays EXTERNAL_EVIDENCE |
| UNKNOWN | propose as MUST | MUST | no | `K1_INVALID_REQUIREMENT` |
| USER_CONFIRMED | propose | USER_CONFIRMED | no | `K0_INVALID_PROVENANCE_TRANSITION` |
| USER_EXPLICIT | propose INFERRED different value | overwrite | no | recorded `INFERENCE_CONFLICT` |
| any | high confidence | upgrade | no | confidence ignored |
| any | repeated inference | USER_CONFIRMED | no | stays INFERRED |
| any | category handoff | upgrade | no | contract not coupled to XCAT |

## PROTECTED INTENT TESTS

Negatives: inferred overwrite explicit/confirmed; model/suggested/evidence auto-confirm; UNKNOWN→MUST; confidence; repetition; handoff; tool output.
Positives: explicit preserved; confirm API; canonical round-trip; PREFERENCE≠MUST; SHOULD≠MUST; MUST_NOT survives; non-conflicting inference coexists unbound.

## K1 REQUIREMENT GRAPH

Node type: `RequirementAtom` (`requirement_id`, `semantic_key`, `kind`, `value`/`statement`, `provenance`)
Edge types: `CONFLICTS_WITH` only
Canonical writer: `RequirementGraph.with_node` / `with_edge` in `spe_runtime/requirements/graph.py`
Identity rule: `req-` + sha256(canonical_dumps({semantic_key, kind, value, source_ref}))[:32]

## CONFLICT CORE

Conflict type: `ConflictRecord` (`MUST_MUST_NOT`, `MUTUALLY_EXCLUSIVE`, `EXPLICIT_CONFIRMED`, `INFERENCE_CONFLICT`)
Detection rules: structured same-key MUST vs MUST_NOT; single-valued MUST clash; protected vs lower inference; equivalent duplicates are not conflicts; two PREFERENCE values are not hard unless schema requires
Resolution state: `UNRESOLVED` (no silent resolver)
Contract-validity behavior: unresolved HARD ⇒ `CONFLICTED` ≠ `VALID`; empty ⇒ `INCOMPLETE`

## AUTHORITY SEPARATION

Confirmed requirement grants authority?: **NO**
RequirementGraph writes authority?: **NO**
ConflictCore writes authority?: **NO**

USER_CONFIRMED ≠ EXECUTION_AUTHORIZED. `form_execution_intent` without a grant remains BLOCKED.

## PROOF SEPARATION

Contract validity means proof success?: **NO**
User confirmation means verified task success?: **NO**

`to_dict()` has no proof / verified_success / verification_receipt fields. K2 remains missing.

## WRITER AUDIT

Duplicate canonical writers: **0**
Ambient authority paths: **0**
Duplicate typed error writers: **0**

New K5 codes only: `K0_INVALID_PROVENANCE_TRANSITION`, `K1_INVALID_REQUIREMENT`. `ReasonCode is PortabilityReason is ErrorCode`.

## MODULE DISPOSITION CHANGES

| Path | Before | After |
|---|---|---|
| `spe_runtime/contract/__init__.py` | RETIRE (empty) | RETAIN |
| `spe_runtime/provenance/__init__.py` | RETIRE (empty, labeled K1) | RETAIN (K0) |
| `spe_runtime/provenance/models.py` | — | RETAIN |
| `spe_runtime/provenance/rules.py` | — | RETAIN |
| `spe_runtime/contract/intent.py` | — | RETAIN (alias, not a second owner) |
| `spe_runtime/contract/protected.py` | — | RETAIN |
| `spe_runtime/requirements/__init__.py` | — | RETAIN |
| `spe_runtime/requirements/models.py` | — | RETAIN |
| `spe_runtime/requirements/graph.py` | — | RETAIN |
| `spe_runtime/requirements/conflicts.py` | — | RETAIN |

Inventory: 60 → **68**. RETAIN 46 / WRAP 10 / MIGRATE 0 / REPLACE 0 / RETIRE 12.

## RING-0 GAP MOVEMENT

Before: unowned facts **7** / missing requirements **22** / implemented **8** / partial **20**
After: unowned facts **6** / missing requirements **16** / implemented **15** / partial **19**

Closed (MISSING→IMPLEMENTED): human sovereignty; explicit vs inferred; user-confirmed requirements; requirement graph; conflict.
Closed (PARTIAL→IMPLEMENTED): protected user intent; must / must-not.
MISSING→PARTIAL: intent contract schema (runtime contract real; `schemas/intent_contract.schema.json` still STUB).

Still missing (untouched): SemanticSnapshot, proof obligations, Proof Ledger, Semantic Lease, proof-carrying patch, verification receipt, atomic commit, cognitive plan, prompt strategy, technique selection, PromptArtifact, privacy projection, revocation epoch, schema registry, .spe artifact, artifact identity, snapshot binding, claim qualification, qualification evidence, plus remaining K3/K4/K5/K6/K7 items in the 16 MISSING.

## TESTS

Original baseline: 413 / 413 PASS
G1: 14 collected, 10 passed, 4 failed (G1-B03)
G1R-1: 5 / 5 PASS
G1R-2: 23 / 23 PASS
G1R-3: 37 / 37 PASS
Final: collected **492**, passed **488**, failed **4**, skipped **0**

Remaining failures (expected, G1-B03):

- `test_g1_no_unowned_required_ring0_responsibility` (6 unowned facts + 16 MISSING)
- `test_g1_proof_owner_unique`
- `test_g1_artifact_lineage_owner_unique`
- `test_g1_qualification_owner_unique`

Rust/WASM: not rebuilt. Additive K5 codes only; portable envelope ABI unchanged; replica sources untouched.

## PRODUCTION FILES CHANGED

- `spe_runtime/error_registry.py`
- `spe_runtime/provenance/__init__.py`
- `spe_runtime/provenance/models.py` (new)
- `spe_runtime/provenance/rules.py` (new)
- `spe_runtime/contract/__init__.py`
- `spe_runtime/contract/intent.py` (new)
- `spe_runtime/contract/protected.py` (new)
- `spe_runtime/requirements/__init__.py` (new)
- `spe_runtime/requirements/models.py` (new)
- `spe_runtime/requirements/graph.py` (new)
- `spe_runtime/requirements/conflicts.py` (new)
- `tests/unit/test_g1r3_k0_k1_foundation.py` (new)

## PROOF FILES

- `proofs/g1r3/head_before.txt`
- `proofs/g1r3/git_status_before.txt`
- `proofs/g1r3/working_contract_integrity.json`
- `proofs/g1r3/k0_k1_inventory_before.json`
- `proofs/g1r3/k0_k1_existing_surface.json`
- `proofs/g1r3/semantic_writer_map.json`
- `proofs/g1r3/red/r1_untagged_intent_overwrite.txt`
- `proofs/g1r3/red/r2_no_confirmation_api.txt`
- `proofs/g1r3/red/r3_no_protected_intent_contract.txt`
- `proofs/g1r3/red/r4_no_requirement_graph.txt`
- `proofs/g1r3/red/r5_no_conflict_core.txt`
- `proofs/g1r3/green/r1_inferred_cannot_overwrite_explicit.txt`
- `proofs/g1r3/green/r2_explicit_confirmation.txt`
- `proofs/g1r3/green/r3_protected_intent_contract.txt`
- `proofs/g1r3/green/r4_requirement_graph.txt`
- `proofs/g1r3/green/r5_conflict_core.txt`

## BLOCKER STATUS

G1-B01: WORKING_CONTRACT_BOUND
G1-B02: RESOLVED
G1-B03: **OPEN** (reduced: unowned 7→6, MISSING 22→16). Not resolved.
G1-B04: RESOLVED
G1-B05: STILL OPEN

## IMPLEMENTATION BINDING STATUS

**BOUND_WITH_GAPS**

Do not claim G1_PASS.

## NEXT TASK

If G1R3_PASS: **G1R-4 — K2 Proof Transaction minimum foundation**

DO NOT execute it.

## CLAIM BOUNDARY

G0: PASS
G1: BOUND_WITH_GAPS
G1R-1: COMPLETE
G1R-2: PASS
G1R-3: **PASS**
Full Ring-0: NOT IMPLEMENTED
Production: NOT QUALIFIED
World #1: NOT PROVEN

## STOP

STOP AFTER G1R-3.

NO G1R-4. NO G2. NO G3. NO Sprint 7. NO PR #6 merge. NO `spe_runtime/omega/`.
