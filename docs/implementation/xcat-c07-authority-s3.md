# XCAT Sprint 3 — CAT:C07 + Authority

Lineage: NEW_IMPLEMENTATION

## RED → GREEN
1. Wrote failing tests 1–14 + positives + vertical + attacks against non-enforcing stubs.
2. Captured RED: `proofs/generated/sprint3_c07_authority_RED.txt` (19 failed, 7 passed).
3. Implemented AuthorityGrant, ExecutionIntent, C07 engine, outcome transitions, local temp-file adapter.
4. Captured GREEN: `proofs/generated/sprint3_c07_authority_GREEN.txt` (26 passed).

## Hard law
recommendation SEND + C03 rendering + authority NONE (no grant) = C07 BLOCKED.
C07 never mints authority. recommendation ≠ authority ≠ execution ≠ VERIFIED_SUCCESS.

## Ownership
| Component | May | Must not |
|-----------|-----|----------|
| AuthorityGrant (external) | exist as immutable scoped grant | be created/expanded by C07 |
| CAT:C07 | form ExecutionIntent under compatible grant; append category_trace | mutate recommendation; weaken constraints; escalate AuthorityState; replace op-id on retry |
| Local adapter | WRITE_LOCAL_TEMP_FILE under tempfile with digest | network; claim VERIFIED_SUCCESS |

## Outcome states
NOT_EXECUTED → DISPATCHING → {OUTCOME_UNKNOWN, PARTIAL, COMPLETED, FAILED, RECONCILIATION_REQUIRED}
- UNKNOWN → FAILED blind retry blocked
- PARTIAL → COMPLETED blocked
- Tool OK ≠ VERIFIED_SUCCESS / COMPLETED without verified evidence
- UNKNOWN → RECONCILIATION_REQUIRED allowed
- NOT_EXECUTED retry eligible

## COST LAW
paid=NO, APIs=NO, hosting=NO, ₹0. pyproject remains jsonschema + pytest.

## Out of scope
Provider SDKs, email, payments, browser, cloud mutations, web UI, billing, model integration, Sprint 4.
