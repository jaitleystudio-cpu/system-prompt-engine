"""RED/GREEN tests for outcome evaluators and bounded prompt optimization (Task 8)."""

from __future__ import annotations

from typing import Any, Mapping

import pytest

from spe_runtime.protocols.evaluators import (
    EvaluatorResult,
    EvaluatorStatus,
    evaluate_result,
    list_evaluator_domains,
)
from spe_runtime.protocols.optimize import (
    OptimizationResult,
    PromptCandidate,
    optimize_prompt,
)
from spe_runtime.protocols.quality_record import QualityRecord


# ---------------------------------------------------------------------------
# Helpers used by the plan's required optimizer-protection tests
# ---------------------------------------------------------------------------


def candidate_with_intent(intent: str) -> PromptCandidate:
    return PromptCandidate(
        protected_intent=intent,
        hard_constraints=("keep-safety",),
        source_facts=("fact-1",),
        evidence_confidence=0.9,
        authority="NONE",
        safety_policy="default",
        execution_wording="Do the task carefully.",
        explanatory_order=("intro", "body"),
        optional_examples=("ex-a",),
        formatting="markdown",
    )


def candidate() -> PromptCandidate:
    return candidate_with_intent("baseline-intent")


def evaluator_that_requests_intent_change():
    """Evaluator that scores poorly and proposes mutating ProtectedIntent."""

    def _eval(cand: PromptCandidate) -> Mapping[str, Any]:
        return {
            "score": 0.1,
            "proposed_changes": {
                "protected_intent": "MUTATED-INTENT",
                "execution_wording": "rewritten wording",
            },
        }

    return _eval


def constant_score_evaluator(score: float):
    """Evaluator that always returns the same score and an allowed mutation."""

    def _eval(cand: PromptCandidate) -> Mapping[str, Any]:
        return {
            "score": score,
            "proposed_changes": {
                "execution_wording": f"{cand.execution_wording} [tweak]",
                "formatting": "plain",
            },
        }

    return _eval


# ---------------------------------------------------------------------------
# Required plan tests
# ---------------------------------------------------------------------------


def test_optimizer_cannot_mutate_protected_intent():
    result = optimize_prompt(
        candidate_with_intent("A"),
        evaluator_that_requests_intent_change(),
        max_iterations=2,
    )
    assert result.final_candidate.protected_intent == "A"
    assert result.stop_reason == "PROTECTED_FIELD_MUTATION_REJECTED"


def test_optimizer_stops_on_no_improvement():
    result = optimize_prompt(candidate(), constant_score_evaluator(0.5), max_iterations=5)
    assert result.iterations <= 2
    assert result.stop_reason == "NO_MEASURABLE_IMPROVEMENT"


# ---------------------------------------------------------------------------
# Evaluator registry + quality record invariants
# ---------------------------------------------------------------------------


REQUIRED_EVALUATOR_DOMAINS = (
    "research",
    "coding",
    "data_statistics",
    "business_strategy",
    "ux_ui_web_design",
    "shopping",
)


def test_evaluator_registry_covers_required_category_fixtures():
    domains = set(list_evaluator_domains())
    missing = [d for d in REQUIRED_EVALUATOR_DOMAINS if d not in domains]
    assert missing == [], f"missing evaluator domains: {missing}"


def test_evaluate_result_statuses_and_no_authority_minting():
    results = evaluate_result(
        "protocol.research",
        {
            "citation_support": True,
            "evidence_coverage": False,
            "contradiction_search": "UNKNOWN",
            "source_quality": "NOT_APPLICABLE",
        },
    )
    assert results
    assert all(isinstance(r, EvaluatorResult) for r in results)
    by_id = {r.criterion_id: r for r in results}
    assert by_id["citation_support"].status == EvaluatorStatus.PASS
    assert by_id["evidence_coverage"].status == EvaluatorStatus.FAIL
    assert by_id["contradiction_search"].status == EvaluatorStatus.UNKNOWN
    assert by_id["source_quality"].status == EvaluatorStatus.NOT_APPLICABLE
    # Remaining registered criteria without evidence stay UNKNOWN.
    assert by_id["unsupported_claims"].status == EvaluatorStatus.UNKNOWN


def test_quality_record_serializes_as_quality_record_never_receipt():
    record = QualityRecord(
        protocol_id="protocol.research.standard",
        protocol_version="1",
        depth="STANDARD",
        required_nodes=("N1",),
        completed_nodes=("N1",),
        skipped_nodes=(),
        failed_nodes=(),
        unknown_nodes=(),
        context_capsule_ids=("c1",),
        evaluator_results=(
            EvaluatorResult(
                criterion_id="citation_support",
                status=EvaluatorStatus.PASS,
                evidence_ref="ev-1",
                measurement=1.0,
                message="ok",
            ),
        ),
        unverified_claims=(),
        known_limitations=("limited corpus",),
        freshness_state="FRESH",
        adapter_id="ANY_AI",
        prompt_digest="abc123",
    )
    payload = record.to_dict()
    assert "receipt" not in payload
    assert "receipts" not in payload
    envelope = record.to_xcat_field()
    assert set(envelope.keys()) == {"quality_record"}
    assert "receipt" not in envelope
    assert envelope["quality_record"]["protocol_id"] == "protocol.research.standard"
    assert envelope["quality_record"]["evaluator_results"][0]["status"] == "PASS"


def test_optimizer_allows_execution_wording_mutation_when_score_improves():
    scores = {"n": 0}

    def improving_evaluator(cand: PromptCandidate) -> Mapping[str, Any]:
        # First call = baseline; after allowed wording change, score rises.
        scores["n"] += 1
        if "improved" in cand.execution_wording:
            return {"score": 0.9, "proposed_changes": {}}
        return {
            "score": 0.4,
            "proposed_changes": {"execution_wording": "improved wording"},
        }

    result = optimize_prompt(candidate(), improving_evaluator, max_iterations=3)
    assert isinstance(result, OptimizationResult)
    assert result.final_candidate.protected_intent == "baseline-intent"
    assert "improved" in result.final_candidate.execution_wording
    assert result.stop_reason in {
        "SUCCESS_THRESHOLD_MET",
        "NO_MEASURABLE_IMPROVEMENT",
        "MAX_ITERATIONS",
    }
    assert result.final_candidate.hard_constraints == ("keep-safety",)


def test_optimizer_rejects_hard_constraint_and_source_fact_mutation():
    def bad_evaluator(cand: PromptCandidate) -> Mapping[str, Any]:
        return {
            "score": 0.2,
            "proposed_changes": {"hard_constraints": ("removed",), "source_facts": ()},
        }

    result = optimize_prompt(candidate(), bad_evaluator, max_iterations=2)
    assert result.final_candidate.hard_constraints == ("keep-safety",)
    assert result.final_candidate.source_facts == ("fact-1",)
    assert result.stop_reason == "PROTECTED_FIELD_MUTATION_REJECTED"
