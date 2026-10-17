"""Unit tests for Formal Equivalence Verifier in SPE Ω Supercompiler."""

import pytest
from spe_runtime.supercompiler import (
    FROZEN_GROUND_TRUTH_CORPUS,
    CompilerPass,
    CorpusTask,
    EquivalenceProofCertificate,
    ExecutionHarness,
    FormalEquivalenceVerifier,
    HarnessSuperoptimizer,
    InstructionClause,
)


def test_frozen_corpus_integrity():
    assert len(FROZEN_GROUND_TRUTH_CORPUS) >= 5
    for task in FROZEN_GROUND_TRUTH_CORPUS:
        assert task.task_id.startswith("corpus_")
        assert len(task.expected_invariants) >= 2
        assert len(task.adversarial_probes) >= 2
        assert "hard_constraints" in task.intent_spec
        assert "tools" in task.intent_spec


def test_baseline_equivalence_against_itself():
    verifier = FormalEquivalenceVerifier()
    baseline = HarnessSuperoptimizer()

    cert: EquivalenceProofCertificate = verifier.verify(
        baseline_pipeline=baseline,
        candidate_pipeline=baseline,
        benchmark_rounds=1,
    )

    assert cert.is_verified is True
    assert cert.drift_detected is False
    assert cert.corpus_case_count == len(FROZEN_GROUND_TRUTH_CORPUS)
    assert cert.verified_case_count == len(FROZEN_GROUND_TRUTH_CORPUS)
    assert len(cert.failed_cases) == 0
    assert cert.speedup_ratio >= 0.5
    assert cert.divergence_witness is None
    assert len(cert.signature) == 64
    assert "∀x ∈ FrozenCorpus" in cert.theorem


def test_detects_semantic_drift_when_mandatory_clause_dropped():
    verifier = FormalEquivalenceVerifier()
    baseline = HarnessSuperoptimizer()

    class FaultyPassDroppingMandatory:
        def optimize(self, harness, adversarial_suite, cegis_engine=None):
            bad_harness = ExecutionHarness(
                harness_id=harness.harness_id,
                clauses=[],  # Violates invariant: dropped all clauses!
                tools=harness.tools,
                model_target=harness.model_target,
                validators=harness.validators,
            )
            return bad_harness

    cert = verifier.verify(
        baseline_pipeline=baseline,
        candidate_pipeline=FaultyPassDroppingMandatory(),
        benchmark_rounds=1,
    )

    assert cert.is_verified is False
    assert cert.drift_detected is True
    assert cert.verified_case_count < len(FROZEN_GROUND_TRUTH_CORPUS)
    assert len(cert.failed_cases) > 0
    assert cert.divergence_witness is not None
    assert "Missing mandatory non-removable clauses" in cert.divergence_witness


def test_detects_regression_on_counterexample_invariants():
    verifier = FormalEquivalenceVerifier()
    baseline = HarnessSuperoptimizer()

    class FaultyPassDroppingGuards:
        def optimize(self, harness, adversarial_suite, cegis_engine=None):
            import copy
            h = copy.deepcopy(harness)
            for c in h.clauses:
                c.tags.clear()
            h.validators = []
            return h

    cert = verifier.verify(
        baseline_pipeline=baseline,
        candidate_pipeline=FaultyPassDroppingGuards(),
        benchmark_rounds=1,
    )

    assert cert.is_verified is False
    assert cert.drift_detected is True
    assert len(cert.failed_cases) > 0


def test_detects_tool_contract_degradation():
    verifier = FormalEquivalenceVerifier()
    baseline = HarnessSuperoptimizer()

    class FaultyPassDroppingTools:
        def optimize(self, harness, adversarial_suite, cegis_engine=None):
            import copy
            h = copy.deepcopy(harness)
            h.tools = []
            return h

    cert = verifier.verify(
        baseline_pipeline=baseline,
        candidate_pipeline=FaultyPassDroppingTools(),
        benchmark_rounds=1,
    )

    assert cert.is_verified is False
    assert cert.drift_detected is True
    assert any("Candidate dropped tool contract" in str(fc.get("error")) for fc in cert.failed_cases)


def test_whitespace_normalization_preserves_equivalence():
    verifier = FormalEquivalenceVerifier()
    baseline = HarnessSuperoptimizer()

    # Pass that normalizes whitespace on clauses
    class WhitespaceNormalizingPass:
        def optimize(self, harness, adversarial_suite, cegis_engine=None):
            import copy
            h = copy.deepcopy(harness)
            h.clauses = [
                InstructionClause(
                    clause_id=c.clause_id,
                    text=" ".join(c.text.split()),
                    intent_source=c.intent_source,
                    tags=list(c.tags),
                    is_removable=c.is_removable,
                )
                for c in h.clauses
            ]
            return h

    cert = verifier.verify(
        baseline_pipeline=baseline,
        candidate_pipeline=WhitespaceNormalizingPass(),
        benchmark_rounds=1,
    )

    assert cert.is_verified is True
    assert cert.drift_detected is False
