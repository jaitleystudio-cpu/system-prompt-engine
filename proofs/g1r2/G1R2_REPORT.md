# SPE Ω v2.4.1 — G1R-2 AUTHORITY HARDENING REPORT

## FINAL VERDICT

G1R2_PASS

G1 remains **BOUND_WITH_GAPS**. G1-B03 and G1-B05 are still open. Do not start G1R-3 or G2.

## SOURCE IDENTITY

Base: `931128b384c3055ecef876124f787e5b8e67651b`
Branch: `feat/g1r1-spec-binding-ownership-repair`
HEAD: `931128b384c3055ecef876124f787e5b8e67651b` (local uncommitted G1/G1R-1/G1R-2 work)
Working contract SHA: `68bac38afe3f38e85da38a359ed482ace07166fbf64c2d89dca3e499e41424f3`
PR #6: OPEN, tip `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e`, unmodified
merge-base(HEAD, 4e6c694) = `931128b`

Custody remains **WORKING_CONTRACT_BOUND**. Not relabeled CANONICAL_SPEC_BOUND. 181/69 still UNAVAILABLE.

## DEFECT A1 — GENERIC AUTHORITY MUTATION

Before: `replace_envelope(..., authority_state=GRANTED/level=9)` succeeded (RED).
After: raises `SpeTypedError(ErrorCode.GENERIC_AUTHORITY_MUTATION)` (`K4_GENERIC_AUTHORITY_MUTATION`).
Files: `spe_runtime/categories/_common.py`
Tests: `test_replace_envelope_rejects_authority_state_injection` and related kwargs tests
Typed error: one new K5 code only, `GENERIC_AUTHORITY_MUTATION`

Also rejected via generic replacement: `authority_event`, `grant`, `permission`, `consent`, `execution_grants`.

Non-authority fields (e.g. `category_trace`) still replace.

## DEFECT A2 — X09 AMBIENT AUTHORITY

Before: `if authority_event is not None: return True` — `object()`, `{}`, `"yes"`, dicts all authorized escalation (RED).
After: shortcut deleted. Escalation requires a validated `AuthorityEvent`.
AuthorityEvent type: frozen dataclass `kind, subject, target, scope, max_level, revocation_state`
Allowed kind: `EXTERNAL_GRANT` only. No epoch field invented.
Validation fields: kind allowlist, non-empty subject, subject match when expected, target==envelope_id, ACTIVE revocation, required scope ⊆ event.scope, required/proposed level ≤ max_level, proposed grants ⊆ current∪scope.
Tests: parametrized nontyped events; wrong kind/subject/target/scope; revoked; malformed negative level.

X09 is a thin caller of `validate_authority_event`. Not a minter.

## CONFUSED-DEPUTY PROOF

Test: `test_x09_rejects_confused_deputy_authority_object`
Old behavior: any truthy object authorized X09
New behavior: `object()` DENY; only typed event with matching target/scope/level succeeds
Result: PASS

## AUTHORITY WRITER AUDIT

Canonical writer count: **1**
Writer: `spe_runtime/authority/apply.py` (`apply_authority_event`)
Readers: X09 / category validators / `_common` (copy-through only)
Ambient authority paths: **0**

Envelope constructor still materializes initial `AuthorityState` for tests/import. That is not a generic mutator and is not G1-B04.

AuthorityGrant constructor mint-gap is unchanged (historical G1 note, not this defect).

## ERROR OWNER AUDIT

Canonical error owner: `spe_runtime/error_registry.py`
Duplicate error writers: **0**
`ReasonCode is PortabilityReason is ErrorCode`

## TESTS

Baseline: 413 / 413 PASS (no new regressions)
G1: 14 collected, 10 passed, 4 failed (G1-B03 only)
G1R-1: 5 / 5 PASS
G1R-2: 23 / 23 PASS
Final total: collected **455**, passed **451**, failed **4**, skipped **0**

Expected remaining failures are G1-B03 only:

- `test_g1_no_unowned_required_ring0_responsibility`
- `test_g1_proof_owner_unique`
- `test_g1_artifact_lineage_owner_unique`
- `test_g1_qualification_owner_unique`

Rust/WASM: Python-only. Shared ABI wire strings unchanged except one additive K5 code unused by the replica. Replica sources not touched; not rebuilt.

## PRODUCTION FILES CHANGED

- `spe_runtime/error_registry.py` — `GENERIC_AUTHORITY_MUTATION` + `SpeTypedError`
- `spe_runtime/categories/_common.py` — reject authority-controlled kwargs
- `spe_runtime/xcat/invariants.py` — X09 fail-closed via K4 validator
- `spe_runtime/authority/__init__.py` — export event/apply/validate
- `spe_runtime/authority/event.py` — **new**
- `spe_runtime/authority/event_validate.py` — **new**
- `spe_runtime/authority/apply.py` — **new**

Tests: `tests/unit/test_g1r2_authority_hardening.py` (new);
`tests/unit/test_xcat_core.py` (typed event for legitimate escalation);
`tests/unit/test_c07_authority.py` (attack envelope no longer uses replace_envelope for execution_grants).

## PROOF FILES

- `proofs/g1r2/head_before.txt`
- `proofs/g1r2/git_status_before.txt`
- `proofs/g1r2/git_status_after.txt`
- `proofs/g1r2/authority_files_before.sha256`
- `proofs/g1r2/authority_path_inventory.json`
- `proofs/g1r2/authority_writer_map.json`
- `proofs/g1r2/working_contract_integrity.json`
- `proofs/g1r2/red/a1_replace_envelope_writes_authority.txt`
- `proofs/g1r2/red/a2_x09_truthy_event_authorizes.txt`
- `proofs/g1r2/green/a1_replace_envelope_rejects_authority.txt`
- `proofs/g1r2/green/a2_x09_fail_closed.txt`

## BLOCKER STATUS

G1-B01: WORKING_CONTRACT_BOUND (181/69 UNAVAILABLE; not claimed recovered)
G1-B02: RESOLVED
G1-B03: STILL OPEN — 7 unowned facts / 22 missing Ring-0 requirements
G1-B04: **RESOLVED** — ambient paths 2 → 0
G1-B05: STILL OPEN — platform registry PLANNED for RUST/WASM

## IMPLEMENTATION BINDING STATUS

**BOUND_WITH_GAPS**

Do not claim G1_PASS.

Module inventory: 60 (was 57). RETAIN 36 / WRAP 10 / MIGRATE 0 / REPLACE 0 / RETIRE 14.
`categories/_common.py`: MIGRATE → WRAP.

## NEXT TASK

If G1R2_PASS: **G1R-3 / K0-K1 minimum semantic foundation**

DO NOT execute it.

## CLAIM BOUNDARY

G0: PASS (portable subset)
G1: BOUND_WITH_GAPS
G1R-1: COMPLETE
G1R-2: **PASS**
Full Ring-0: NOT IMPLEMENTED
Production: NOT QUALIFIED
World #1: NOT PROVEN

## STOP

STOP AFTER G1R-2.

NO G2. NO G3. NO missing-22 feature build. NO PR #6 merge. NO Sprint 7.
