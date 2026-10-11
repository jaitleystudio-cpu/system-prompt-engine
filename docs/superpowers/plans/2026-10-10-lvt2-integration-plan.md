# LVT-2 Evidence Integrity Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing SPE Learning-Validity Transactions implementation to a scientifically defensible, fail-closed versioned qualification protocol.

**Architecture:** Reuse the existing LVT owner in `spe_runtime/research/lvt/`. Integrate paired family-level data and explicit provenance into a versioned research gate while preventing aggregate-only V1 results from minting qualification. Do not create another proof/authority engine.

**Tech Stack:** Python 3.11+, stdlib, pytest, existing SPE Ed25519 receipt owner for *future* externally verified custody only; no new network dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-lvt2-evidence-integrity-design.md` (include that file in the source review).

## Global Constraints
- Preserve SPE privacy-first/offline/no-telemetry requirements.
- Do not mutate `main` or frozen contracts; work on a research branch and PR.
- `UNKNOWN` cannot become `QUALIFIED` without independently reproducible scores and audited source custody.
- Do not migrate old mock-aggregate tests by rebranding their scores as external evidence.
- Full-source and fresh-machine verification required before release qualification.

## Review Focus
- Unannounced protocol version change silently breaks existing callers.
- Repeated siblings bias scores and sign-test independence.
- Self-declared source content hashes can misrepresent genuine dataset provenance.
- Human rating leakage through prompt optimization cycles invalidates heldout status.
- Signing a self-reported receipt is not independent model verification.

### Task 1: Reproduce legacy fail-open scenarios
**Files:** `tests/research/lvt/test_four_arm_experiment.py`, `test_lvt_contract.py`.
- [ ] Freeze exact candidate SHA; preserve baseline files and test logs.
- [ ] Add red tests for one-item false significance, A_train/D_holdout mismatch, and duplicate train/test ID and family leakage.
- [ ] Run targeted tests and record expected red with exact failure messages.
- [ ] Commit only failing tests to isolated research branch (owner review).

### Task 2: Add the versioned paired statistical protocol
**Files:** Create `spe_runtime/research/lvt/paired_gate_v2.py`; `tests/research/lvt/test_paired_gate_v2.py`.
- [ ] Copy/adapt standalone `lvt2_gate.py` and its 30 acceptance tests into existing package import layout.
- [ ] RED: remove implementation and confirm tests fail for missing behavior; GREEN: all new tests pass.
- [ ] Validate paired heldout scores, family macro effects, exact sign-tail p, minimum families, Bonferroni multiple-primary alpha.
- [ ] Test 4 mutation variants and SciPy calculation cross-check (SciPy only dev dependency for benchmark validation).
- [ ] Commit and independently review interface boundaries.

### Task 3: Prevent v1 aggregate-only qualification
**Files:** `spe_runtime/research/lvt/learning_validator.py`, `types.py`, existing LVT contract/transfer tests.
- [ ] RED: prove v1 aggregate-only results no longer mint a production `QUALIFIED` receipt.
- [ ] Add a version/custody gate that defaults to `RESEARCH_UNQUALIFIED` for v1 and for non-attested v2.
- [ ] Relabel existing mock success fixtures as tests for internal serialization only; do not silently preserve unconditional acceptance.
- [ ] Test cross-model transfer cannot inherit a v1 mock's unearned qualification.
- [ ] Run LVT-specific and all project tests. Record any unrelated failures without omission.

### Task 4: Independent source and evaluator custody
**Files:** LVT provenance record and existing external verification/receipt adapter, without minting new authority.
- [ ] Define signed evaluator operating identity, registry of accepted oracle digests and source tree SHA.
- [ ] Validate frozen sampling manifests and near-duplicate checks; store privacy-preserving task IDs only.
- [ ] Require independent verifier attestation before production outcome; verify against heldout source under separate access policy.
- [ ] Execute fresh-machine and cross-model human task evaluation; register multiple hypotheses before results seen.

### Task 5: Release and competition readiness
**Files:** `docs/release` or existing release owner.
- [ ] Run `python -m pytest tests -q`, CI egress audit, production build, authority/security tests, and source hash manifest.
- [ ] Run blinded SPE-vs-DSPy/GEPA/Promptfoo/Braintrust comparisons on common end-to-end user tasks, cost and latency included.
- [ ] Require independent replication and publish wins *and losses*.
- [ ] Keep release qualification and "No. 1" status `UNESTABLISHED` until externally measured evidence meets registered criteria.

## Exact completion gate
No `QUALIFIED` in production from a legacy fabricated four-arm aggregate; all required suites green, provenance independently verified, item/family privacy preserved, and human/third-party blind evaluation completed. The enclosed laboratory tests only Task 2 on a standalone snapshot and does not complete Tasks 1/3/4/5.
