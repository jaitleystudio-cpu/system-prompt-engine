"""
Mechanism Compiler & Identifiability Analyzer for CWC-1.
Compiles scientific problems into competing causal mechanisms and computes observational equivalence.
"""

from __future__ import annotations
import math
from typing import Dict, List, Optional, Tuple
from .types import (
    ExplanatoryMechanism,
    IdentifiabilityStatus,
    MechanismClass,
)


class MechanismCompiler:
    """Compiles scientific questions into competing causal mechanisms and checks identifiability."""

    def __init__(self, epsilon_identifiability: float = 0.05):
        self.epsilon_ident = epsilon_identifiability

    def compile_competing_mechanisms(
        self,
        domain: str,
        problem_description: str,
        existing_data_point: float = 1.0,
    ) -> List[ExplanatoryMechanism]:
        """
        Compiles at least two candidate causal mechanisms explaining the phenomenon.
        Includes assumptions, equations, causal graph edges, and falsification criteria.
        """
        domain_clean = domain.strip().lower()

        if "neuroscience" in domain_clean or "synapse" in domain_clean or "brain" in domain_clean:
            # Competing Synaptic Plasticity Mechanisms
            m1 = ExplanatoryMechanism(
                mechanism_id="MECH-NEURO-01",
                name="Postsynaptic AMPA Receptor Trafficking (Retrograde)",
                mechanism_class=MechanismClass.BIOCHEMICAL_PATHWAY,
                hypothesis="LTP expression is mediated primarily by exocytosis of GluA1-containing AMPA receptors at the postsynaptic density.",
                assumptions=("Postsynaptic CaMKII activation is necessary", "Presynaptic vesicle release probability remains stationary"),
                causal_edges=(("NMDA_Activation", "CaMKII_Phosphorylation"), ("CaMKII_Phosphorylation", "AMPA_Exocytosis")),
                equations=("Delta_EPSC = k_post * [AMPA_surface]",),
                predictions={"stim_baseline": 2.0 * existing_data_point, "stim_high_freq": 4.0, "stim_paired_pulse": 2.1},
                falsification_conditions=("AMPA exocytosis blocked, yet EPSC potentiates > 50%",),
                prior_weight=0.55,
            )
            m2 = ExplanatoryMechanism(
                mechanism_id="MECH-NEURO-02",
                name="Presynaptic Retrograde Nitric Oxide Modulation",
                mechanism_class=MechanismClass.BIOCHEMICAL_PATHWAY,
                hypothesis="LTP expression is driven by retrograde diffusion of NO stimulating presynaptic guanylyl cyclase to increase release probability.",
                assumptions=("Postsynaptic nNOS synthesis occurs upon Ca2+ influx", "Presynaptic active zone Pr increases"),
                causal_edges=(("Postsynaptic_Ca2+", "nNOS_Activation"), ("NO_Diffusion", "Presynaptic_cGC"), ("Presynaptic_cGC", "Release_Probability_Pr")),
                equations=("Delta_EPSC = k_pre * Pr * Quantal_Size",),
                predictions={"stim_baseline": 2.0 * existing_data_point, "stim_high_freq": 6.2, "stim_paired_pulse": 1.2},
                falsification_conditions=("Scavenging extracellular NO prevents LTP without altering baseline transmission",),
                prior_weight=0.45,
            )
            return [m1, m2]

        elif "material" in domain_clean or "superconductor" in domain_clean:
            # Competing Mechanisms for High-Tc Superconductivity
            m1 = ExplanatoryMechanism(
                mechanism_id="MECH-MAT-01",
                name="Phonon-Mediated Electron-Phonon Strong Coupling (Eliashberg)",
                mechanism_class=MechanismClass.MATERIALS_PHASE_TRANSITION,
                hypothesis="Superconducting pair formation is driven by high-frequency acoustic/optical phonon modes.",
                assumptions=("Retarded electron-phonon interaction", "Migdal theorem holds"),
                causal_edges=(("Lattice_Vibration", "Phonon_Exchange"), ("Phonon_Exchange", "Cooper_Pairing")),
                equations=("Tc = (omega_ln / 1.2) * exp(-1.04*(1+lambda)/(lambda - mu*(1+0.62*lambda)))",),
                predictions={"isotope_shift_ratio": 0.50, "pressure_delta_gpa": 12.4},
                falsification_conditions=("Zero isotope effect observed with mass substitution (alpha < 0.02)",),
                prior_weight=0.35,
            )
            m2 = ExplanatoryMechanism(
                mechanism_id="MECH-MAT-02",
                name="Spin-Fluctuation Antiferromagnetic Pairing",
                mechanism_class=MechanismClass.MATERIALS_PHASE_TRANSITION,
                hypothesis="Pairing is mediated by magnetic spin excitations near a quantum critical point.",
                assumptions=("Strong on-site Coulomb repulsion U", "D-wave pairing symmetry"),
                causal_edges=(("Spin_Susceptibility", "Paramagnon_Exchange"), ("Paramagnon_Exchange", "D_Wave_Gap")),
                equations=("Delta_k = Delta_0 * (cos(kx) - cos(ky))",),
                predictions={"isotope_shift_ratio": 0.05, "pressure_delta_gpa": 24.8},
                falsification_conditions=("Node-free isotropic s-wave gap observed in angle-resolved photoemission",),
                prior_weight=0.65,
            )
            return [m1, m2]

        else:
            # Canonical Synthetic Scientific Mechanism Discovery Problem
            # M1: y = 2x (Linear)
            # M2: y = x + x^2 (Quadratic)
            # Both predict y=2 at x=1 (Observationally equivalent at baseline x=1)
            m1 = ExplanatoryMechanism(
                mechanism_id="MECH-CORE-01",
                name="Linear Direct Coupling Mechanism",
                mechanism_class=MechanismClass.EQUATION_SYSTEM,
                hypothesis="The measured response scales linearly with input perturbation without saturation or feedback.",
                assumptions=("Conservation of energy holds locally", "First-order kinetics"),
                causal_edges=(("Input_X", "Direct_Transfer"), ("Direct_Transfer", "Output_Y")),
                equations=("y = 2 * x",),
                predictions={"x_baseline": 2.0 * existing_data_point, "x_intervene_2": 4.0, "x_intervene_3": 6.0},
                falsification_conditions=("Output at x=2 deviates from 4.0 by more than 10%",),
                prior_weight=0.50,
            )
            m2 = ExplanatoryMechanism(
                mechanism_id="MECH-CORE-02",
                name="Nonlinear Feedback Accumulation Mechanism",
                mechanism_class=MechanismClass.EQUATION_SYSTEM,
                hypothesis="The measured response incorporates quadratic self-reinforcing cooperative feedback.",
                assumptions=("Second-order kinetic cooperativity", "Unbounded saturation limit in current regime"),
                causal_edges=(("Input_X", "Cooperative_Binding"), ("Cooperative_Binding", "Output_Y")),
                equations=("y = x + x^2",),
                predictions={"x_baseline": 2.0 * existing_data_point, "x_intervene_2": 6.0, "x_intervene_3": 12.0},
                falsification_conditions=("Output at x=2 deviates from 6.0 by more than 10%",),
                prior_weight=0.50,
            )
            return [m1, m2]

    def compute_identifiability(
        self,
        mechanisms: List[ExplanatoryMechanism],
        observation_condition: str,
    ) -> Tuple[IdentifiabilityStatus, float]:
        """
        Evaluates whether competing mechanisms can be separated under the current observation condition.
        Computes Total Variation / relative separation between models:
            TV = |y_i - y_j| / max(|y_i|, |y_j|, 1.0)
        If TV < epsilon_ident for all pairs, the mechanisms are OBSERVATIONALLY_EQUIVALENT.
        """
        if len(mechanisms) < 2:
            return IdentifiabilityStatus.UNIQUE_IDENTIFIED, 1.0

        max_tv = 0.0
        for i in range(len(mechanisms)):
            for j in range(i + 1, len(mechanisms)):
                m_i = mechanisms[i]
                m_j = mechanisms[j]
                pred_i = m_i.predictions.get(observation_condition)
                pred_j = m_j.predictions.get(observation_condition)

                if pred_i is None or pred_j is None:
                    # Condition unobserved
                    continue

                denom = max(abs(pred_i), abs(pred_j), 1.0)
                tv = abs(pred_i - pred_j) / denom
                if tv > max_tv:
                    max_tv = tv

        if max_tv < self.epsilon_ident:
            return IdentifiabilityStatus.OBSERVATIONALLY_EQUIVALENT, max_tv
        else:
            return IdentifiabilityStatus.UNIQUE_IDENTIFIED, max_tv
