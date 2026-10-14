"""
Unified CWC-1 Engine Orchestrator for SPE Ω PRO.
Version 1.1: Repaired with Structural Feasibility Isolation, Scoped Identifiability,
4 Evidence Dimensions, and Explicit Fixture Reclassification (CWC-F01 through CWC-F12).
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple
from .types import (
    AcquisitionMode,
    ActionDecision,
    Cwc1Result,
    ExplanatoryMechanism,
    IdentifiabilityStatus,
    InterventionalAction,
    ObservationWitness,
    PrecommitmentDigest,
    QualificationState,
    ReusableScientificProcedure,
    ScientificWitness,
    ScientificWitnessType,
    StatisticalProtocol,
)
from .mechanism_compiler import MechanismCompiler
from .experiment_selector import ExperimentSelector
from .witness_generator import ScientificWitnessGenerator
from .transfer_engine import TransferEngine


class SpeCwcEngine:
    """Unified Frontier Scientific Intelligence Engine for SPE Ω PRO."""

    def __init__(
        self,
        epsilon_ident: float = 0.05,
        lambda_evsi: float = 1.0,
        mu_fr: float = 1.0,
        witness_tolerance: float = 0.15,
        min_transfer_pass_rate: float = 0.80,
    ):
        self.compiler = MechanismCompiler(epsilon_identifiability=epsilon_ident)
        self.selector = ExperimentSelector(lambda_evsi=lambda_evsi, mu_fr=mu_fr)
        self.witness_gen = ScientificWitnessGenerator(tolerance=witness_tolerance)
        self.transfer_engine = TransferEngine(min_transfer_pass_rate=min_transfer_pass_rate)

    def execute_discovery_cycle(
        self,
        domain: str,
        problem_description: str,
        baseline_condition: str = "x_baseline",
        candidate_actions: Optional[List[InterventionalAction]] = None,
        simulated_observation: Optional[ObservationWitness] = None,
        ood_transfer_cases: Optional[List[Dict[str, float]]] = None,
        statistical_protocol: Optional[StatisticalProtocol] = None,
        lvt_transfer_token: Optional[str] = None,
        acquisition_mode: AcquisitionMode = AcquisitionMode.MONETARY_DECISION_VALUE,
        budget_nanos: int = 10_000_000_000,
        risk_ceiling_nanos: int = 1_000_000_000,
    ) -> Cwc1Result:
        """
        Executes a complete CWC-1 scientific discovery and verification cycle:
        Question -> Competing Mechanisms -> Scoped Identifiability Check -> Decisive Experiment ->
        Structural Action Selection -> Precommitment Lock -> Observation Witness ->
        Multi-Dimensional Scientific Witness -> LVT Transfer Test -> Compounded Procedure.
        """
        # 1. Compile Competing Explanatory Mechanisms
        mechanisms = self.compiler.compile_competing_mechanisms(domain, problem_description)

        # 2. Scoped Identifiability Analysis at Baseline (CWC-F01)
        baseline_obs_val = simulated_observation.observed_value if simulated_observation and simulated_observation.measured_variable == baseline_condition else None
        ident_status, tv_gap = self.compiler.compute_identifiability(
            mechanisms=mechanisms,
            observation_condition=baseline_condition,
            baseline_observed_value=baseline_obs_val,
        )

        # 3. Default Candidate Actions if none provided
        if candidate_actions is None:
            candidate_actions = [
                InterventionalAction(
                    action_id="ACT-EXP-01",
                    target_variable="x",
                    intervention_value=2.0,
                    description="Measure response at x=2.0 to separate linear vs quadratic kinetics",
                    is_authorized=True,
                    cost_nanos=150_000_000,  # $0.15 USD
                    risk_nanos=10_000_000,   # $0.01 USD
                    expected_information_gain=1.2,
                    expected_value_sample_info=2.0,  # $2.00 EVSI in monetary terms
                    falsification_potential=0.85,
                ),
                InterventionalAction(
                    action_id="ACT-EXP-02",
                    target_variable="x",
                    intervention_value=3.0,
                    description="Measure response at x=3.0 to probe asymptotic regime",
                    is_authorized=True,
                    cost_nanos=450_000_000,  # $0.45 USD
                    risk_nanos=50_000_000,
                    expected_information_gain=1.4,
                    expected_value_sample_info=2.5,
                    falsification_potential=0.90,
                ),
                InterventionalAction(
                    action_id="ACT-EXP-UNAUTH",
                    target_variable="x_extreme",
                    intervention_value=100.0,
                    description="Over-voltage stress test exceeding safety threshold",
                    is_authorized=False,  # Unauthorized action
                    cost_nanos=2_000_000_000,
                    risk_nanos=10_000_000_000,
                    expected_information_gain=2.0,
                    expected_value_sample_info=5.0,
                    falsification_potential=0.99,
                ),
            ]

        # 4. Decisive Experiment Selection (Structural Filtering + Consistent Acquisition - CWC-F02, CWC-F03)
        action_decision, best_jsd = self.selector.select_best_experiment(
            mechanisms=mechanisms,
            candidate_actions=candidate_actions,
            budget_nanos=budget_nanos,
            risk_ceiling_nanos=risk_ceiling_nanos,
            mode=acquisition_mode,
        )
        best_action = action_decision.selected_action

        # 5. Cryptographic Precommitment Lock (Verifiable Chronology - CWC-F06)
        precommitment: Optional[PrecommitmentDigest] = None
        if best_action is not None:
            prot_id = statistical_protocol.protocol_id if statistical_protocol else "DEFAULT"
            precommitment = self.selector.seal_precommitment_lock(
                mechanisms=mechanisms,
                action=best_action,
                protocol_id=prot_id,
            )

        # 6. Ingest Observation & Seal Multi-Dimensional Scientific Witness (CWC-F05, CWC-F07, CWC-F08)
        scientific_witness: Optional[ScientificWitness] = None
        if simulated_observation is not None and precommitment is not None:
            claim = f"Response follows causal mechanism under {simulated_observation.measured_variable}"
            scientific_witness = self.witness_gen.adjudicate_and_seal_witness(
                mechanisms=mechanisms,
                observation=simulated_observation,
                precommitment=precommitment,
                claim_statement=claim,
                statistical_protocol=statistical_protocol,
            )

        # 7. Evaluate Out-of-Distribution (OOD) Transfer & Compound Procedure (CWC-F09)
        reusable_proc: Optional[ReusableScientificProcedure] = None
        if scientific_witness is not None and scientific_witness.truth_status == "SUPPORTED":
            winning_mech = next(
                (m for m in mechanisms if m.mechanism_id == scientific_witness.mechanism_id),
                mechanisms[0],
            )
            reusable_proc = self.transfer_engine.evaluate_ood_transfer(
                mechanism=winning_mech,
                witness=scientific_witness,
                unseen_test_cases=ood_transfer_cases or [],
                lvt_transfer_token=lvt_transfer_token,
            )

        # 8. Compute Illustrative Cost Accounting Fixture Ratio (CWC-F04)
        total_cost = best_action.cost_nanos if best_action else 100_000_000
        verified_outcomes = 1 if (scientific_witness and scientific_witness.truth_status == "SUPPORTED") else 0
        fixture_ratio = self.transfer_engine.calculate_cost_fixture_ratio(
            verified_outcomes_cwc=verified_outcomes,
            cost_nanos_cwc=total_cost,
            verified_outcomes_baseline=1,
            cost_usd_baseline=20.0,
        )

        return Cwc1Result(
            mission_title=f"Scientific Discovery: {domain}",
            competing_mechanisms=tuple(mechanisms),
            identifiability_status=ident_status,
            total_variation_gap=round(tv_gap, 4),
            selected_action=best_action,
            action_decision=action_decision,
            jensen_shannon_disagreement=round(best_jsd, 4),
            precommitment=precommitment,
            scientific_witness=scientific_witness,
            reusable_procedure=reusable_proc,
            benchmark_type="ILLUSTRATIVE_COST_FIXTURE",
            cost_ratio_fixture=fixture_ratio,
            empirical_discovery_gain="UNMEASURED_PENDING_INDEPENDENT_BENCHMARK",
            is_100x_empirically_proven=False,
            productivity_gain_g=fixture_ratio,
            total_cost_nanos=total_cost,
        )
