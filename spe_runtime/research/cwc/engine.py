"""
Unified CWC-1 Engine Orchestrator for SPE Ω PRO.
Connects Mechanism Compilation, Identifiability Gating, Jensen-Shannon VOI Selection,
Precommitment Sealing, Witness Adjudication, and Transfer-Qualified Compounding.
"""

from __future__ import annotations
from typing import Dict, List, Optional, Tuple
from .types import (
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
        lambda_evsi: float = 0.5,
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
    ) -> Cwc1Result:
        """
        Executes a complete CWC-1 scientific discovery and verification cycle:
        Question -> Competing Mechanisms -> Identifiability Check -> Decisive Experiment ->
        Precommitment Lock -> Observation Witness -> Scientific Witness -> Transfer Test -> Compounded Procedure.
        """
        # 1. Compile Competing Explanatory Mechanisms
        mechanisms = self.compiler.compile_competing_mechanisms(domain, problem_description)

        # 2. Identifiability Analysis at Baseline
        ident_status, tv_gap = self.compiler.compute_identifiability(mechanisms, baseline_condition)

        # 3. Default Candidate Actions if none provided
        if not candidate_actions:
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
                    expected_value_sample_info=1.5,
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
                    expected_value_sample_info=1.6,
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
                    expected_value_sample_info=2.0,
                    falsification_potential=0.99,
                ),
            ]

        # 4. Decisive Experiment Selection (JSD + Exact NanoUSD Acquisition)
        best_action, best_jsd = self.selector.select_best_experiment(mechanisms, candidate_actions)

        # 5. Cryptographic Precommitment Lock (Anti-HARKing)
        precommitment: Optional[PrecommitmentDigest] = None
        if best_action is not None:
            precommitment = self.selector.seal_precommitment_lock(mechanisms, best_action)

        # 6. Ingest Observation & Seal Scientific Witness
        scientific_witness: Optional[ScientificWitness] = None
        if simulated_observation is not None and precommitment is not None:
            claim = f"Response follows causal mechanism under {simulated_observation.measured_variable}"
            scientific_witness = self.witness_gen.adjudicate_and_seal_witness(
                mechanisms=mechanisms,
                observation=simulated_observation,
                precommitment=precommitment,
                claim_statement=claim,
            )

        # 7. Evaluate Out-of-Distribution (OOD) Transfer & Compound Procedure
        reusable_proc: Optional[ReusableScientificProcedure] = None
        if scientific_witness is not None and scientific_witness.truth_status == "SUPPORTED":
            # Identify the winning mechanism
            winning_mech = next(
                (m for m in mechanisms if m.mechanism_id == scientific_witness.mechanism_id),
                mechanisms[0],
            )
            reusable_proc = self.transfer_engine.evaluate_ood_transfer(
                mechanism=winning_mech,
                witness=scientific_witness,
                unseen_test_cases=ood_transfer_cases or [],
            )

        # 8. Compute 100X Productivity Metric
        total_cost = best_action.cost_nanos if best_action else 100_000_000
        verified_outcomes = 1 if (scientific_witness and scientific_witness.truth_status == "SUPPORTED") else 0
        gain_g = self.transfer_engine.calculate_100x_productivity_gain(
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
            jensen_shannon_disagreement=round(best_jsd, 4),
            precommitment=precommitment,
            scientific_witness=scientific_witness,
            reusable_procedure=reusable_proc,
            productivity_gain_g=gain_g,
            total_cost_nanos=total_cost,
        )
