"""
Tests for 8-Technique Evaluator and EGAC-E01 Controlled Experiment.
"""

import json
import pytest
from spe_runtime.research.egac.types import (
    TechniqueType,
    ConservationStatus,
)
from spe_runtime.research.egac.technique_evaluator import TechniqueEvaluator

def test_technique_evaluator_all_eight_techniques():
    evaluator = TechniqueEvaluator()
    base_text = "Here is sample text with data: {\"key\": \"value\"}."

    for tech in TechniqueType:
        cand = evaluator.apply_technique(tech, base_text)
        assert cand.technique == tech
        assert cand.candidate_id.startswith("cand-")

def test_token_budget_2048_rejected_on_long_form_manuscripts():
    evaluator = TechniqueEvaluator()
    manuscript_prompt = "Write a complete 100,000-word comprehensive manuscript on general relativity."

    cand = evaluator.apply_technique(
        TechniqueType.OUTPUT_TOKEN_BUDGET_2048,
        manuscript_prompt,
        is_long_form=True,
    )

    assert cand.status == ConservationStatus.VIOLATED
    assert "REJECTED" in cand.rejection_reason

def test_concise_directive_rejected_on_scientific_proofs():
    evaluator = TechniqueEvaluator()
    proof_prompt = "Provide a detailed scientific proof for Godel's incompleteness theorem."

    cand = evaluator.apply_technique(
        TechniqueType.CONCISE_OUTPUT_INSTRUCTION,
        proof_prompt,
    )

    assert cand.status == ConservationStatus.VIOLATED
    assert "REJECTED" in cand.rejection_reason

def test_json_minification_preserves_large_integers_and_unicode():
    evaluator = TechniqueEvaluator()
    raw = '{"large_id": 9007199254740993, "symbol": "\\u03a9", "text": "value with spaces"}'
    cand = evaluator.apply_technique(TechniqueType.JSON_MINIFICATION, raw)

    assert cand.status == ConservationStatus.CONSERVED
    # Verify JSON structure remains identical when parsed
    parsed_orig = json.loads(raw)
    parsed_trans = json.loads(cand.transformed_content)
    assert parsed_orig == parsed_trans
    assert parsed_trans["large_id"] == 9007199254740993

def test_json_minification_preserves_duplicate_keys_without_collapsing():
    evaluator = TechniqueEvaluator()
    raw = '{\n  "key": "initial_value",\n  "key": "overridden_value",\n  "version": 42\n}'
    cand = evaluator.apply_technique(TechniqueType.JSON_MINIFICATION, raw)

    assert cand.status == ConservationStatus.CONSERVED
    # Must preserve both keys in minified string
    assert cand.transformed_content == '{"key":"initial_value","key":"overridden_value","version":42}'
    # Parse with object_pairs_hook=list to confirm both pairs survived in exact sequence
    pairs = json.loads(cand.transformed_content, object_pairs_hook=list)
    assert pairs == [("key", "initial_value"), ("key", "overridden_value"), ("version", 42)]

def test_json_minification_multiple_blocks_in_prose_preserves_intervening_text():
    evaluator = TechniqueEvaluator()
    prompt = 'Header prose: {"first": 1} and intervening notes: {"second": [10, 20]} trailing signature.'
    cand = evaluator.apply_technique(TechniqueType.JSON_MINIFICATION, prompt)

    assert cand.status == ConservationStatus.CONSERVED
    assert cand.transformed_content == 'Header prose: {"first":1} and intervening notes: {"second":[10,20]} trailing signature.'

def test_egac_e01_controlled_experiment_execution():
    evaluator = TechniqueEvaluator()
    result = evaluator.run_egac_e01_experiment()

    assert result.experiment_name == "SPE-PRO-EGAC-E01-JSON"
    assert result.n_trials == 120, "Must execute full 120-workload evaluation battery"
    assert len(result.category_stats) == 8, "Must track all 8 canonical JSON categories"
    for cat_name, stats in result.category_stats.items():
        assert stats["trials"] == 15, f"Category {cat_name} must have exactly 15 trials"
        assert stats["token_reduction_pct"] > 0.0
        assert stats["parse_equality_rate"] == 1.0
        assert stats["canary_failures"] == 0

    assert result.token_reduction_pct > 0.0
    assert result.net_savings_nanos > 0
    assert result.json_parse_equality_rate >= 0.99
    assert result.canary_failures == 0
    assert result.passed_promotion_gate is True

