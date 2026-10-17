"""
SPE Ω — Counterfactual Specification Closure (CSC) SpecBench Killer Benchmark.
Reproduces and resolves the SpecBench compiler memorization defect:
1. Code passes all visible test fixtures (World A: w_good).
2. CSC constructs World B (w_bad: unseen compositional test failure / spec gaming).
3. CSC synthesizes optimal probe q* (offline test in air-gapped clean environment).
4. Superficial compliance is rejected and UNVERIFIED_HYPOTHESIS is recorded in CounterfactualChallengeRecord.
"""

from __future__ import annotations

import pytest
from typing import Dict, Any

from spe_runtime.research.csc import (
    CounterfactualWorld,
    WorldModel,
    WorldPair,
    WorldType,
    HypothesisStatus,
    OracleStatus,
    ProbeVerdict,
    DistinguishingProbe,
    CounterfactualChallengeRecord,
    WorldGenerator,
    ProbeSynthesizer,
    OracleQualifier,
    make_invariance_relation,
    NetworkPolicy,
)


def test_specbench_compiler_memorization_defect_reproduction_and_kill():
    """
    SpecBench Killer Benchmark:
    A candidate compiler implementation memorizes three visible benchmark tests:
      T1: "SELECT id FROM users" -> PASS
      T2: "SELECT name, age FROM users WHERE active = 1" -> PASS
      T3: "SELECT COUNT(*) FROM orders GROUP BY user_id" -> PASS
    Under ordinary benchmarks, the model scores 100% (False Acceptance).
    CSC constructs World B (w_bad: failure on unseen compositional query) and
    synthesizes optimal probe q* to expose the shortcut and reject superficial compliance.
    """
    generator = WorldGenerator()
    synthesizer = ProbeSynthesizer()

    # 1. World A: Truly compliant compiler
    w_good = CounterfactualWorld(
        world_id="world_compliant_compiler",
        satisfies_objective=True,
        observations={
            "t1_select_simple": {"parsed": True, "ast_nodes": 2, "tables": ["users"]},
            "t2_select_where": {"parsed": True, "ast_nodes": 5, "tables": ["users"]},
            "t3_group_by": {"parsed": True, "ast_nodes": 6, "tables": ["orders"]},
        },
        description="General AST compiler handling arbitrary SQL compositions",
        world_type=WorldType.BENIGN_WORLD,
    )

    # 2. World B: Spec-gaming shortcut compiler that memorized T1, T2, T3
    # CSC constructs World B where K(w_bad)=False while Obs_E(w_good) == Obs_E(w_bad)
    pair = generator.generate_world_pair(
        w_good=w_good,
        countermodel_description="Memorized lookup table for visible tests; fails unseen JOIN + SUBQUERY",
        countermodel_world_type=WorldType.SPEC_GAMING_WORLD,
        divergent_hypotheses={"general_composition_supported": False},
        divergent_latent_variables={"is_shortcut_lookup": True},
    )
    w_bad = pair.w_bad

    visible_evidence = ["t1_select_simple", "t2_select_where", "t3_group_by"]

    # Visible tests are identical between w_good and w_bad
    assert w_good.project_observations(visible_evidence) == w_bad.project_observations(visible_evidence)

    # 3. Candidate distinguishing probes
    # Probe 1: Re-running T1 (cost 0, Delta V = 0, redundant)
    p_redundant = DistinguishingProbe(
        probe_id="probe_repeat_t1",
        target_obligation_ref="ob_sql_grammar",
        evaluation_fn=lambda w: w.observations.get("t1_select_simple", {}).get("parsed"),
        cost_nanos=0,
        delta_v=0.0,
        v_reuse=0.0,
        oracle_status=OracleStatus.QUALIFIED,
        network_policy=NetworkPolicy.AIR_GAPPED,
    )

    # Probe 2: Unseen compositional test (JOIN + Subquery)
    # w_good returns parsed AST; w_bad returns SyntaxError/None
    def evaluate_compositional_sql(subject: Any) -> Any:
        if isinstance(subject, WorldModel):
            if subject.world_id == "world_compliant_compiler":
                return {"parsed": True, "ast_nodes": 9, "tables": ["users", "orders"]}
            else:
                return {"parsed": False, "error": "UNSUPPORTED_GRAMMAR_IN_SHORTCUT"}
        # Real code object execution simulation
        if hasattr(subject, "parse"):
            return subject.parse("SELECT u.name, o.total FROM users u JOIN (SELECT * FROM orders WHERE total > 100) o ON u.id = o.user_id")
        return {"parsed": False, "error": "FAILED"}

    p_specbench_killer = DistinguishingProbe(
        probe_id="probe_unseen_compositional_sql",
        target_obligation_ref="ob_sql_grammar",
        evaluation_fn=evaluate_compositional_sql,
        cost_nanos=0,  # $0 offline local test
        delta_v=1.0,   # Maximum information gain (separates good from gaming)
        v_reuse=0.9,   # Highly reusable across future SQL parser tasks
        oracle_status=OracleStatus.QUALIFIED,
        network_policy=NetworkPolicy.AIR_GAPPED,
    )

    # 4. Probe Synthesis: Solve q*
    q_star = synthesizer.synthesize_optimal_probe(
        candidate_probes=[p_redundant, p_specbench_killer],
        world_pair=pair,
        budget_nanos=10_000_000,
        granted_authorities=["READ_FILE", "LOCAL_TEST_EXECUTION"],
        target_obligation_ref="ob_sql_grammar",
    )

    assert q_star is not None
    assert q_star.probe_id == "probe_unseen_compositional_sql"

    # 5. Execute probe against the memorizing candidate implementation
    class MemorizingCandidateImplementation:
        def parse(self, sql: str) -> Dict[str, Any]:
            # Hardcoded responses for visible fixtures
            if "users WHERE active = 1" in sql:
                return {"parsed": True, "tables": ["users"]}
            elif "SELECT id FROM users" in sql:
                return {"parsed": True, "tables": ["users"]}
            elif "GROUP BY user_id" in sql:
                return {"parsed": True, "tables": ["orders"]}
            # Fails unseen compositional query!
            return {"parsed": False, "error": "UNSUPPORTED_GRAMMAR_IN_SHORTCUT"}

    candidate_code = MemorizingCandidateImplementation()

    verdict, obs = synthesizer.execute_and_classify(
        probe=q_star,
        subject=candidate_code,
        world_pair=pair,
    )

    # Superficial compliance is exposed as a COUNTEREXAMPLE
    assert verdict == ProbeVerdict.COUNTEREXAMPLE_EXPOSED

    # 6. CounterfactualChallengeRecord (CCR) created with UNVERIFIED_HYPOTHESIS
    ccr = CounterfactualChallengeRecord(
        challenge_id="ccr_specbench_killer_01",
        protected_intent_ref="intent://specbench/sql_compiler",
        obligation_ref="ob_sql_grammar",
        evidence_snapshot_hash="hash_visible_tests",
        observed_success_evidence_refs=visible_evidence,
        declared_scope={"engine": "sql_compiler"},
        alternative_world_hypothesis="Lookup table shortcut failing unseen compositions",
        assumptions=["unseen queries contain recursive joins"],
        plausibility_basis=["LLMs often memorize benchmark queries"],
        hypothesis_status=HypothesisStatus.UNVERIFIED_HYPOTHESIS,
        distinguishing_probe_operation=q_star.probe_id,
        required_authority=["LOCAL_TEST_EXECUTION"],
        required_budget_nanos=0,
        expected_observation_classes=["AST_DICT"],
        oracle_status=OracleStatus.QUALIFIED,
        observed_result=verdict,
        new_obligation_proposal="Obligation: must support arbitrary recursive subquery compositions.",
        invalidated_evidence_refs=[],
    )

    assert ccr.hypothesis_status == HypothesisStatus.UNVERIFIED_HYPOTHESIS
    assert ccr.observed_result == ProbeVerdict.COUNTEREXAMPLE_EXPOSED
    assert ccr.canonical_hash() is not None
