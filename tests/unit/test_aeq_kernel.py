"""
Unit and Adversarial Tests for Master Prompt 2:
Hostile Adversarial Evidence Qualification & Self-Healing Verifier Kernel (AEQ-H10).
"""

import pytest
from spe_runtime.aeq import (
    AEQKernel,
    HostileMutant,
    MutationOperatorType,
    MutationTestResult,
    OriginType,
    RetractionDAGPlan,
    TriOriginAttribution,
)


SAMPLE_CODE = """
def verify_transaction(amount: int, is_authenticated: bool) -> bool:
    if not is_authenticated:
        return False
    if amount <= 0:
        return False
    if amount > 5000:
        return False
    assert is_authenticated == True
    return True
"""


def test_smo1_conditional_negation_synthesis():
    """Operator SMO-1: Inverts comparisons and conditionals."""
    mutants = AEQKernel.synthesize_smo1_mutants(SAMPLE_CODE)
    assert len(mutants) >= 2
    for m in mutants:
        assert m.operator == MutationOperatorType.SMO_1_CONDITIONAL_NEGATION
        assert m.order_k == 1
        assert m.mutated_code != SAMPLE_CODE


def test_smo2_statement_deletion_synthesis():
    """Operator SMO-2: Deletes critical state updates and assertions without deleting def/class signatures."""
    mutants = AEQKernel.synthesize_smo2_mutants(SAMPLE_CODE)
    assert len(mutants) >= 1
    m = mutants[0]
    assert m.operator == MutationOperatorType.SMO_2_STATEMENT_DELETION
    assert "assert is_authenticated == True" not in m.mutated_code
    assert "pass  # SMO-2" in m.mutated_code

    # Function headers must never be deleted
    code_with_def = """
def check(val):
    if val < 0:
        return False
    return True
"""
    mutants_def = AEQKernel.synthesize_smo2_mutants(code_with_def)
    assert len(mutants_def) == 0  # No assertions or statements to delete; def check(val) must NOT be deleted


def test_smo3_return_value_perturbation_synthesis():
    """Operator SMO-3: Flips return booleans and exit codes."""
    mutants = AEQKernel.synthesize_smo3_mutants(SAMPLE_CODE)
    assert len(mutants) >= 1
    kinds = [m.diff_snippet for m in mutants]
    assert any("return True -> return False" in k or "return False -> return True" in k for k in kinds)


def test_higher_order_mutations_k3():
    """Law 2: Synthesizes high-order composite mutants (k >= 3 simultaneous subtle perturbations)."""
    hom_mutants = AEQKernel.synthesize_higher_order_mutants(SAMPLE_CODE, k=3)
    assert len(hom_mutants) >= 1
    m = hom_mutants[0]
    assert m.operator == MutationOperatorType.HIGHER_ORDER_K3
    assert m.order_k == 3
    # All 3 perturbations must be present in diff_snippet and mutated code
    diff_lines = [d.strip() for d in m.diff_snippet.splitlines() if d.strip()]
    assert len(diff_lines) == 3
    assert m.mutated_code != SAMPLE_CODE


def test_anti_lucky_pass_law_evaluation():
    """
    Law 1: Evaluates verifier adequacy.
    Requires MutationScore >= 0.95. If any mutant passes, flags LUCKY_PASS_VULNERABILITY.
    """
    mutants = AEQKernel.generate_full_hostile_battery(SAMPLE_CODE)

    # 1. Competent verifier that rejects all mutated code
    def competent_verifier(code: str) -> bool:
        # Rejects any code that alters the original invariants
        return code == SAMPLE_CODE

    res_good = AEQKernel.evaluate_verifier_adequacy(competent_verifier, mutants)
    assert isinstance(res_good, MutationTestResult)
    assert res_good.mutation_score == 1.0
    assert res_good.verdict == "VERIFIER_QUALIFIED"
    assert res_good.anti_lucky_pass_passed is True
    assert len(res_good.surviving_mutant_ids) == 0

    # 2. Naive verifier that blindly accepts all mutants (the Lucky Pass defect)
    def naive_verifier(code: str) -> bool:
        return True

    res_bad = AEQKernel.evaluate_verifier_adequacy(naive_verifier, mutants)
    assert res_bad.mutation_score == 0.0
    assert res_bad.verdict == "LUCKY_PASS_VULNERABILITY"
    assert res_bad.anti_lucky_pass_passed is False
    assert len(res_bad.surviving_mutant_ids) == len(mutants)


def test_tri_origin_discrimination():
    """Law 3: Tri-Origin Discrimination (RGIC-T1)."""
    # 1. Verifier inadequacy (mutant passes test) -> Origin V
    attr_v = AEQKernel.discriminate_tri_origin(
        test_passed_on_baseline=True,
        test_passed_on_mutant=True,
    )
    assert attr_v.origin == OriginType.VERIFIER
    assert attr_v.verdict_badge == "ORIGIN_V_DEFICIT"
    assert "Faulty Oracle" in attr_v.summary

    # 2. Ambiguous requirement -> Origin G
    attr_g = AEQKernel.discriminate_tri_origin(
        test_passed_on_baseline=False,
        test_passed_on_mutant=False,
        requirement_diverged=True,
    )
    assert attr_g.origin == OriginType.GOAL
    assert attr_g.verdict_badge == "ORIGIN_G_UNCERTAINTY"

    # 3. Environment drift -> Origin W
    attr_w = AEQKernel.discriminate_tri_origin(
        test_passed_on_baseline=False,
        test_passed_on_mutant=False,
        environment_changed=True,
    )
    assert attr_w.origin == OriginType.WORLD
    assert attr_w.verdict_badge == "ORIGIN_W_DRIFT"

    # 4. Predictable test failure on mutant -> Verifier Adequacy Confirmed
    attr_ok = AEQKernel.discriminate_tri_origin(
        test_passed_on_baseline=True,
        test_passed_on_mutant=False,
    )
    assert attr_ok.origin == OriginType.VERIFIER
    assert attr_ok.verdict_badge == "VERIFIER_ADEQUACY_CONFIRMED"


def test_causal_bisect_and_retraction_dag():
    """Law 4: Retraction cascade prunes dependent nodes in topological order."""
    dag = {
        "ROOT": [],
        "MODULE_A": ["ROOT"],
        "MODULE_B": ["ROOT"],
        "LEAF_C": ["MODULE_A", "MODULE_B"],
    }
    plan = AEQKernel.causal_bisect_and_retract(dag, invalidated_node="ROOT")
    assert isinstance(plan, RetractionDAGPlan)
    assert plan.invalidated_node == "ROOT"
    # All dependent children must be retracted in order
    assert "MODULE_A" in plan.affected_nodes_topological
    assert "MODULE_B" in plan.affected_nodes_topological
    assert "LEAF_C" in plan.affected_nodes_topological
    assert len(plan.retraction_hash) == 64


def test_self_healing_contract_compilation():
    """Self-healing compilation appends missing negative fixtures for surviving mutants."""
    surviving = [
        HostileMutant(
            mutant_id="MUT-SMO1-001",
            operator=MutationOperatorType.SMO_1_CONDITIONAL_NEGATION,
            description="Inverted boundary amount <= 0 to amount > 0",
            mutated_code="",
            diff_snippet="<= 0 -> > 0",
        )
    ]
    initial_contract = {
        "task_title": "Fix withdrawal check",
        "execution_steps": ["Inspect validator"],
    }
    healed = AEQKernel.compile_self_healing_contract(surviving, initial_contract)
    assert healed["self_healing_active"] is True
    assert len(healed["negative_fixtures"]) == 1
    assert healed["negative_fixtures"][0]["mutant_id"] == "MUT-SMO1-001"
    assert any("AEQ Self-Healing" in step for step in healed["execution_steps"])
