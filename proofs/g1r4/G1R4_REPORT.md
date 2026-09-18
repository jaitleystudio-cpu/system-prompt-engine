# SPE Ω v2.4.1 — G1R-4 / G1R-4A K2 PROOF TRANSACTION REPORT

## FINAL VERDICT

**G1R4_IMPLEMENTATION_PRESENT** — K2 minimum foundation present.

**G1R4_REVIEW**: repaired for proof-integrity (G1R-4A); awaiting external re-review for PASS.

G1 remains **BOUND_WITH_GAPS**. G1R-5 / G2 / G3 were not started.

## SOURCE IDENTITY

| Field | Value |
|---|---|
| Base | `931128b384c3055ecef876124f787e5b8e67651b` |
| Branch | `cursor/g1r4a-proof-integrity-0d6e` |
| Working contract SHA | `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3` |
| PR #6 | OPEN, tip `4e6c694`, unmodified |
| Custody | WORKING_CONTRACT_BOUND |

Authoritative HEAD / tree / test denominators: `proofs/g1r4/AUTHORITATIVE_TEST_MANIFEST.json` (regenerated each evidence commit).

## G1R-4A PROOF-INTEGRITY REPAIR

| Control | Status |
|---|---|
| `receipt_id` recomputed at commit | YES — `assert_receipt_integrity` |
| Process-local `issuance_digest` | YES — secret not source-static |
| Sole mint path | `verify_obligation` → `_mint_canonical_receipt` (private) |
| Direct `VerificationReceipt(...)` PASS | REJECTED at commit |
| Tampered receipt_id / evidence / issuance | REJECTED |
| Mutation oracle (gate removal) | DETECTED — forged PASS would commit without gate |

## K2 TYPES

| Type | Location |
|---|---|
| SemanticSnapshot | `spe_runtime/proof/snapshot.py` |
| ProofObligation | `spe_runtime/proof/obligation.py` |
| ProofLedger | `spe_runtime/proof/ledger.py` |
| SemanticProofLease | `spe_runtime/proof/lease.py` (not a G3 worker lease) |
| ProofCarryingPatch | `spe_runtime/proof/patch.py` |
| VerificationReceipt | minted only by `verify_obligation` |
| CommitResult | `spe_runtime/proof/commit.py` |

## PROOF TYPE SYSTEM

STRUCTURAL_CONFORMANCE · DETERMINISTIC_INVARIANT · EXECUTION_RECEIPT · EMPIRICAL_EVIDENCE · MODEL_JUDGMENT · HUMAN_JUDGMENT · EXTERNAL_WORLD_OBSERVATION

- PASS ≠ universal truth
- MODEL_JUDGMENT ≠ EXTERNAL_WORLD_OBSERVATION (exact-match only)
- STRUCTURAL_CONFORMANCE ≠ factual truth (no FACT_VERIFIED field)

## ATOMIC COMMIT (IN-PROCESS ONLY)

Success: next snapshot (version+1) + appended ledger + consumed lease together.

Failure: `SpeTypedError`; caller snapshot/ledger unchanged (frozen / copy-on-write).

**Claims:**

- Semantic in-process atomicity: implemented
- Durable atomicity / distributed leases / fencing / heartbeat / crash recovery / SENT_UNKNOWN: **NOT IMPLEMENTED** (G3)

## AUTHORITY / AMBIENT RECONCILIATION

`HIDDEN_AMBIENT_AUTHORITY_PATHS = 0` counts **hidden privilege elevation** without a typed `AuthorityGrant` / `AuthorityEvent` (closed in G1R-2).

Public `AuthorityGrant` dataclass construction is the **intentional external injection surface** (C07 never mints grants). It is **not** an ambient authority path under that definition.

## OWNERSHIP (HEAD)

UNOWNED_RING0_RESPONSIBILITIES = **4**:

- privacy_projection
- spe_artifact_identity
- prompt_artifact
- qualification_evidence

`protected_intent_contract` owned by K0 via `spe_runtime/contract/protected.py`.

## AUTHORITATIVE TEST DENOMINATORS

Single source of truth: `proofs/g1r4/AUTHORITATIVE_TEST_MANIFEST.json`.

Python suite excludes WASM/Rust/Sprint5 cross-language env suites (toolchain absent in agent VM — not G1R-4A regressions).

| Suite | Collected | Passed | Failed |
|---|---:|---:|---:|
| G1R-1 | 5 | 5 | 0 |
| G1R-2 | 27 | 27 | 0 |
| G1R-3 | 37 | 37 | 0 |
| G1R-4 (+4A) | 41 | 41 | 0 |
| G1 binding | 14 | 11 | 3 (expected G1-B03) |
| Authoritative Python | 414 | 411 | 3 |

Expected failures (honest BOUND_WITH_GAPS):

- `test_g1_no_unowned_required_ring0_responsibility`
- `test_g1_artifact_lineage_owner_unique`
- `test_g1_qualification_owner_unique`

## BOUNDARY

| Gate | State |
|---|---|
| G0 | PASS |
| G1 | BOUND_WITH_GAPS |
| G1R-1 | COMPLETE |
| G1R-2 | PASS |
| G1R-3 | PASS |
| G1R-4 implementation | PRESENT |
| G1R-4 review | PENDING_RECHECK (integrity repaired) |
| G1R-5 | NOT STARTED |
| G2 | NOT STARTED |
| G3 | NOT STARTED |
| Full Ring-0 | NOT IMPLEMENTED |
| Production | NOT QUALIFIED |
| World #1 | NOT PROVEN |

## NOT STARTED

G1R-5, G2, G3, PR #6 merge, Sprint 7, `spe_runtime/omega/`.
