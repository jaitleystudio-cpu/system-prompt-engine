# SPE Ω v2.4.1 — G1R-4 / G1R-4A K2 PROOF TRANSACTION REPORT

## FINAL VERDICT

**G1R4_IMPLEMENTATION_PRESENT** — K2 minimum foundation present.

**G1R4A repairs** — forged-receipt issuance + **exact patch binding** repaired.

**G1R4_REVIEW** — awaiting external re-review for PASS (do not self-promote).

G1 remains **BOUND_WITH_GAPS**. G1R-5 / G2 / G3 were not started.

## SOURCE IDENTITY (non-self-referential)

| Field | Value |
|---|---|
| Base | `931128b384c3055ecef876124f787e5b8e67651b` |
| Branch | `cursor/g1r4a-proof-integrity-0d6e` |
| implementation_commit | `6b404e040e9fc8640439cbadda9b57505e6cbdcb` |
| suite_run_commit | `6b404e040e9fc8640439cbadda9b57505e6cbdcb` |
| suite_tree | `2ea3d91b49258e093edae0aac7ffa248c32d8517` |
| Working contract SHA | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |
| PR #6 | OPEN, tip `4e6c694`, unmodified |
| Custody | WORKING_CONTRACT_BOUND |
| reviewed_pr_head | **external only** (not embedded as self-tip) |

Authoritative denominators + content hash: `proofs/g1r4/AUTHORITATIVE_TEST_MANIFEST.json`.

Evidence docs may land in later commits; they do **not** rewrite `implementation_commit` / `suite_run_commit`.

## G1R-4A REPAIRS

| Control | Status |
|---|---|
| `receipt_id` recomputed at commit | YES |
| Process-local `issuance_digest` | YES (ordinary public-API forge resistance) |
| Sole mint path | `verify_obligation` → `_mint_canonical_receipt` |
| Direct forged PASS | REJECTED |
| **Exact** `receipt.patch_id == patch.patch_id` | YES |
| `patch_id=None` for mutation commit | REJECTED |
| Patch A receipt replayed on Patch B | REJECTED |
| Mutation oracle (integrity + patch binding) | DETECTED |

## TRUST MODEL (explicit)

- In-process verifier callables are **trusted K2 code**.
- Canonical issuance ≠ independently attested verifier honesty.
- Issuance secret: ordinary public-API forge resistance only — **not** hostile same-process Python isolation.

## K2 TYPES

SemanticSnapshot · ProofObligation · ProofLedger · SemanticProofLease · ProofCarryingPatch · VerificationReceipt · CommitResult

## PROOF TYPE SYSTEM

STRUCTURAL_CONFORMANCE · DETERMINISTIC_INVARIANT · EXECUTION_RECEIPT · EMPIRICAL_EVIDENCE · MODEL_JUDGMENT · HUMAN_JUDGMENT · EXTERNAL_WORLD_OBSERVATION

PASS ≠ universal truth · MODEL_JUDGMENT ≠ EXTERNAL_WORLD_OBSERVATION · STRUCTURAL_CONFORMANCE ≠ factual truth

## ATOMIC COMMIT

In-process COW semantic atomicity only. Durable / distributed / fencing / heartbeat / crash recovery / SENT_UNKNOWN: **NOT IMPLEMENTED**.

## OWNERSHIP

UNOWNED = **4**: privacy_projection, spe_artifact_identity, prompt_artifact, qualification_evidence

## AUTHORITATIVE TEST DENOMINATORS

| Suite | Collected | Passed | Failed |
|---|---:|---:|---:|
| G1R-1 | 5 | 5 | 0 |
| G1R-2 | 27 | 27 | 0 |
| G1R-3 | 37 | 37 | 0 |
| G1R-4 (+4A) | **44** | **44** | 0 |
| G1 binding | 14 | 11 | 3 (expected) |
| Authoritative Python | **417** | **414** | **3** |

## BOUNDARY

| Gate | State |
|---|---|
| G0 | PASS |
| G1 | BOUND_WITH_GAPS |
| G1R-1 | COMPLETE |
| G1R-2 | PASS |
| G1R-3 | PASS |
| G1R-4 implementation | PRESENT |
| G1R-4 review | PENDING_RECHECK |
| G1R-5 / G2 / G3 | NOT STARTED |

## NOT STARTED

G1R-5, G2, G3, PR #6 merge, Sprint 7, `spe_runtime/omega/`.
