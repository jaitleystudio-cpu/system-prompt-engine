"""G1R-7 K3 strategy intelligence — CognitivePlan / PromptStrategy / TechniqueSelection."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from spe_runtime.contract import ProtectedIntentContract, propose_requirement, confirm_requirement
from spe_runtime.contract.protected import ContractValidity
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt import (
    CognitivePlanKind,
    PlanningHints,
    PromptTechnique,
    STANDARD_MAX_TECHNIQUES,
    build_cognitive_plan,
    build_prompt_artifact,
    build_prompt_strategy,
    select_prompt_techniques,
)
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind

ROOT = Path(__file__).resolve().parents[2]


def _req(c, key, kind, value, prov=Provenance.USER_EXPLICIT):
    return propose_requirement(
        c, semantic_key=key, kind=kind, value=value, provenance=prov, source_ref="t"
    )


def _simple_contract():
    c = ProtectedIntentContract()
    c = _req(c, "goal", RequirementKind.MUST, "write a short greeting")
    return c


def test_simple_task_direct_plan():
    plan = build_cognitive_plan(_simple_contract(), PlanningHints(complexity_class="SIMPLE"))
    assert plan.plan_kind is CognitivePlanKind.DIRECT
    assert plan.plan_id.startswith("cplan-")


def test_decompose_plan():
    plan = build_cognitive_plan(
        _simple_contract(), PlanningHints(needs_decomposition=True)
    )
    assert plan.plan_kind is CognitivePlanKind.DECOMPOSE


def test_retrieve_then_reason_plan():
    plan = build_cognitive_plan(_simple_contract(), PlanningHints(needs_retrieval=True))
    assert plan.plan_kind is CognitivePlanKind.RETRIEVE_THEN_REASON
    assert plan.requires_evidence is True


def test_compare_plan():
    plan = build_cognitive_plan(_simple_contract(), PlanningHints(needs_comparison=True))
    assert plan.plan_kind is CognitivePlanKind.COMPARE


def test_critique_revise_plan():
    plan = build_cognitive_plan(_simple_contract(), PlanningHints(needs_revision=True))
    assert plan.plan_kind is CognitivePlanKind.CRITIQUE_REVISE


def test_structured_analysis_plan():
    plan = build_cognitive_plan(
        _simple_contract(),
        PlanningHints(needs_structured_output=True, complexity_class="STANDARD"),
    )
    assert plan.plan_kind is CognitivePlanKind.STRUCTURED_ANALYSIS


def test_plan_then_execute_no_authority():
    plan = build_cognitive_plan(
        _simple_contract(), PlanningHints(needs_execution_prep=True)
    )
    assert plan.plan_kind is CognitivePlanKind.PLAN_THEN_EXECUTE
    art = build_prompt_artifact(
        _simple_contract(), planning_hints=PlanningHints(needs_execution_prep=True)
    )
    assert not hasattr(art, "authority_grant")
    assert "does_not_grant_authority_or_network" in art.rendered_prompt


def test_conflicted_source_blocks_plan():
    c = _req(ProtectedIntentContract(), "fmt", RequirementKind.MUST, "json")
    c = confirm_requirement(c, next(iter(c.graph.nodes.keys())))
    c2 = _req(c, "fmt", RequirementKind.MUST_NOT, "json", Provenance.INFERRED)
    assert c2.validity is ContractValidity.CONFLICTED
    with pytest.raises(SpeTypedError) as ei:
        build_cognitive_plan(c2)
    assert ei.value.code is ErrorCode.K3_STRATEGY_CONFLICTED_SOURCE
    with pytest.raises(SpeTypedError):
        build_prompt_artifact(c2)


def test_unknown_not_invented_into_persona():
    c = ProtectedIntentContract()
    from spe_runtime.requirements.models import RequirementAtom
    from spe_runtime.requirements.graph import RequirementGraph

    atom = RequirementAtom.create(
        semantic_key="audience",
        kind=RequirementKind.PREFERENCE,
        value="unspecified",
        provenance=Provenance.UNKNOWN,
    )
    c = ProtectedIntentContract(graph=RequirementGraph().with_node(atom))
    plan = build_cognitive_plan(c, PlanningHints())  # no role_label
    techs = select_prompt_techniques(c, plan, PlanningHints())
    assert PromptTechnique.ROLE_PERSONA not in techs.techniques


def test_direct_minimal_techniques():
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(complexity_class="SIMPLE"))
    techs = select_prompt_techniques(c, plan, PlanningHints(complexity_class="SIMPLE"))
    assert PromptTechnique.ZERO_SHOT in techs.techniques
    assert PromptTechnique.FEW_SHOT not in techs.techniques
    assert PromptTechnique.RETRIEVE_REASON not in techs.techniques
    assert len(techs.techniques) <= STANDARD_MAX_TECHNIQUES


def test_few_shot_requires_examples():
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(needs_examples=True, example_count=2))
    techs = select_prompt_techniques(
        c, plan, PlanningHints(needs_examples=True, example_count=2)
    )
    assert PromptTechnique.FEW_SHOT in techs.techniques
    assert PromptTechnique.ZERO_SHOT not in techs.techniques


def test_few_shot_missing_examples_noted():
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(needs_examples=True, example_count=0))
    techs = select_prompt_techniques(
        c, plan, PlanningHints(needs_examples=True, example_count=0)
    )
    assert PromptTechnique.FEW_SHOT not in techs.techniques
    assert "EXAMPLES_REQUIRED_BUT_MISSING" in techs.notes


def test_contextual_from_context():
    c = _simple_contract()
    art = build_prompt_artifact(c, context_blocks={"doc": "source text"})
    assert art.source_binding.technique_selection_id
    assert "CONTEXTUAL" in art.rendered_prompt or any(
        s.semantic_key == "CONTEXTUAL" for s in art.segments
    )


def test_retrieve_reason_justified_not_network():
    c = _simple_contract()
    # Protected MUST_NOT network
    c = _req(c, "network", RequirementKind.MUST_NOT, "use network")
    hints = PlanningHints(needs_retrieval=True)
    art = build_prompt_artifact(c, planning_hints=hints)
    assert "MUST_NOT |" in art.rendered_prompt
    assert "local_or_supplied_evidence_only" in art.rendered_prompt
    assert "RETRIEVE_REASON" in art.rendered_prompt


def test_structured_output_justified():
    c = _simple_contract()
    plan = build_cognitive_plan(
        c, PlanningHints(needs_structured_output=True, complexity_class="STANDARD")
    )
    techs = select_prompt_techniques(
        c, plan, PlanningHints(needs_structured_output=True)
    )
    assert PromptTechnique.STRUCTURED_OUTPUT in techs.techniques


def test_critique_revise_justified():
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(needs_revision=True))
    techs = select_prompt_techniques(c, plan, PlanningHints(needs_revision=True))
    assert PromptTechnique.CRITIQUE_REVISE in techs.techniques


def test_zero_shot_few_shot_incompatible_path():
    # Compatibility is enforced if both appear — FEW_SHOT path excludes ZERO_SHOT
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(needs_examples=True, example_count=1))
    techs = select_prompt_techniques(
        c, plan, PlanningHints(needs_examples=True, example_count=1)
    )
    assert not (
        PromptTechnique.ZERO_SHOT in techs.techniques
        and PromptTechnique.FEW_SHOT in techs.techniques
    )


def test_k3_does_not_stack_unjustified_techniques():
    c = _simple_contract()
    plan = build_cognitive_plan(c, PlanningHints(complexity_class="SIMPLE"))
    techs = select_prompt_techniques(c, plan, PlanningHints(complexity_class="SIMPLE"))
    unjustified = {
        PromptTechnique.RETRIEVE_REASON,
        PromptTechnique.CRITIQUE_REVISE,
        PromptTechnique.DECOMPOSE_PLAN_SOLVE,
        PromptTechnique.FEW_SHOT,
        PromptTechnique.STRUCTURED_OUTPUT,
    }
    assert unjustified.isdisjoint(set(techs.techniques))
    assert len(techs.techniques) <= 3


def test_every_technique_has_justification():
    c = _simple_contract()
    hints = PlanningHints(
        needs_retrieval=True,
        needs_structured_output=True,
        has_context=True,
        role_label="researcher",
    )
    plan = build_cognitive_plan(c, hints)
    techs = select_prompt_techniques(c, plan, hints)
    assert techs.justifications
    for j in techs.justifications:
        assert j.source_refs
        assert j.reason_code
    assert {j.technique for j in techs.justifications} == set(techs.techniques)


def test_technique_budget_truncation_explicit():
    c = _simple_contract()
    hints = PlanningHints(
        needs_retrieval=True,
        needs_structured_output=True,
        needs_revision=True,
        needs_decomposition=True,
        has_context=True,
        role_label="auditor",
        needs_examples=True,
        example_count=2,
        complexity_class="COMPLEX",
    )
    plan = build_cognitive_plan(c, hints)
    techs = select_prompt_techniques(c, plan, hints)
    assert len(techs.techniques) <= STANDARD_MAX_TECHNIQUES
    if techs.budget_truncated:
        assert techs.deferred_techniques
        assert any("BUDGET_TRUNCATED" in n for n in techs.notes)


def test_one_line_product_like_structured_state():
    """Semantic state for ecommerce request — only encoded facts, no invention."""
    c = ProtectedIntentContract()
    c = _req(c, "goal", RequirementKind.MUST, "premium ecommerce website for mobile accessories")
    c = _req(c, "surface", RequirementKind.SHOULD, "web storefront")
    hints = PlanningHints(
        needs_decomposition=True,
        complexity_class="STANDARD",
        needs_structured_output=False,
    )
    plan = build_cognitive_plan(c, hints)
    techs = select_prompt_techniques(c, plan, hints)
    strat = build_prompt_strategy(c, plan, techs, hints)
    art = build_prompt_artifact(c, planning_hints=hints)
    assert plan.plan_kind is CognitivePlanKind.DECOMPOSE
    assert art.source_binding.cognitive_plan_id == plan.plan_id
    assert art.source_binding.prompt_strategy_id == strat.strategy_id
    assert "budget" not in art.rendered_prompt.lower() or "BUDGET_TRUNCATED" in art.rendered_prompt
    # Must not invent payment provider / brand colors
    assert "stripe" not in art.rendered_prompt.lower()
    assert "terracotta" not in art.rendered_prompt.lower()


def test_complex_research_bounded():
    c = ProtectedIntentContract()
    c = _req(c, "evidence", RequirementKind.MUST, "use evidence")
    c = _req(c, "contradictions", RequirementKind.MUST, "include contradictory evidence")
    c = _req(c, "citations", RequirementKind.MUST, "cite sources")
    c = _req(c, "synthesis", RequirementKind.MUST, "structured synthesis")
    hints = PlanningHints(
        needs_retrieval=True,
        needs_structured_output=True,
        complexity_class="COMPLEX",
    )
    plan = build_cognitive_plan(c, hints)
    techs = select_prompt_techniques(c, plan, hints)
    assert plan.plan_kind is CognitivePlanKind.RETRIEVE_THEN_REASON
    assert PromptTechnique.RETRIEVE_REASON in techs.techniques
    assert len(techs.techniques) <= STANDARD_MAX_TECHNIQUES


def test_writing_task_restraint():
    c = ProtectedIntentContract()
    c = _req(c, "goal", RequirementKind.MUST, "rewrite supplied text")
    c = _req(c, "tone", RequirementKind.SHOULD, "professional")
    c = _req(c, "preserve_meaning", RequirementKind.MUST, True)
    c = _req(c, "format", RequirementKind.MUST, "prose")
    hints = PlanningHints(has_context=True, complexity_class="SIMPLE")
    plan = build_cognitive_plan(c, hints)
    techs = select_prompt_techniques(c, plan, hints)
    assert PromptTechnique.RETRIEVE_REASON not in techs.techniques
    assert PromptTechnique.FEW_SHOT not in techs.techniques
    assert PromptTechnique.STRUCTURED_OUTPUT not in techs.techniques


def test_coding_task_plan_then_execute_no_grant():
    c = ProtectedIntentContract()
    c = _req(c, "inspect", RequirementKind.MUST, "inspect repository first")
    c = _req(c, "minimal", RequirementKind.MUST, "modify minimal files")
    c = _req(c, "tests", RequirementKind.MUST, "run tests")
    hints = PlanningHints(needs_execution_prep=True, needs_decomposition=True)
    # needs_retrieval false; decomposition wins after retrieval priority — 
    # actually retrieval is first; decomposition second after comparison/revision.
    # With both decomposition and execution_prep: retrieval no, comparison no,
    # revision no, decomposition YES → DECOMPOSE
    plan = build_cognitive_plan(c, hints)
    assert plan.plan_kind in (
        CognitivePlanKind.DECOMPOSE,
        CognitivePlanKind.PLAN_THEN_EXECUTE,
    )
    art = build_prompt_artifact(c, planning_hints=hints)
    blob = json.dumps(art.to_canonical_payload())
    assert "AuthorityGrant" not in blob
    assert "execution_grants" not in blob


def test_sole_prompt_artifact_writer_unchanged():
    assert build_prompt_artifact.__module__ == "spe_runtime.prompt.build"
    assert build_cognitive_plan.__module__ == "spe_runtime.prompt.plan"
    assert build_prompt_strategy.__module__ == "spe_runtime.prompt.strategy"
    assert select_prompt_techniques.__module__ == "spe_runtime.prompt.techniques"


def test_determinism_cross_process():
    code = r"""
from spe_runtime.contract import ProtectedIntentContract, propose_requirement
from spe_runtime.provenance import Provenance
from spe_runtime.requirements import RequirementKind
from spe_runtime.prompt import PlanningHints, build_prompt_artifact, build_cognitive_plan, select_prompt_techniques, build_prompt_strategy
c = ProtectedIntentContract()
c = propose_requirement(c, semantic_key='goal', kind=RequirementKind.MUST, value='hello', provenance=Provenance.USER_EXPLICIT)
h = PlanningHints(needs_decomposition=True)
plan = build_cognitive_plan(c, h)
techs = select_prompt_techniques(c, plan, h)
strat = build_prompt_strategy(c, plan, techs, h)
art = build_prompt_artifact(c, planning_hints=h)
print(plan.plan_id)
print(techs.selection_id)
print(strat.strategy_id)
print(art.prompt_content_digest)
"""
    a = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    b = subprocess.check_output([sys.executable, "-c", code], cwd=str(ROOT), text=True)
    assert a == b


def test_gap_matrix_and_writer_map_k3_complete():
    ring = json.loads((ROOT / "proofs/g1/ring0_gap_matrix.json").read_text())
    for name in ("PromptArtifact", "cognitive plan", "prompt strategy", "technique selection"):
        row = next(r for r in ring["requirements"] if r["requirement"] == name)
        assert row["status"] == "IMPLEMENTED", name
        assert row["implementation_modules"], name
    w = json.loads((ROOT / "proofs/g1/semantic_writer_map.json").read_text())
    for fact, path in (
        ("cognitive_plan", "spe_runtime/prompt/plan.py"),
        ("prompt_strategy", "spe_runtime/prompt/strategy.py"),
        ("technique_selection", "spe_runtime/prompt/techniques.py"),
        ("prompt_artifact", "spe_runtime/prompt/build.py"),
    ):
        f = next(x for x in w["facts"] if x["semantic_fact"] == fact)
        assert f["writer_modules"] == [path]
        assert f["duplicate_writer"] is False
    # Post-G1R-9: spe_artifact_identity + qualification_evidence owned; unowned empty.
    assert "spe_artifact_identity" not in w["unowned_facts"]
    assert "qualification_evidence" not in w["unowned_facts"]
    assert w["unowned_facts"] == []
