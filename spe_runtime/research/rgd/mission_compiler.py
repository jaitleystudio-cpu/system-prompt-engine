"""
SPE Ω PRO — Research Mission Compiler (RGD-1)
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import hashlib
import time
from typing import List, Optional
from spe_runtime.research.rgd.types import (
    ResearchMission,
    ResponseSpeedClass,
    NANOS_PER_USD,
)


def _detect_domain(prompt: str) -> str:
    lower = prompt.lower()
    if any(k in lower for k in ["codec", "audio", "sound", "compression", "mp3", "aac", "opus"]):
        return "AUDIO_ENGINEERING"
    if any(k in lower for k in ["protein", "dna", "rna", "crispr", "gene", "biology", "enzyme", "cell"]):
        return "BIOTECHNOLOGY"
    if any(k in lower for k in ["battery", "polymer", "graphene", "superconductor", "material", "semiconductor"]):
        return "MATERIALS_SCIENCE"
    if any(k in lower for k in ["quantum", "qubit", "superposition", "photonics"]):
        return "QUANTUM_PHYSICS"
    if any(k in lower for k in ["cipher", "cryptography", "zero-knowledge", "zk-snark", "elliptic", "hash"]):
        return "CRYPTOGRAPHY"
    if any(k in lower for k in ["transformer", "llm", "neural", "attention", "gradient", "diffusion"]):
        return "MACHINE_LEARNING"
    return "GENERAL_SCIENCE"


def _extract_measurable_constraints(prompt: str, domain: str) -> List[str]:
    constraints: List[str] = [
        "Zero-hallucination citation mandate: All DOIs and source records must independently resolve.",
        "Reproducibility: Protocols must specify exact input datasets, seeds, and execution environments.",
    ]
    lower = prompt.lower()
    if domain == "AUDIO_ENGINEERING":
        constraints.extend([
            "Algorithmic algorithmic latency <= 20.0 ms for interactive communications.",
            "Target bit rate <= 32 kbps with MOS (Mean Opinion Score) degradation <= 0.2 vs uncompressed.",
            "Energy envelope: Execution budget <= 150 mW on ARM Cortex-A55 mobile cores.",
            "Deterministic decoding: Exact bit-level reproducibility across cross-compilation targets.",
        ])
    elif domain == "BIOTECHNOLOGY":
        constraints.extend([
            "Thermostability delta Tm >= +4.5 °C without loss of binding affinity (Kd <= 10 nM).",
            "Immunogenicity risk score <= 0.15 on humanized in-silico screening.",
            "Synthesis viability: Sequence complexity score within standard oligo pool bounds.",
        ])
    elif domain == "MATERIALS_SCIENCE":
        constraints.extend([
            "Volumetric energy density >= 750 Wh/L under 1C discharge rate.",
            "Thermal runaway threshold >= 180 °C with self-passivating solid electrolyte interface.",
            "Raw material availability: Exclude conflict minerals and elements with scarcity index > 0.8.",
        ])
    elif domain == "CRYPTOGRAPHY":
        constraints.extend([
            "Post-quantum security: Security level >= NIST Level 3 (AES-192 equivalent).",
            "Proof verification time <= 10 ms on standard commodity mobile hardware.",
            "Zero side-channel leakage: Constant-time execution invariant verified via AST inspection.",
        ])
    else:
        constraints.extend([
            "Empirical significance: p-value < 0.01 with Cohen's d >= 0.8 on primary outcome.",
            "Uncertainty quantification: Minimum 95% bootstrap confidence intervals on all measurements.",
        ])

    # If prompt specifies explicit numbers, capture them
    if "efficient" in lower or "efficiency" in lower:
        constraints.append("Resource efficiency improvement >= 20% over state-of-the-art baseline.")
    if "latency" in lower or "real-time" in lower or "speed" in lower:
        constraints.append("End-to-end processing latency bounded by sub-human perception threshold.")

    return constraints


def _identify_unresolved_assumptions(prompt: str, domain: str) -> List[str]:
    assumptions: List[str] = []
    lower = prompt.lower()

    if domain == "AUDIO_ENGINEERING":
        assumptions.extend([
            "Assumed target audio sample rate: 48 kHz standard vs 44.1 kHz legacy.",
            "Assumed perceptual loss metric: ViSQOL audio quality metric vs PESQ.",
            "Assumed compute target: Mobile NPU acceleration availability vs pure CPU fallback.",
            "Assumed intellectual property boundary: Clean-room implementation avoiding patented transform matrices.",
        ])
    elif domain == "BIOTECHNOLOGY":
        assumptions.extend([
            "Assumed expression system: Pichia pastoris vs CHO mammalian cells.",
            "Assumed glycosylation requirement for functional conformation.",
            "Assumed off-target binding tolerance in homologous human proteome.",
        ])
    elif domain == "MATERIALS_SCIENCE":
        assumptions.extend([
            "Assumed ambient operating temperature range: -20 °C to +60 °C.",
            "Assumed cycle life target: 1,500 full charge cycles at 80% capacity retention.",
            "Assumed manufacturing scalability: Roll-to-roll coating compatibility.",
        ])
    else:
        assumptions.extend([
            "Assumed prior distribution over baseline model parameter spaces.",
            "Assumed availability of high-fidelity executable numerical simulators.",
            "Assumed licensing rights for underlying benchmark validation datasets.",
        ])

    # Detect user specificity
    if "mobile" in lower and "battery" not in lower:
        assumptions.append("Assumed mobile thermal throttle ceiling without active fan cooling.")

    return assumptions


def _compile_system_prompt(
    objective: str,
    domain: str,
    constraints: List[str],
    assumptions: List[str],
    speed_class: ResponseSpeedClass,
) -> str:
    constraints_str = "\n".join(f"  - [C{i+1}] {c}" for i, c in enumerate(constraints))
    assumptions_str = "\n".join(f"  - [A{i+1}] {a}" for i, a in enumerate(assumptions))

    return (
        f"# SPE Ω PRO SCIENTIFIC RESEARCH MISSION CONTRACT\n"
        f"Domain: {domain} | Response Speed Class: {speed_class.value}\n\n"
        f"## PRIMARY SCIENTIFIC OBJECTIVE\n"
        f"{objective}\n\n"
        f"## MEASURABLE HARD CONSTRAINTS\n"
        f"{constraints_str}\n\n"
        f"## UNRESOLVED ASSUMPTIONS (MUST BE PROBED, NEVER FABRICATED)\n"
        f"{assumptions_str}\n\n"
        f"## REALITY-GROUNDED DISCOVERY DIRECTIVES\n"
        f"1. Extract standardized 11-field evidence from all indexed papers.\n"
        f"2. Explicitly map contradictions and methodological limitations.\n"
        f"3. Generate competing explanations (Theories A, B, C) and compile minimal discriminating experiments.\n"
        f"4. Optimize experiments via Bayesian VOI: U(e) = Delta R / (C(e) + lambda * T(e)) in exact NanoUSD.\n"
        f"5. Issue Research Verification Certificates with SHA-256 seals. Never promote NOT_VERIFIED to SUPPORTED.\n"
        f"6. Preserved intent is immutable. No silent truncation."
    )


def _generate_execution_plan(domain: str, speed_class: ResponseSpeedClass) -> List[str]:
    base_plan = [
        "Stage 1: Intent Reconstruction & Boundary Formulation — parse constraints and catalog unknowns.",
        "Stage 2: Global Scholarly Discovery — federated search across 400M+ catalog (OpenAlex Core & Expansion).",
        "Stage 3: 11-Field Literature Reconstruction — extract structured evidence, population, and statistical bounds.",
        "Stage 4: Queryable Evidence Graph Synthesis — link nodes with SUPPORT, CONTRADICTION, and UNKNOWN edges.",
        "Stage 5: Counterfactual Discovery Compilation — identify competing hypotheses and minimal discriminating experiments.",
        "Stage 6: Bayesian VOI Experiment Optimization — rank candidate experiments by U(e) in exact NanoUSD.",
        "Stage 7: Research Verification Certificate (RVC) Generation — cryptographically seal claim proofs with SHA-256.",
        "Stage 8: Compounding Capability Integration — qualify reusable procedures via LVT transfer gates & CSC checks.",
    ]
    if speed_class == ResponseSpeedClass.INSTANT_DISCOVERY:
        return base_plan[:3] + ["Stage 4-Fast: Output ranked records and preliminary concept graph (1-3s)."]
    if speed_class == ResponseSpeedClass.EVIDENCE_ANSWER:
        return base_plan[:5] + ["Stage 7-Fast: Deliver grounded claim answer with verified DOIs and explicit limits (5-15s)."]
    return base_plan + ["Stage 9: Persistent 100k-Word Deep Research Manuscript Generation with Section Checkpointing."]


def compile_research_mission(
    raw_prompt: str,
    domain: Optional[str] = None,
    speed_class: ResponseSpeedClass = ResponseSpeedClass.EVIDENCE_ANSWER,
    budget_nanos: int = 10_000_000_000,
) -> ResearchMission:
    """
    Compiles an arbitrary scientific request into a structured ResearchMission.
    Resolves trade-offs, identifies measurable constraints, and isolates unresolved assumptions.
    """
    cleaned = raw_prompt.strip()
    target_domain = domain if domain else _detect_domain(cleaned)
    constraints = _extract_measurable_constraints(cleaned, target_domain)
    assumptions = _identify_unresolved_assumptions(cleaned, target_domain)
    compiled_prompt = _compile_system_prompt(cleaned, target_domain, constraints, assumptions, speed_class)
    execution_plan = _generate_execution_plan(target_domain, speed_class)

    mission_id = f"mission_{hashlib.sha256(cleaned.encode('utf-8')).hexdigest()[:12]}"

    return ResearchMission(
        mission_id=mission_id,
        objective=cleaned,
        target_domain=target_domain,
        measurable_constraints=constraints,
        unresolved_assumptions=assumptions,
        compiled_prompt=compiled_prompt,
        execution_plan=execution_plan,
        speed_class=speed_class,
        created_at=time.time(),
        budget_nanos=budget_nanos,
    )
