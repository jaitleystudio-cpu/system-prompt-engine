"""
SPE Ω PRO — Counterfactual Discovery Compiler (RGD-1)
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
from typing import Dict, List, Optional
from spe_runtime.research.rgd.types import (
    ResearchMission,
    EvidenceGraph,
    CompetingTheory,
    DiscriminatingExperiment,
    NANOS_PER_USD,
)

# Default latency sensitivity: 10,000,000 nanos per second ($0.01/s delay penalty)
DEFAULT_LAMBDA_DELAY_NANOS_PER_SEC: float = 10_000_000.0


def calculate_voi_score(
    expected_delta_r: float,
    expected_cost_nanos: int,
    expected_time_sec: float,
    lambda_delay: float = DEFAULT_LAMBDA_DELAY_NANOS_PER_SEC,
) -> float:
    """
    Computes the Value-of-Information (VOI) score U(e):
    U(e) = E[Delta R(e)] / (C(e) + lambda * T(e))
    Scaled by NANOS_PER_USD (10^9) to yield normalized utility points per dollar.
    """
    delta_r = max(0.0, min(1.0, float(expected_delta_r)))
    cost_nanos = max(0, int(expected_cost_nanos))
    time_sec = max(0.0, float(expected_time_sec))
    lam = max(0.0, float(lambda_delay))
    denom_nanos = float(cost_nanos) + (lam * time_sec)
    if denom_nanos <= 0.0:
        denom_nanos = 1.0
    return (delta_r * float(NANOS_PER_USD)) / denom_nanos


def compile_competing_theories(
    mission: ResearchMission,
    evidence_graph: EvidenceGraph,
) -> List[CompetingTheory]:
    """
    Constructs competing explanations of reality for the given research mission:
    Theory A: The primary hypothesized mechanism explains the effect.
    Theory B: An alternative known mechanism or parameter set explains the effect.
    Theory C: The observation is caused by measurement artifact, selection bias, or benchmark overfit.
    """
    domain = mission.target_domain
    theories: List[CompetingTheory] = []

    # Map existing evidence node IDs to theories
    support_ids = [
        nid for nid, node in evidence_graph.nodes.items()
        if node.scientific_relationship.value == "SUPPORT"
    ]
    contradiction_ids = [
        nid for nid, node in evidence_graph.nodes.items()
        if node.scientific_relationship.value == "CONTRADICTION"
    ]

    if domain == "AUDIO_ENGINEERING":
        theories.append(
            CompetingTheory(
                theory_id="theory_audio_A",
                name="Theory A: Deep Multi-Scale Residual Quantization",
                statement="Perceptual coding efficiency is primarily driven by non-linear residual vector quantization codebooks capturing pitch harmonics.",
                mechanism="Multi-scale 8-stage RVQ with adversarial mel-spectrogram discriminator loss.",
                prior_probability=0.48,
                supporting_evidence_ids=support_ids,
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_audio_B",
                name="Theory B: Linear Psychoacoustic Sub-Band Pruning",
                statement="The dominant efficiency factor is classical linear predictive psychoacoustic masking, rendering deep RVQ layers redundant.",
                mechanism="Sub-band psychoacoustic filtering with sparse residual codebook allocation.",
                prior_probability=0.32,
                supporting_evidence_ids=[],
                contradicting_evidence_ids=support_ids,
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_audio_C",
                name="Theory C: Clean Studio Overfitting & Phase Artifact",
                statement="Reported performance gains are artifacts of high-frequency listener habituation on clean speech and collapse under real-world acoustic background noise.",
                mechanism="Phase cancellation and spectral envelope mismatch on unnormalized multi-speaker noise.",
                prior_probability=0.20,
                supporting_evidence_ids=contradiction_ids,
                contradicting_evidence_ids=[],
            )
        )
    elif domain == "BIOTECHNOLOGY":
        theories.append(
            CompetingTheory(
                theory_id="theory_bio_A",
                name="Theory A: Backbone Geometry Geometric Complementarity",
                statement="High binding affinity (Kd < 1 nM) is driven by de novo diffusion backbone curvature matching target hydrophobic pockets.",
                mechanism="Continuous SE(3) equivariant backbone coordinate synthesis.",
                prior_probability=0.50,
                supporting_evidence_ids=support_ids,
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_bio_B",
                name="Theory B: Electrostatic Surface Potential Bias",
                statement="Binding is non-specific charge attraction caused by excess basic residue density on the contact surface.",
                mechanism="Electrostatic Coulombic accumulation overcoming steric hindrance.",
                prior_probability=0.30,
                supporting_evidence_ids=[],
                contradicting_evidence_ids=support_ids,
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_bio_C",
                name="Theory C: Assay Immobilization Aggregation Artifact",
                statement="Observed SPR kinetics reflect partial scaffold oligomerization/aggregation on sensor chips rather than true monovalent affinity.",
                mechanism="Sensor surface self-association inflating apparent association rate kon.",
                prior_probability=0.20,
                supporting_evidence_ids=contradiction_ids,
                contradicting_evidence_ids=[],
            )
        )
    elif domain == "MATERIALS_SCIENCE":
        theories.append(
            CompetingTheory(
                theory_id="theory_mat_A",
                name="Theory A: Self-Passivating Solid-Electrolyte Interphase",
                statement="High volumetric energy density (>=750 Wh/L) is driven by in-situ fluorinated halide SEI passivation preventing dendrite propagation.",
                mechanism="High-density halide SEI formation with low interfacial charge-transfer resistance.",
                prior_probability=0.52,
                supporting_evidence_ids=support_ids,
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_mat_B",
                name="Theory B: Liquid Electrolyte Trace Residue Facilitation",
                statement="Apparent high critical current density is facilitated by residual polar solvent traces lowering apparent interfacial impedance.",
                mechanism="Trace volatile solvent solvating lithium ions at contact asperities.",
                prior_probability=0.28,
                supporting_evidence_ids=[],
                contradicting_evidence_ids=support_ids,
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_mat_C",
                name="Theory C: Mechanical Stress Delamination & Void Artifact",
                statement="Reported cycle stability collapses under fast discharge (>2C) due to contact loss and void formation rather than electrochemical degradation.",
                mechanism="Vacancy accumulation and interfacial creep causing mechanical disconnection.",
                prior_probability=0.20,
                supporting_evidence_ids=contradiction_ids,
                contradicting_evidence_ids=[],
            )
        )
    elif domain == "CRYPTOGRAPHY":
        theories.append(
            CompetingTheory(
                theory_id="theory_crypto_A",
                name="Theory A: Constant-Time Polynomial Vector Arithmetic",
                statement="Post-quantum signature verification satisfies sub-10ms latency with zero timing side-channel leakage through deterministic Montgomery reduction.",
                mechanism="Constant-time NTT butterflies avoiding data-dependent branching and cache lookups.",
                prior_probability=0.55,
                supporting_evidence_ids=support_ids,
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_crypto_B",
                name="Theory B: Microarchitectural Memory Bus Stall Overhead",
                statement="Constant-time instruction scheduling induces catastrophic memory pipeline stalls on resource-constrained embedded cores.",
                mechanism="Uncached register spill pressure during polynomial coefficient accumulation.",
                prior_probability=0.25,
                supporting_evidence_ids=[],
                contradicting_evidence_ids=support_ids,
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_crypto_C",
                name="Theory C: Speculative Transient Execution Leakage",
                statement="Reported constant-time safety is bypassed by speculative transient execution ALU contention, leaking secret polynomial coefficients.",
                mechanism="Speculative window cache port contention in out-of-order execution buffers.",
                prior_probability=0.20,
                supporting_evidence_ids=contradiction_ids,
                contradicting_evidence_ids=[],
            )
        )
    else:
        theories.append(
            CompetingTheory(
                theory_id="theory_gen_A",
                name="Theory A: Hypothesized Causal Variable",
                statement=f"The primary effect is driven directly by {mission.objective}.",
                mechanism="Direct causal intervention on domain target state.",
                prior_probability=0.50,
                supporting_evidence_ids=support_ids,
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_gen_B",
                name="Theory B: Latent Confounding Interaction",
                statement="The effect is driven by an unmodeled secondary environmental or algorithmic variable.",
                mechanism="Latent covariate interaction.",
                prior_probability=0.30,
                supporting_evidence_ids=[],
                contradicting_evidence_ids=[],
            )
        )
        theories.append(
            CompetingTheory(
                theory_id="theory_gen_C",
                name="Theory C: Measurement Instrument Noise",
                statement="The observed effect size is statistically indistinguishable from instrument noise or sampling variance.",
                mechanism="Stochastic sampling fluctuation.",
                prior_probability=0.20,
                supporting_evidence_ids=contradiction_ids,
                contradicting_evidence_ids=[],
            )
        )

    return theories


def generate_candidate_experiments(
    theories: List[CompetingTheory],
    mission: ResearchMission,
) -> List[DiscriminatingExperiment]:
    """
    Generates candidate discriminating experiments tailored to isolate the competing theories.
    Calculates exact VOI score U(e) = E[Delta R] / (C(e) + lambda * T(e)).
    """
    domain = mission.target_domain
    candidates: List[DiscriminatingExperiment] = []

    if domain == "AUDIO_ENGINEERING":
        # Exp 1: Direct RVQ Layer Ablation
        e1_delta_r = 0.65
        e1_cost = 450_000_000  # $0.45 USD
        e1_time = 3.2
        e1_voi = calculate_voi_score(e1_delta_r, e1_cost, e1_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_audio_rvq_ablation",
                name="Progressive RVQ Layer Ablation vs Linear Masking",
                hypothesis_addressed="Theory A vs Theory B",
                proposed_protocol="Ablate codebooks 4 through 8 while injecting linear predictive filter; measure ViSQOL audio degradation on held-out clean and noisy samples.",
                expected_delta_r=e1_delta_r,
                expected_cost_nanos=e1_cost,
                expected_time_sec=e1_time,
                voi_score=e1_voi,
                simulated_outcomes={
                    "Theory_A_predicted_degradation": 0.38,
                    "Theory_B_predicted_degradation": 0.06,
                },
            )
        )

        # Exp 2: Babble Noise & Real Acoustic Stress Test (Anti-Artifact)
        e2_delta_r = 0.82
        e2_cost = 850_000_000  # $0.85 USD
        e2_time = 5.0
        e2_voi = calculate_voi_score(e2_delta_r, e2_cost, e2_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_audio_acoustic_stress",
                name="Adversarial Non-Stationary Noise & Phase Coherence Test",
                hypothesis_addressed="Theory A & B vs Theory C (Measurement Artifact)",
                proposed_protocol="Evaluate PESQ/ViSQOL across 10 SNR levels (-5dB to +20dB) with multi-talker babble; compute instantaneous phase error variance.",
                expected_delta_r=e2_delta_r,
                expected_cost_nanos=e2_cost,
                expected_time_sec=e2_time,
                voi_score=e2_voi,
                simulated_outcomes={
                    "Theory_A_phase_variance": 0.12,
                    "Theory_C_phase_variance": 0.89,
                },
            )
        )

        # Exp 3: Hardware Micro-Benchmark (High Cost / Low Delta R)
        e3_delta_r = 0.25
        e3_cost = 2_500_000_000  # $2.50 USD
        e3_time = 14.0
        e3_voi = calculate_voi_score(e3_delta_r, e3_cost, e3_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_audio_hw_power_cycle",
                name="Physical Power Profiler Thermal Cycle Sweep",
                hypothesis_addressed="Theory A hardware efficiency boundary",
                proposed_protocol="Continuous 48-hour hardware power draw measurement on physical ARM Cortex-A55 dev board.",
                expected_delta_r=e3_delta_r,
                expected_cost_nanos=e3_cost,
                expected_time_sec=e3_time,
                voi_score=e3_voi,
                simulated_outcomes={"mean_power_mw": 48.2},
            )
        )

    elif domain == "BIOTECHNOLOGY":
        # Exp 1: Salt-Concentration Dependency Assay
        e1_delta_r = 0.74
        e1_cost = 600_000_000  # $0.60 USD
        e1_time = 4.0
        e1_voi = calculate_voi_score(e1_delta_r, e1_cost, e1_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_bio_salt_ionic_titration",
                name="Ionic Strength Dependent Affinity Titration",
                hypothesis_addressed="Theory A (Shape) vs Theory B (Charge)",
                proposed_protocol="Measure binding affinity across NaCl concentrations (50mM to 1000mM). Electrostatic binding collapses at high salt; shape complementarity persists.",
                expected_delta_r=e1_delta_r,
                expected_cost_nanos=e1_cost,
                expected_time_sec=e1_time,
                voi_score=e1_voi,
                simulated_outcomes={
                    "Theory_A_affinity_retention": 0.88,
                    "Theory_B_affinity_retention": 0.15,
                },
            )
        )

        # Exp 2: Size Exclusion Chromatography Multi-Angle Light Scattering (SEC-MALS)
        e2_delta_r = 0.85
        e2_cost = 950_000_000  # $0.95 USD
        e2_time = 6.2
        e2_voi = calculate_voi_score(e2_delta_r, e2_cost, e2_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_bio_sec_mals_monomer",
                name="SEC-MALS Oligomerization & Monodispersity Verification",
                hypothesis_addressed="Theory A vs Theory C (Aggregation Artifact)",
                proposed_protocol="Analyze solution molecular weight via SEC-MALS to rule out multivalent avidity artifacts.",
                expected_delta_r=e2_delta_r,
                expected_cost_nanos=e2_cost,
                expected_time_sec=e2_time,
                voi_score=e2_voi,
                simulated_outcomes={
                    "Theory_A_monomer_fraction": 0.97,
                    "Theory_C_monomer_fraction": 0.42,
                },
            )
        )
    elif domain == "MATERIALS_SCIENCE":
        e1_delta_r = 0.78
        e1_cost = 700_000_000  # $0.70 USD
        e1_time = 4.2
        e1_voi = calculate_voi_score(e1_delta_r, e1_cost, e1_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_mat_operando_tomography",
                name="Operando Synchrotron X-ray Interface Tomography under Fast Discharge (>2C)",
                hypothesis_addressed="Theory A vs Theory C (Mechanical Void Artifact)",
                proposed_protocol="Map 3D void evolution and contact area loss across 100 fast discharge cycles with sub-micron spatial resolution.",
                expected_delta_r=e1_delta_r,
                expected_cost_nanos=e1_cost,
                expected_time_sec=e1_time,
                voi_score=e1_voi,
                simulated_outcomes={
                    "Theory_A_contact_loss_pct": 4.2,
                    "Theory_C_contact_loss_pct": 38.5,
                },
            )
        )

        e2_delta_r = 0.68
        e2_cost = 550_000_000  # $0.55 USD
        e2_time = 3.8
        e2_voi = calculate_voi_score(e2_delta_r, e2_cost, e2_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_mat_solvent_trace_gcms",
                name="Thermal Desorption GC-MS & Critical Current Density Titration",
                hypothesis_addressed="Theory A vs Theory B (Trace Solvent Facilitation)",
                proposed_protocol="Quantify residual polar solvent down to 5 ppm using GC-MS and correlate with low-temperature critical current density.",
                expected_delta_r=e2_delta_r,
                expected_cost_nanos=e2_cost,
                expected_time_sec=e2_time,
                voi_score=e2_voi,
                simulated_outcomes={
                    "Theory_A_solvent_ppm": 2.0,
                    "Theory_B_solvent_ppm": 140.0,
                },
            )
        )

    elif domain == "CRYPTOGRAPHY":
        e1_delta_r = 0.82
        e1_cost = 650_000_000  # $0.65 USD
        e1_time = 3.6
        e1_voi = calculate_voi_score(e1_delta_r, e1_cost, e1_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_crypto_dudect_trace_leakage",
                name="Welch's t-Test Non-Specific Leakage Detection (Dudect 1M Traces)",
                hypothesis_addressed="Theory A vs Theory B",
                proposed_protocol="Collect 1,000,000 power and EM traces during constant-time ML-DSA verification; compute Welch's t-test statistic over entire time series.",
                expected_delta_r=e1_delta_r,
                expected_cost_nanos=e1_cost,
                expected_time_sec=e1_time,
                voi_score=e1_voi,
                simulated_outcomes={
                    "Theory_A_max_t_stat": 2.8,
                    "Theory_B_max_t_stat": 18.4,
                },
            )
        )

        e2_delta_r = 0.88
        e2_cost = 900_000_000  # $0.90 USD
        e2_time = 5.2
        e2_voi = calculate_voi_score(e2_delta_r, e2_cost, e2_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_crypto_speculative_alu_injection",
                name="Speculative Pipeline Transient Shadow Register Key Recovery Test",
                hypothesis_addressed="Theory A vs Theory C (Speculative Execution Leakage)",
                proposed_protocol="Inject mispredicted branch triggers before NTT multiplication; observe transient ALU contention cache hits via Prime+Probe.",
                expected_delta_r=e2_delta_r,
                expected_cost_nanos=e2_cost,
                expected_time_sec=e2_time,
                voi_score=e2_voi,
                simulated_outcomes={
                    "Theory_A_cache_leakage_rate": 0.001,
                    "Theory_C_cache_leakage_rate": 0.420,
                },
            )
        )
    else:
        # Generic Domain Experiments
        e1_delta_r = 0.60
        e1_cost = 300_000_000  # $0.30 USD
        e1_time = 2.5
        e1_voi = calculate_voi_score(e1_delta_r, e1_cost, e1_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_gen_cross_validation",
                name="Stratified Held-Out Cross Validation with Negative Controls",
                hypothesis_addressed="Theory A vs Theory B",
                proposed_protocol="Evaluate intervention across 5 distinct held-out partitions with randomized permutation negative controls.",
                expected_delta_r=e1_delta_r,
                expected_cost_nanos=e1_cost,
                expected_time_sec=e1_time,
                voi_score=e1_voi,
                simulated_outcomes={"effect_size_f": 0.45},
            )
        )

        e2_delta_r = 0.75
        e2_cost = 500_000_000  # $0.50 USD
        e2_time = 3.5
        e2_voi = calculate_voi_score(e2_delta_r, e2_cost, e2_time)
        candidates.append(
            DiscriminatingExperiment(
                experiment_id="exp_gen_instrument_artifact_probe",
                name="Calibrated Null-Input Instrument Noise Profiling",
                hypothesis_addressed="Theory A vs Theory C (Measurement Artifact)",
                proposed_protocol="Feed pure synthetic null inputs and measure false positive discovery rate under identical detection pipeline.",
                expected_delta_r=e2_delta_r,
                expected_cost_nanos=e2_cost,
                expected_time_sec=e2_time,
                voi_score=e2_voi,
                simulated_outcomes={"null_false_positive_rate": 0.02},
            )
        )

    # Rank candidate experiments strictly by VOI score descending
    candidates.sort(key=lambda x: x.voi_score, reverse=True)
    return candidates


def select_minimal_discriminating_set(
    experiments: List[DiscriminatingExperiment],
    max_budget_nanos: int,
    target_uncertainty_reduction: float = 0.70,
) -> List[DiscriminatingExperiment]:
    """
    Selects the minimal, highest-VOI set of experiments that achieves
    the target uncertainty reduction without exceeding the exact NanoUSD budget.
    Guards edge cases: zero or negative target reduction or non-positive budget returns empty list.
    """
    if target_uncertainty_reduction <= 0.0 or max_budget_nanos <= 0:
        return []

    selected: List[DiscriminatingExperiment] = []
    accumulated_cost = 0
    accumulated_delta_r = 0.0

    # Ensure we sort by VOI score
    sorted_exps = sorted(experiments, key=lambda e: e.voi_score, reverse=True)

    for exp in sorted_exps:
        if accumulated_cost + exp.expected_cost_nanos > max_budget_nanos:
            continue

        selected.append(exp)
        accumulated_cost += exp.expected_cost_nanos
        # Diminishing returns on overlapping uncertainty: (1 - cumulative_unresolved)
        accumulated_delta_r += exp.expected_delta_r * (1.0 - min(accumulated_delta_r, 0.95))

        if accumulated_delta_r >= target_uncertainty_reduction:
            break

    return selected
