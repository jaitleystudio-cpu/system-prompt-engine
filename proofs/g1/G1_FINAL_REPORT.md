# SPE Ω v2.4.1 — G1 RUNTIME BINDING REPORT

## FINAL VERDICT

G1_BOUND_WITH_GAPS

This is a successful audit result. It does not authorize G2, Sprint 7, omega kernel
creation, language migration, or any merge.

## REPOSITORY IDENTITY

Base: `931128b384c3055ecef876124f787e5b8e67651b`
Branch: `feat/g1-runtime-binding-v241`
HEAD: `931128b384c3055ecef876124f787e5b8e67651b`
Tree hash: `efa9026169deee29f529cbab5c3bb73f59808c36`
Dirty before: false
Dirty after: true (audit/proof artifacts + G1 tests only)

Worktree: `/opt/spe-g1-runtime-binding-v241` (isolated from `main` and from PR #6)
Python used for tests: CPython 3.11.2 (`/opt/spe-g1-venv`)
Lineage on this SHA: `NEW_IMPLEMENTATION` (explicitly not the verified 181/69 tree)

## PR #6 STATUS

PR #6: OPEN (not merged)
Tip: `4e6c694b5d8b9379c5acfbaac416dcfa89b1768e`
Modified by G1: false
Merged: false
Non-interference proof: `proofs/g1/pr6_noninterference.json`

- G1 ancestry is `931128b` (parent `605e336`, the PR #5 merge).
- `git merge-base HEAD origin/feat/web-pwa-foundation-s6` = `931128b`
- `git rev-list --count 931128b..HEAD` = 0
- No PR #6 commit cherry-picked; no `apps/web/` or `tests/web/` imported.

## FRESH TEST BASELINE

Do not treat historical 443/443 as this run.

### Test denominator (443 vs 413)

HISTORICAL_BRANCH_TEST_COUNT = 443
G1_MAIN_TEST_COUNT = 413
DELTA = -30

Classification: **PR #6-only web/PWA tests. Not a main regression.**

Evidence:

- `origin/feat/web-pwa-foundation-s6:proofs/generated/sprint6_proof_summary.json`
  records `full_pytest: "443 passed"` and `web_pytest: "30 passed"`.
- `git diff 931128b origin/feat/web-pwa-foundation-s6 -- tests` adds exactly
  eight `tests/web/` files. Five of them contain **30** `def test_*` functions.
- Main test files are unchanged versus PR #6 (no tests exist only on main).
- Fresh collect on `main@931128b`: **413 tests collected**.
- Historical post-merge PR #5 proof (`proofs/generated/post_merge_pr5_main_pytest.txt`)
  already recorded **413 passed** on this SHA family. The 443 figure is Sprint-6
  branch evidence, not main.

Exact PR #6-only test files:

- `tests/web/test_web_architecture_gates.py`
- `tests/web/test_web_cost_and_scope.py`
- `tests/web/test_web_engine_path.py`
- `tests/web/test_web_privacy_pwa.py`
- `tests/web/test_web_pwa_scaffold.py`

(plus `tests/web/__init__.py`, `conftest.py`, `paths.py` — no additional test defs)

### Python

BASELINE (untouched `931128b`, before G1 tests):

- collected: 413
- passed: 413
- failed: 0
- skipped: 0
- exit: 0
- duration_ms: 52784
- interpreter: CPython 3.11.2
- pytest: 9.1.1

G1 BINDING TESTS (`tests/unit/test_g1_runtime_binding.py`):

- collected: 14
- passed: 7
- failed: 7
- skipped: 0

FINAL TOTAL (baseline + G1 tests):

- collected: 427
- passed: 420
- failed: 7
- skipped: 0
- exit: 1

All 7 failures are G1 gap tests (spec unbound, duplicate writers, missing Ring-0
owners). They are not baseline regressions. Formula: 413 + 14 = 427 collected;
413 + 7 G1-pass = 420 passed.

### Rust

- tests: 27
- passed: 27
- failed: 0
- exit: 0
- breakdown: abi_transport 8, capability_contract 4, negative_mutations 2,
  semantic_equivalence 13
- command: `cargo test --manifest-path portable/spe-core-rs/Cargo.toml --locked`

### WASM

- scope: `portable/spe-wasm` crate tests + `wasm32-unknown-unknown` release build
  + Node WebAssembly host on POS-001
- crate tests: 2 passed
- build exit: 0
- node host exit: 0 (`tools/spe_wasm_node_host.js`, 0 imports, POS-001 → VALID)
- this-run artifact: sha256 `74ae835e150dc3e4b7ab80d30f50a504f363589e7886181ef047a5321ccf4983`, 254917 bytes
- historical Sprint-5 artifact: sha256 prefix `74a12864…`, 252714 bytes
- result: OK_TOOLCHAIN_DIVERGENT_ARTIFACT (rustc 1.98.1 vs historical 1.85.1;
  source tree is 931128b; not treated as a source regression)

### Other

- `python -m compileall spe_runtime`: exit 0
- lint: not configured
- type-check: not configured
- `tools/validate_repo.py`: stub; not a defined conformance command
- `spe_runtime/omega/`: absent (not created)

## MODULE INVENTORY

Total spe_runtime Python modules: **55**
discovered_module_count == inventory_entry_count == disposition_entry_count == 55

RETAIN: 31
WRAP: 7
MIGRATE: 3
REPLACE: 0
RETIRE: 14

Every module has exactly one disposition from {RETAIN, WRAP, MIGRATE, REPLACE, RETIRE}.

## OWNER COVERAGE

K0:
modules:
- `spe_runtime/contract/__init__.py` (empty; RETIRE)

K1:
modules:
- `spe_runtime/xcat/{__init__,models,invariants,handoff}.py`
- `spe_runtime/categories/_common.py`
- `spe_runtime/categories/c02_research/*`
- `spe_runtime/categories/c06_analyze/*`
- `spe_runtime/provenance/__init__.py` (empty; RETIRE)

K2:
modules:
- `spe_runtime/execution/{__init__,models,outcomes}.py`
- `spe_runtime/proof/__init__.py` (empty; RETIRE)

K3:
modules:
- `spe_runtime/categories/c01_decide/*`
- `spe_runtime/categories/c03_communicate/*`

K4:
modules:
- `spe_runtime/authority/{__init__,models,validate,consume}.py`
- `spe_runtime/categories/c07_execute/*`
- `spe_runtime/privacy/__init__.py` (empty; RETIRE)

K5:
modules:
- `spe_runtime/portability/{__init__,abi,canonical,conformance,oracle,reasons}.py`
- `spe_runtime/xcat/{reasons,validator}.py`
- `spe_runtime/registry/__init__.py` (empty; RETIRE)

K6:
modules:
- `spe_runtime/adapters/{__init__,local_temp_file}.py`
- `spe_runtime/execution/effect_ledger.py`
- `spe_runtime/storage/__init__.py` (empty; RETIRE)

K7:
modules:
- `spe_runtime/portability/capability.py`
- `spe_runtime/capabilities/__init__.py` (empty; RETIRE)
- `spe_runtime/recovery/__init__.py` (empty; RETIRE)

null (no Ring-0 owner):
- `spe_runtime/__init__.py`
- `spe_runtime/categories/__init__.py`
- `spe_runtime/cli/__init__.py`

## SEMANTIC OWNERSHIP AUDIT

Duplicate canonical writers: **2**
- `failure_laundering_predicate`: `xcat/invariants.py` AND `categories/_common.py`
- `typed_error_code`: `xcat/reasons.py` AND `portability/reasons.py`

Unowned Ring-0 responsibilities (facts with no writer): **7**
- proof_receipt (K2)
- privacy_projection (K4)
- spe_artifact_identity (K6)
- prompt_artifact (K3)
- semantic_snapshot (K2)
- qualification_evidence (K7)
- protected_user_intent (K0) — listed as unowned writer; envelope only preserves goal/preferences

Unowned Ring-0 requirements with status MISSING: **22**
Conflicting semantics: **3** (2 duplicate writers + 1 CONFLICTING typed-error requirement)
Legacy semantics to retire: **14** (empty packages + unused category `models.py`)
Ambient authority paths: **2**
- A1 `replace_envelope(**changes)` can write `authority_state`
- A2 `validate_authority_non_escalation` returns True if `authority_event is not None` (any object)
Unresolved ownership cycles: **0**

Python is the portable semantic oracle. Rust/WASM are replicas (WRAP), not second
canonical Python writers. `portability/oracle.py` is an independent checker, not a
production writer.

Historical claim `VERIFIED_LOCAL_PORTABLE_SUBSET` is **not** upgraded to
`FULL_RING0_IMPLEMENTATION`.

## HIGHEST-RISK MODULES

1. path: `spe_runtime/xcat/invariants.py`
   risk: HIGH
   problem: X09 short-circuits if `authority_event is not None` — any object bypasses non-escalation.
   normative owner: K1 (guard) / K4 (authority fact)
   disposition: RETAIN (tested kernel; bypass is a documented gap, not a rewrite license)
   required action: Later typed authority-event; negative test. Not G1 production patch.

2. path: `spe_runtime/categories/_common.py`
   risk: HIGH
   problem: Generic `replace_envelope` is an ambient authority writer; `failures_not_laundered` duplicates X10.
   normative owner: K1
   disposition: MIGRATE
   required action: Stop accepting `authority_state` from non-K4; delete duplicate predicate.

3. path: `spe_runtime/proof/__init__.py`
   risk: HIGH
   problem: Empty. K2 proof ledger/receipt/snapshot/lease/patch all missing.
   normative owner: K2
   disposition: RETIRE (not implementation)
   required action: NEW_IMPLEMENTATION after G1. Do not create `spe_runtime/omega/` now.

4. path: `spe_runtime/privacy/__init__.py`
   risk: HIGH
   problem: Empty. No privacy projection. Labels are opaque strings on the envelope.
   normative owner: K4
   disposition: RETIRE
   required action: NEW_IMPLEMENTATION (projection, not just label superset checks).

5. path: `spe_runtime/xcat/reasons.py` + `spe_runtime/portability/reasons.py`
   risk: MEDIUM
   problem: Split typed-error vocabulary.
   normative owner: K5
   disposition: MIGRATE both
   required action: Single K5 registry; keep wire strings stable.

6. path: `spe_runtime/portability/conformance.py`
   risk: MEDIUM
   problem: `PLATFORM_REGISTRY` still marks `PLATFORM:RUST_KERNEL` and `PLATFORM:WASM` as PLANNED/NOT_RUN on this SHA even though `portable/spe-core-rs` and `portable/spe-wasm` exist.
   normative owner: K5/K7
   disposition: WRAP
   required action: Honest registry update later; never mark PASS.

7. path: `spe_runtime/authority/models.py`
   risk: MEDIUM
   problem: No mint gate; any in-process constructor can create a grant.
   normative owner: K4
   disposition: RETAIN (unique grant type; C07 never mints)
   required action: External mint boundary later.

## RING-0 IMPLEMENTATION GAPS

From `proofs/g1/ring0_gap_matrix.json` (spec → code):

IMPLEMENTED (7): uncertainty preservation; analysis vs recommendation ownership;
permission scope; canonical wire representation; guard predicates; grants (with mint-gap note);
recommendation ownership (Decide stage, not prompt kernel).

PARTIAL (20): protected intent / must-must-not / intent integrity; ambiguity; claims;
evidence relationships; operation identity + outcome transitions; capability routing;
revocation epoch; egress; capability≠authority; schema registry; validation; error
precedence; artifact identity (temp-file digest); lineage (category_trace);
import/export (ReferenceRuntime); capability qualification; lifecycle; promotion/revocation
(promotion forbidden — good; grant REVOKED only).

MISSING (22), future_action NEW_IMPLEMENTATION unless noted:
- K0: human sovereignty; explicit vs inferred; user-confirmed requirements; intent contract
- K1: requirement graph; conflict
- K2: SemanticSnapshot; proof obligations; Proof Ledger; Semantic Lease; proof-carrying patch;
  verification receipt; atomic semantic/proof commit
- K3: cognitive plan; prompt strategy; technique selection; PromptArtifact
- K4: privacy projection
- K5: real schema registry (9/11 schemas are STUBs with `additionalProperties: true`)
- K6: `.spe` semantic artifact; snapshot binding
- K7: claim qualification; qualification evidence

CONFLICTING (1): typed error vocabulary (two enums).

Empty packages named after missing owners are RETIRE, not IMPLEMENTED.

## IMPLEMENTATION BINDING

Spec hash: **unbound** (SPE Ω v2.4.1 bytes not in tree). Repo `SPE-SPEC` sha256
`e82d4ca87fa1327af5183d49ac16b5f4a4902139265808b4497e055e99435118`
Repo SHA: `931128b384c3055ecef876124f787e5b8e67651b`
Repo tree hash: `efa9026169deee29f529cbab5c3bb73f59808c36`
Source-manifest hash (git ls-files @931128b): `b2d00759d5741012b8cfadd2e1feb518e3802676dd3ace1f601105e3c6d8b13f`
Dependency-manifest hash: `7dafa827ad5e6c9e3d284727a8d58b9767dea1dde36483ef73fbf67b0bafa1aa`
Inventory hash: `ec7a1f8eada05f45f709d147af9e84d08661cebb05c62b8458ae5627809c6295`
Disposition hash: `980c24fde8fee78d0188fad6fa8838c2b1e234eb794ef43fff3523cf4bc569de`
Writer-map hash: `849d52ab0332c4188fa0eb325dd8e356f329267c4112d6800276424a8bde0b2b`
Ring-0 hash: `9e1ab0339fd2eb66bd0cc01971050fa4f03234f9671122b9aee6d349f924ecb2`
Test-result hash: `6d364bcc566024e3db14b4844215039ad2344af6373b8828f2d96681e29a16c8`
Python version: 3.11.2

Binding status: **BOUND_WITH_GAPS**
Manifest: `SPE_IMPLEMENTATION_BINDING_v2.json`

What this tree actually implements (current bytes, not historical slogans):

- XCAT CrossCategoryEnvelope + X01–X10 handoff (no PROMOTE/EXECUTED)
- Category engines C02→C06→C01→C03→C07 with field ownership
- AuthorityGrant compatibility + consume (C07 never mints)
- ExecutionIntent / OutcomeState (intent ≠ success; tool OK ≠ VERIFIED_SUCCESS)
- Local WRITE_LOCAL_TEMP_FILE adapter, sandbox-confined, network_used=False
- Universal ABI `spe.universal-abi.v1` + Python oracle + Rust/WASM replicas
- Status remains NEW_IMPLEMENTATION / not_a_release / VERIFIED_LOCAL_PORTABLE_SUBSET
  for the portable subset only

## FILES CHANGED

### AUDIT/PROOF ARTIFACTS

- `SPE_IMPLEMENTATION_BINDING_v2.json`
- `G1_FINAL_REPORT.md`
- `proofs/g1/base_head.txt`
- `proofs/g1/git_status_before.txt`
- `proofs/g1/git_status_after.txt`
- `proofs/g1/git_worktree.txt`
- `proofs/g1/git_log.txt`
- `proofs/g1/python_version.txt`
- `proofs/g1/environment.txt`
- `proofs/g1/source_files.sha256`
- `proofs/g1/runtime_files.sha256`
- `proofs/g1/test_files.sha256`
- `proofs/g1/test_files_after_g1.sha256`
- `proofs/g1/dependency_files.sha256`
- `proofs/g1/repo_identity.json`
- `proofs/g1/repository_inventory.json`
- `proofs/g1/runtime_module_inventory.json`
- `proofs/g1/module_disposition.json`
- `proofs/g1/semantic_writer_map.json`
- `proofs/g1/ring0_gap_matrix.json`
- `proofs/g1/test_commands.json`
- `proofs/g1/test_results.json`
- `proofs/g1/test_denominator.json`
- `proofs/g1/pr6_noninterference.json`
- `proofs/g1/SPE_IMPLEMENTATION_BINDING_v2.json`
- `proofs/g1/cmd_logs/*` (compileall, pytest collect/baseline/final, cargo, wasm node host)

### TEST-ONLY CHANGES

- `tests/unit/test_g1_runtime_binding.py` (14 mechanical binding tests)

### PRODUCTION SOURCE CHANGES

NONE

No `spe_runtime/` bytes were modified. No `spe_runtime/omega/` created.
No PR #6 files used.

## TESTS ADDED

File: `tests/unit/test_g1_runtime_binding.py`

Passed (manifest completeness):

- `test_g1_runtime_inventory_complete` — every `spe_runtime/**/*.py` is inventoried
- `test_g1_every_module_has_disposition` — 1:1 disposition
- `test_g1_disposition_enum_valid` — enum + unique path
- `test_g1_ring0_owner_mapping_complete` — K0–K7 all present in gap matrix
- `test_g1_binding_manifest_complete` — required binding fields
- `test_g1_repo_tree_hash_bound` — SHA/tree/source manifest bound
- `test_g1_authority_owner_unique` — grant_compatibility / uses_consumed unique

Failed (honest gaps; do not implement product semantics to green these):

- `test_g1_normative_spec_hash_bound` — Ω v2.4.1 sha256 unbound (G1-B01)
- `test_g1_no_duplicate_canonical_writers` — 2 duplicate writers (G1-B02)
- `test_g1_no_unowned_required_ring0_responsibility` — 7 facts / 22 MISSING (G1-B03)
- `test_g1_proof_owner_unique` — proof_receipt has no writer
- `test_g1_error_owner_unique` — split ReasonCode / PortabilityReason
- `test_g1_artifact_lineage_owner_unique` — no `.spe` writer
- `test_g1_qualification_owner_unique` — no qualification-evidence writer

## G1 BLOCKERS

ID: G1-B01
description: SPE Ω v2.4.1 normative specification bytes are not in this repository. README/SPE-SPEC declare NEW_IMPLEMENTATION, not the verified 181/69 tree. Spec hash cannot be bound to v2.4.1.
owner: K5/K0
evidence: SPE-SPEC, README.md; `test_g1_normative_spec_hash_bound` FAILED
required next action: Owner imports frozen v2.4.1 spec bytes, or formally rebaselines Ω onto this NEW_IMPLEMENTATION. Do not invent the spec in G1.

ID: G1-B02
description: Duplicate canonical writers = 2 (`failure_laundering_predicate`, `typed_error_code`).
owner: K1/K5
evidence: `proofs/g1/semantic_writer_map.json`; `test_g1_no_duplicate_canonical_writers` FAILED
required next action: MIGRATE `_common.failures_not_laundered` onto invariants; unify error enums under K5. Not a G1 production change.

ID: G1-B03
description: Unowned required Ring-0 facts = 7; MISSING ring0 requirements = 22.
owner: K0–K7
evidence: `proofs/g1/ring0_gap_matrix.json`; `test_g1_no_unowned_required_ring0_responsibility` FAILED
required next action: NEW_IMPLEMENTATION after G1 for missing K0/K2/K3/K6/K7 surfaces. Do not create `spe_runtime/omega/` in G1.

ID: G1-B04
description: Hidden ambient authority paths: `replace_envelope` can write `authority_state`; X09 bypass if `authority_event` is any non-None object.
owner: K4
evidence: `spe_runtime/categories/_common.py`; `spe_runtime/xcat/invariants.py` lines 115–117
required next action: Close bypass in a later gate with negative tests.

ID: G1-B05
description: PLATFORM_REGISTRY still marks RUST_KERNEL and WASM as PLANNED/NOT_RUN on main@931128b despite `portable/` existing.
owner: K7
evidence: `spe_runtime/portability/conformance.py` vs `portable/`
required next action: Honest registry update post-G1; do not mark PASS.

G1_PASS is blocked because duplicate writers ≠ 0, unowned Ring-0 ≠ 0, and
normative spec hash is unbound. Module inventory/disposition are 100%.

## RECOMMENDED G2 INPUT

Do NOT execute G2.

If G2 proceeds later, the TLA+/TLC model must include actual runtime
concurrency/state properties already visible here — not a greenfield kernel:

- Envelope immutability vs `replace_envelope` generic override
- X09 authority_event bypass (any object)
- Grant construction without a mint gate vs C07 consume
- OutcomeState transition table (UNKNOWN/PARTIAL cannot silently succeed)
- EffectLedger process-local at-most-once vs no durable artifact store
- Caller-supplied `now` on grant expiry (no system clock, but forgeable clock input)
- Python oracle vs Rust/WASM replica (single writer of semantic_equivalence_verdict)
- No Semantic Lease / fencing / journal exist — do not model them as implemented

## LANGUAGE MIGRATION DECISION

NO MIGRATION DECISION — NO PERFORMANCE EVIDENCE YET

Python p95 ≤ 75 ms is a measurement gate. No profiling was performed. Rust/WASM
already exist as a portable replica of the ABI subset; that is not a license to
replace the Python oracle.

## CLAIM BOUNDARY

G0 hermetic fixture conformance: inherited verified evidence on this SHA
(Sprint 4/5 portable subset; Python 413/413 baseline GREEN; Rust 27/27;
WASM Node host POS-001 VALID). Not re-certified as Ω v2.4.1 Ring-0.

G1 runtime binding: G1_BOUND_WITH_GAPS

Implementation complete: NO

Production qualified: NO

World #1: NOT PROVEN

VERIFIED_LOCAL_PORTABLE_SUBSET remains the highest honest portable claim.
FULL_RING0_IMPLEMENTATION is not earned.

## STOP

STOP AFTER G1.

DO NOT:

- merge
- start G2
- start G3
- start Sprint 7
- implement 3D
- create native clients
- rewrite kernel
- create `spe_runtime/omega/`
- push to main
- green G1 uniqueness tests by implementing missing product semantics
