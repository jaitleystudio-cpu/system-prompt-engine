# SPE Ω v2.4.1 — G1R-4 K2 PROOF TRANSACTION REPORT

## FINAL VERDICT

G1R4_PASS

G1 remains **BOUND_WITH_GAPS**. G1R-5 / G2 / G3 were not started.

## SOURCE IDENTITY

Base: `931128b384c3055ecef876124f787e5b8e67651b`
Branch: `feat/g1r1-spec-binding-ownership-repair`
HEAD: `931128b384c3055ecef876124f787e5b8e67651b` (local G1/G1R work uncommitted)
Working contract SHA: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`
PR #6: OPEN, tip `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e`, unmodified

Custody remains **WORKING_CONTRACT_BOUND**.

## K2 TYPES

SemanticSnapshot: `spe_runtime/proof/snapshot.py`
ProofObligation: `spe_runtime/proof/obligation.py`
ProofLedger: `spe_runtime/proof/ledger.py`
SemanticLease: `SemanticProofLease` in `spe_runtime/proof/lease.py` (named to avoid G3 confusion)
ProofCarryingPatch: `spe_runtime/proof/patch.py`
VerificationReceipt: `spe_runtime/proof/receipt.py` (minted only by `verify_obligation`)
CommitResult: `spe_runtime/proof/commit.py`

## PROOF TYPE SYSTEM

STRUCTURAL_CONFORMANCE, DETERMINISTIC_INVARIANT, EXECUTION_RECEIPT, EMPIRICAL_EVIDENCE, MODEL_JUDGMENT, HUMAN_JUDGMENT, EXTERNAL_WORLD_OBSERVATION

PASS != universal truth
MODEL_JUDGMENT != EXTERNAL_WORLD_OBSERVATION (exact-match only)
STRUCTURAL_CONFORMANCE != factual truth (no FACT_VERIFIED field)

## SNAPSHOT MODEL

Identity: `snap-` + sha256(canonical {version, parent, contract, created_from_patch_id})
Versioning: monotonic int, +1 per successful commit
Parent binding: `parent_snapshot_id`
Canonical hash: existing `canonical_dumps`

## PROOF OBLIGATION MODEL

Identity: `obl-` + canonical {type, required_proof_type, subject, scope}
Required type: explicit `ProofType`
Status: OPEN / DISCHARGED / FAILED (commit uses receipts, does not mutate historical obligations)
Subject binding: snapshot id / stated subject string

## PROOF LEDGER

Canonical writer: `spe_runtime/proof/ledger.py`
Append-only behavior: copy-on-write append; identical re-append idempotent; content mutation of an existing id rejected
Ledger digest: `led-` + hash of ordered canonical entries

## SEMANTIC LEASE

Canonical writer: `issue_semantic_lease` in `spe_runtime/proof/lease.py`
Snapshot binding: yes
Version binding: yes
Scope: allowed `DeltaAction` values
Obligations: frozen id tuple
Authority grant?: **NO**

Not a heartbeat, fencing token, worker lock, or AuthorityGrant.

## PROOF-CARRYING PATCH

Identity: `patch-` + canonical {base snapshot/version, lease, delta, obligations}
`verified=True` is ignored and excluded from identity
Delta applies only through `propose_requirement` / `confirm_requirement`

## VERIFICATION RECEIPT

Canonical writer: **1** — `verify_obligation`
Verifier binding: `verifier_id`
Proof type: declared by verifier, matched exactly at commit
Verdict: PASS / FAIL / UNKNOWN
Evidence digest: canonical hash of check output

## ATOMIC COMMIT

Success: next snapshot (version+1) + appended ledger + consumed lease together
Failure: `SpeTypedError`; caller snapshot and ledger objects unchanged (frozen / copy-on-write)

STATE_WITHOUT_PROOF possible? **NO**
PROOF_WITHOUT_STATE_COMMIT possible? **NO** for a successful transaction (receipts append only inside successful commit)
HALF_COMMIT possible? **NO** within the in-memory semantic model

## STALE PATCH TESTS

`test_patch_rejects_wrong_snapshot` PASS
`test_patch_rejects_stale_version` PASS
`test_receipt_rejects_wrong_patch` PASS
`test_receipt_rejects_wrong_snapshot` PASS
`test_lease_rejects_wrong_snapshot_and_version` PASS

## PROOF-TYPE LAUNDERING TESTS

MODEL_JUDGMENT cannot discharge EXTERNAL_WORLD_OBSERVATION: PASS
STRUCTURAL_CONFORMANCE PASS does not emit factual-truth fields: PASS
HUMAN_JUDGMENT is not observation: PASS
FAIL / UNKNOWN / missing / arbitrary dict / wrong type: PASS (rejected)

## K0/K1 REGRESSION

Explicit/inferred boundary: held (inferred patch vs explicit MUST → invariant FAIL, no commit)
Confirmation boundary: `propose` still cannot mint USER_CONFIRMED
Conflict preservation: post-commit INFERENCE_CONFLICT still CONFLICTED
Authority separation: lease/receipt/commit ≠ AuthorityGrant; C07 without grant remains BLOCKED

## WRITER AUDIT

Duplicate semantic writers: **0**
Authority canonical writers: **1**
Ambient authority paths: **0**
K5 error writers: **1** (`error_registry.py`)
Verification receipt writers: **1** (`verify.py`)
Proof ledger writers: **1** (`ledger.py`)

New K5 codes: `K2_STALE_PATCH`, `K2_INVALID_SEMANTIC_LEASE`, `K2_MISSING_PROOF_OBLIGATION`, `K2_PROOF_TYPE_MISMATCH`, `K2_VERIFICATION_FAILED`, `K2_ATOMIC_COMMIT_REJECTED`

Zero `uuid` / `random` / `time.time` / `datetime.now` in `spe_runtime/proof/`.

## RING-0 GAP MOVEMENT

Before: unowned **6** / missing **16** / implemented **15** / partial **19**
After: unowned **4** / missing **9** / implemented **22** / partial **19**

K2 gaps closed (MISSING→IMPLEMENTED): SemanticSnapshot, proof obligations, Proof Ledger, Semantic Lease, proof-carrying patch, verification receipt, atomic semantic/proof commit.

`proof_receipt` unowned → K2 owned (`verify.py`). `semantic_snapshot` unowned → K2 owned.

Still unowned: privacy_projection, spe_artifact_identity, prompt_artifact, qualification_evidence.

Still MISSING: K3 cognitive plan / prompt strategy / technique selection / PromptArtifact; K4 privacy projection; K6 .spe artifact / snapshot binding; K7 claim qualification / qualification evidence.

## TESTS

Original baseline: 413 / 413 PASS
G1: 14 collected, 11 passed, 3 failed
G1R-1: 5 / 5 PASS
G1R-2: 23 / 23 PASS
G1R-3: 37 / 37 PASS
G1R-4: 31 / 31 PASS
Final: collected **523**, passed **520**, failed **3**, skipped **0**

Remaining expected failures (G1-B03 K3/K4/K6/K7 only):

- `test_g1_no_unowned_required_ring0_responsibility`
- `test_g1_artifact_lineage_owner_unique`
- `test_g1_qualification_owner_unique`

`test_g1_proof_owner_unique` now PASSES.

RUST_WASM_NOT_REBUILT — NO SHARED ABI CHANGE. Additive K5 codes only; portable envelope untouched.

## PRODUCTION FILES CHANGED

- `spe_runtime/error_registry.py`
- `spe_runtime/proof/__init__.py` (reactivated)
- `spe_runtime/proof/types.py`
- `spe_runtime/proof/snapshot.py`
- `spe_runtime/proof/obligation.py`
- `spe_runtime/proof/ledger.py`
- `spe_runtime/proof/lease.py`
- `spe_runtime/proof/patch.py`
- `spe_runtime/proof/receipt.py`
- `spe_runtime/proof/verify.py`
- `spe_runtime/proof/commit.py`
- `tests/unit/test_g1r4_k2_proof_transaction.py`

## PROOF FILES

- `proofs/g1r4/head_before.txt`
- `proofs/g1r4/git_status_before.txt`
- `proofs/g1r4/git_status_after.txt`
- `proofs/g1r4/working_contract_integrity.json`
- `proofs/g1r4/k2_existing_surface.json`
- `proofs/g1r4/semantic_writer_map.json`
- `proofs/g1r4/red/r1_semanticsnapshot.txt` … `r7_commit_semantic_patch.txt`
- `proofs/g1r4/green/atomic_commit.txt`

## BLOCKER STATUS

G1-B01: WORKING_CONTRACT_BOUND
G1-B02: RESOLVED
G1-B03: **OPEN** (reduced: unowned 6→4, MISSING 16→9). Not resolved.
G1-B04: RESOLVED
G1-B05: STILL OPEN

## K2 VS G3 BOUNDARY

Semantic atomicity: **IMPLEMENTED** (in-process copy-on-write)
Durable atomicity: **NOT IMPLEMENTED**
Distributed leases: **NOT IMPLEMENTED**
Fencing: **NOT IMPLEMENTED**
Heartbeat: **NOT IMPLEMENTED**
Crash recovery: **NOT IMPLEMENTED**
SENT_UNKNOWN: **NOT IMPLEMENTED**

No SQLite, Postgres, journal, heartbeat, fencing_token, or worker reclaim.

## IMPLEMENTATION BINDING STATUS

**BOUND_WITH_GAPS**

Do not claim G1_PASS.

## NEXT TASK

If G1R4_PASS: **G1R-5 — K3 Cognitive Plan + PromptArtifact minimum foundation**

DO NOT execute it.

## CLAIM BOUNDARY

G0: PASS
G1: BOUND_WITH_GAPS
G1R-1: COMPLETE
G1R-2: PASS
G1R-3: PASS
G1R-4: **PASS**
Full Ring-0: NOT IMPLEMENTED
Durable Ring-1: NOT IMPLEMENTED
Production: NOT QUALIFIED
World #1: NOT PROVEN

## STOP

STOP AFTER G1R-4.

NO G1R-5. NO G2. NO G3. NO PR #6 MERGE. NO SPRINT 7. NO `spe_runtime/omega/`.
