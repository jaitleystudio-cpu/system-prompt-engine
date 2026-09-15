# SPE Sprint 5 Portable Kernel + WASM Conformance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-cost Rust portable semantic kernel plus a WASM build that conforms to the frozen `spe.universal-abi.v1` corpus and produces no protected-semantic drift relative to the qualified Python reference implementation.

**Architecture:** Python remains the semantic oracle for Sprint 5. Rust implements only the deterministic portable subset: ABI transport, protected-semantic comparison, capability validation, cross-category handoff validation needed by the existing conformance corpus, and authority/privacy/proof/operation-ID preservation. The same Rust crate is compiled to native and `wasm32-unknown-unknown`; no website, PWA, mobile shell, desktop shell, extension, MCP server, or model/provider integration is in Sprint 5.

**Tech Stack:** Existing Python + pytest reference/oracle, Rust stable toolchain, Cargo, `serde`, `serde_json`, `wasm32-unknown-unknown`, local subprocess conformance harness. No paid APIs, hosting, SDKs, or services.

**Spec:** `docs/superpowers/specs/2026-09-15-sprint5-portable-kernel-wasm-design.md`

## Global Constraints

- `spe.universal-abi.v1` is the only Sprint-5 ABI.
- Python remains the semantic oracle for Sprint 5.
- Rust and WASM must not mint, broaden, revive, or infer authority.
- Protected semantics must preserve: goal, facts, provenance, hard constraints, preferences, uncertainty, recommendation, recommendation status/conditionality, authority, target/arguments, operation identity, failures, outcome/proof state, taint, sensitivity/privacy.
- `ABSENT != NULL != UNKNOWN` wherever the ABI distinguishes them.
- `UNKNOWN != PASS`, `PARTIAL != SUCCESS`, and tool success does not imply `VERIFIED_SUCCESS`.
- Focused Sprint-5 conformance requires no network.
- No website, PWA, Android, iOS, desktop shell, extension, MCP, plugin, skill, provider integration, billing, ads, or deployment is added in Sprint 5.
- `NEW_IMPLEMENTATION` remains explicit.
- `not_a_release=true`.
- Additional owner spend required by Sprint 5 is ₹0.
- Historical RED/GREEN/merge-gate evidence is immutable. New runs get new proof files.
- Never use `git add .` or `git add -A`; stage explicit paths only.
- If PR #4 HEAD differs from reviewed tip `66c98b5`, stop before merge.

---

## File Structure

Create or modify only after inspecting the current repository and reusing equivalent existing paths if present:

```text
portable/
  spe-core-rs/
    Cargo.toml
    src/
      lib.rs
      abi.rs
      value.rs
      protected.rs
      capabilities.rs
      reasons.rs
      semantic.rs
      conformance.rs
    tests/
      abi_transport.rs
      semantic_equivalence.rs
      negative_mutations.rs
      capability_contract.rs
  spe-wasm/
    Cargo.toml
    src/
      lib.rs

tests/
  portability/
    test_rust_reference_conformance.py
    test_wasm_reference_conformance.py
    test_cross_language_negative_mutations.py
    test_cross_language_determinism.py

tools/
  sprint5_conformance.py

proofs/generated/
  post_merge_pr4_main_pytest.txt
  sprint5_portable_kernel_RED.txt
  sprint5_portable_kernel_GREEN.txt
  sprint5_cross_language_conformance.json
  sprint5_proof_summary.json
```

If the repository already contains equivalent portability files, extend them rather than creating duplicates.

---

### Task 1: Merge PR #4 and Establish the Sprint-5 Baseline

**Files:**
- Create: `proofs/generated/post_merge_pr4_main_pytest.txt`
- Create: `docs/superpowers/specs/2026-09-15-sprint5-portable-kernel-wasm-design.md`
- Create: `docs/superpowers/plans/2026-09-15-sprint5-portable-kernel-wasm.md`

**Interfaces:**
- Consumes: reviewed PR #4 tip `66c98b5`
- Produces: qualified `main` SHA and branch `feat/portable-kernel-wasm-s5`

- [ ] Verify PR #4 HEAD before merge:

```bash
git fetch origin
git rev-parse origin/feat/universal-portability-conformance-s4
```

If HEAD is not the reviewed commit beginning `66c98b5`, stop with `PR_HEAD_CHANGED`.

- [ ] Merge PR #4 with a normal merge commit. Do not squash or rebase-merge.

- [ ] Qualify merged `main`:

```bash
git checkout main
git pull --ff-only origin main
python -m pytest -q | tee proofs/generated/post_merge_pr4_main_pytest.txt
```

Expected minimum: `212 passed`, 0 failures/errors, exit 0. If not, preserve proof and stop.

- [ ] Create Sprint-5 branch from qualified `main`:

```bash
git checkout -b feat/portable-kernel-wasm-s5
git status --short
```

Expected clean status.

- [ ] Save the approved design and this plan at the paths above and commit them explicitly.

---

### Task 2: Preserve a Meaningful RED for Cross-Language Conformance

**Files:**
- Create: `tools/sprint5_conformance.py`
- Create: `tests/portability/test_rust_reference_conformance.py`
- Create: `proofs/generated/sprint5_portable_kernel_RED.txt`

**Interfaces:**
- Consumes: current `spe.universal-abi.v1` positive/negative fixture corpus
- Produces: `load_reference_cases(kind)`, `run_python_reference_case(case)`, `run_rust_case(case)`, `compare_protected(a, b)`

- [ ] Add a positive test that loads a real positive fixture and calls `run_rust_case`.

```python
def test_rust_runner_is_required_for_positive_cases():
    from tools.sprint5_conformance import load_reference_cases, run_rust_case
    cases = load_reference_cases(kind="positive")
    assert cases
    result = run_rust_case(cases[0])
    assert result["status"] == "VALID"
```

- [ ] Add a negative test requiring exact detector attribution.

```python
def test_rust_runner_reports_exact_negative_reason():
    from tools.sprint5_conformance import load_reference_cases, run_rust_case
    case = load_reference_cases(kind="negative")[0]
    result = run_rust_case(case)
    assert result["disposition"] == case["expected"]["disposition"]
    assert result["reason_code"] == case["expected"]["reason_code"]
```

- [ ] Implement fixture loading only; leave Rust execution deliberately unavailable:

```python
def run_rust_case(case):
    raise RuntimeError("RUST_KERNEL_NOT_IMPLEMENTED")
```

- [ ] Run and preserve RED:

```bash
python -m pytest tests/portability/test_rust_reference_conformance.py -q   | tee proofs/generated/sprint5_portable_kernel_RED.txt
```

Expected: tests fail because Rust is not implemented, not because fixture data is malformed.

- [ ] Commit the RED harness and proof.

---

### Task 3: Create the Minimal Rust Portable Core

**Files:**
- Create: `portable/spe-core-rs/Cargo.toml`
- Create: `portable/spe-core-rs/src/lib.rs`
- Create: `portable/spe-core-rs/src/reasons.rs`
- Create: `portable/spe-core-rs/src/value.rs`
- Test: `portable/spe-core-rs/tests/abi_transport.rs`

**Interfaces:**
- Consumes: UTF-8 JSON ABI fixture
- Produces: deterministic `ConformanceResult`

Use:

```rust
pub struct ConformanceResult {
    pub disposition: String,
    pub reason_code: Option<String>,
    pub output: serde_json::Value,
}
```

- [ ] Create the crate with only:

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

- [ ] Write RED for malformed root input:

```rust
#[test]
fn rejects_non_object_fixture_root() {
    let input = serde_json::json!(["not", "an", "object"]);
    let err = spe_core_rs::evaluate_fixture(&input).unwrap_err();
    assert_eq!(err.code(), "PORTABILITY_INVALID_FIXTURE");
}
```

- [ ] Run RED:

```bash
cargo test --manifest-path portable/spe-core-rs/Cargo.toml
```

- [ ] Implement only the result/error shell and deterministic JSON input validation.

- [ ] Run all crate tests and commit.

---

### Task 4: Implement ABI v1 Transport Semantics

**Files:**
- Create: `portable/spe-core-rs/src/abi.rs`
- Modify: `portable/spe-core-rs/src/lib.rs`
- Test: `portable/spe-core-rs/tests/abi_transport.rs`

**Interfaces:**
- Consumes: `spe.universal-abi.v1` JSON
- Produces: validated ABI value or exact portability refusal

- [ ] RED: unknown ABI major returns `PORTABILITY_ABI_UNSUPPORTED`.
- [ ] RED: semantic `UNKNOWN` remains distinct from absent and explicit null.
- [ ] RED: reject NaN/Infinity/nonportable numeric representation.
- [ ] RED: preserve multilingual UTF-8 test strings from the existing fixture corpus.
- [ ] RED: reject ambiguous/local-time-only authority timestamps where the current ABI requires timezone-aware values.
- [ ] Implement only the rules already frozen by Sprint 4.
- [ ] Run Rust tests and commit.

---

### Task 5: Implement Protected-Semantic Equivalence

**Files:**
- Create: `portable/spe-core-rs/src/protected.rs`
- Create: `portable/spe-core-rs/src/semantic.rs`
- Test: `portable/spe-core-rs/tests/semantic_equivalence.rs`

**Interfaces:**
- Consumes: two ABI values
- Produces: `SemanticComparison { equivalent, drift }`

- [ ] RED cases must mark non-equivalent:

```text
UNKNOWN vs PASS
FAIL vs PASS
DENIED vs GRANTED
conditional vs unconditional recommendation
different provenance origin
different hard constraint
different recommended option
different sensitivity/privacy
different taint
different operation_id
different authority target
different authority argument bounds
```

- [ ] Positive controls must accept map-key order changes and other ABI-approved incidental representation differences.
- [ ] Implement an explicit protected-field manifest matching Sprint 4; do not infer protection dynamically from fixtures.
- [ ] Run tests and commit.

---

### Task 6: Implement Capability Contract

**Files:**
- Create: `portable/spe-core-rs/src/capabilities.rs`
- Test: `portable/spe-core-rs/tests/capability_contract.rs`

**Interfaces:**
- Consumes: declared capabilities + fixture-required capabilities
- Produces: valid or `PORTABILITY_REQUIRED_CAPABILITY_MISSING`

- [ ] RED: `CORE_CONTRACT` runtime cannot run `LOCAL_EXECUTION` fixture.
- [ ] RED: runtime cannot infer `AUTHORITY_VALIDATION` from OS/language/library.
- [ ] Implement strict capability containment.
- [ ] Add positive controls for exactly satisfied capability sets.
- [ ] Run tests and commit.

---

### Task 7: Cross-Language Negative Mutation Detection

**Files:**
- Create: `portable/spe-core-rs/tests/negative_mutations.rs`
- Create: `tests/portability/test_cross_language_negative_mutations.py`
- Modify: `tools/sprint5_conformance.py`

**Interfaces:**
- Consumes: frozen negative/mutation fixtures
- Produces: exact same disposition/reason as frozen expectation

- [ ] Parameterize all negative fixtures.
- [ ] Ensure coverage includes: constraint loss, provenance loss, uncertainty drift, preference drift, private→public, taint removal, C06 recommendation, C01 authority creation, C03 recommendation drift, C07 missing authority, target drift, argument expansion, expired/revoked/consumed grant, UNKNOWN→PASS, PARTIAL→SUCCESS, tool-success→VERIFIED_SUCCESS, operation-ID replacement.
- [ ] Run RED and preserve failures.
- [ ] Implement only semantics required by frozen ABI fixtures.
- [ ] Require exact detector == expected detector.
- [ ] Run Rust + Python focused suites and commit.

---

### Task 8: Full Python ↔ Rust Positive Corpus

**Files:**
- Modify: `tests/portability/test_rust_reference_conformance.py`
- Modify: `tools/sprint5_conformance.py`

**Interfaces:**
- Consumes: all positive fixtures
- Produces: Python/Rust semantic equivalence for every protected field

Use:

```python
def test_all_positive_cases_are_semantically_equivalent():
    from tools.sprint5_conformance import (
        load_reference_cases,
        run_python_reference_case,
        run_rust_case,
        compare_protected,
    )
    for case in load_reference_cases(kind="positive"):
        py_result = run_python_reference_case(case)
        rs_result = run_rust_case(case)
        assert compare_protected(py_result, rs_result), case["fixture_id"]
```

- [ ] Run with `-x` to locate first drift.
- [ ] Repair Rust forward; do not weaken Python fixtures.
- [ ] Run the entire positive corpus.
- [ ] Require zero semantic drift.
- [ ] Commit.

---

### Task 9: Add WASM as a Thin Wrapper Over the Same Rust Core

**Files:**
- Create: `portable/spe-wasm/Cargo.toml`
- Create: `portable/spe-wasm/src/lib.rs`
- Create: `tests/portability/test_wasm_reference_conformance.py`

**Interfaces:**
- Consumes: `spe-core-rs`
- Produces: WASM-buildable JSON-in/JSON-out wrapper

- [ ] `spe-wasm` must depend on `spe-core-rs` by path and contain no duplicate semantic validator.
- [ ] Add build RED.
- [ ] If absent, add toolchain target:

```bash
rustup target add wasm32-unknown-unknown
```

- [ ] Build:

```bash
cargo build --manifest-path portable/spe-wasm/Cargo.toml   --target wasm32-unknown-unknown --release
```

- [ ] Test representative positive and negative wrapper conversions against the shared core.
- [ ] Commit.

---

### Task 10: Cross-Process and Repeated-Round-Trip Determinism

**Files:**
- Create: `tests/portability/test_cross_language_determinism.py`
- Modify: `tools/sprint5_conformance.py`

**Interfaces:**
- Consumes: representative frozen fixtures
- Produces: stable canonical output and protected semantics

- [ ] Run the Rust evaluator from multiple fresh processes for the same fixture and compare canonical outputs.
- [ ] Run representative fixtures through 10 Python→Rust→Python transport cycles.
- [ ] Require zero drift in provenance, authority, privacy, uncertainty, recommendation conditionality, operation ID, and outcome/proof state.
- [ ] Add explicit mutation controls for those fields.
- [ ] Run tests and commit.

---

### Task 11: Produce Sprint-5 Proof Artifacts

**Files:**
- Create: `proofs/generated/sprint5_portable_kernel_GREEN.txt`
- Create: `proofs/generated/sprint5_cross_language_conformance.json`
- Create: `proofs/generated/sprint5_proof_summary.json`

**Interfaces:**
- Consumes: actual native Rust, WASM-build, and Python conformance results
- Produces: local bounded proof only

- [ ] Run all Rust tests:

```bash
cargo test --manifest-path portable/spe-core-rs/Cargo.toml
```

- [ ] Build WASM and record artifact hash.
- [ ] Run focused Python portability tests:

```bash
python -m pytest tests/portability -q   | tee proofs/generated/sprint5_portable_kernel_GREEN.txt
```

- [ ] Machine-readable conformance summary must include: ABI, fixture counts, positive passes, negative exact-reason passes, mutation escapes, drift counts, Rust version, target, environment.
- [ ] Bounded proof summary must say:

```json
{
  "status": "VERIFIED_LOCAL_PORTABLE_SUBSET",
  "new_implementation": true,
  "not_a_release": true,
  "network_required": false,
  "paid_api_required": false,
  "new_hosting_required": false,
  "additional_owner_cost_inr": 0
}
```

- [ ] Do not claim RELEASED or world leadership from this proof.
- [ ] Commit explicit proof paths.

---

### Task 12: Full Regression, Scope Audit, and PR

**Files:**
- No scope expansion; modify only files required by repair-forward failures.

**Interfaces:**
- Consumes: full Sprint-5 branch
- Produces: PR ready for merge-gate review, not merged

- [ ] Run Sprint-4 focused regression.
- [ ] Run Sprint-3 focused regression.
- [ ] Run XCAT core regression.
- [ ] Run Sprint-2 integration regression.
- [ ] Run full repo:

```bash
python -m pytest -q
```

Expected denominator: >=212. Required: 0 failed/errors/critical skips/deselections, exit 0.

- [ ] Audit dependencies:

```bash
cargo tree --manifest-path portable/spe-core-rs/Cargo.toml
cargo tree --manifest-path portable/spe-wasm/Cargo.toml
```

List all new runtime dependencies and licenses. No paid dependency/service.

- [ ] Scope audit:

```bash
git diff main...HEAD --name-only
git diff main...HEAD --stat
```

Sprint 5 must not contain website/PWA/mobile/desktop/extension/MCP/provider/billing/ads/deployment work.

- [ ] Required final metrics:

```text
semantic drift = 0
constraint drift = 0
provenance drift = 0
uncertainty drift = 0
authority drift = 0
privacy/taint drift = 0
operation-ID drift = 0
UNKNOWN→PASS escapes = 0
mutation escapes = 0
network required = NO
paid API = NO
new hosting = NO
additional owner spend = ₹0
NEW_IMPLEMENTATION = true
not_a_release = true
```

- [ ] Open PR titled:

```text
Sprint 5: portable Rust kernel + WASM conformance
```

Do not merge.

- [ ] Final report:

```text
# SPE SPRINT 5 — PORTABLE KERNEL + WASM REPORT

Source main SHA:
Branch:
Tip SHA:
PR:

ABI:
Python oracle fixtures:
Rust fixtures:
WASM fixtures:

Positive:
Negative:
Mutations:
Semantic drift:
Constraint drift:
Provenance drift:
Uncertainty drift:
Authority drift:
Privacy/taint drift:
Operation-ID drift:
UNKNOWN→PASS escapes:

Rust tests:
WASM build:
Sprint5 focused:
Sprint4 regression:
Sprint3 regression:
XCAT:
Sprint2:
Full repo:

collected:
passed:
failed:
errors:
skipped:
deselected:
exit:

Rust dependencies:
Licenses:
Network required:
Paid dependencies:
Paid API:
New hosting:
Additional owner cost:

NEW_IMPLEMENTATION:
not_a_release:

RED evidence:
GREEN evidence:
Cross-language conformance:
Proof summary:

Defects found/repaired:

Decision:
READY FOR MERGE-GATE REVIEW
or
NOT READY

STOP.
Do not merge.
Do not start web/PWA/mobile/desktop/extensions/MCP.
```
