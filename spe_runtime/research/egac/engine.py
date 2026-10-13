"""
SPE Ω — Unified EGAC-1 Engine Orchestrator
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
import re
from typing import Dict, List, Optional, Any

from spe_runtime.research.egac.types import (
    ExperienceLevel,
    InformationClass,
    OptimizationCandidate,
    ConservationStatus,
    TechniqueType,
    VsodMetrics,
    EGACE01Result,
)
from spe_runtime.research.egac.semantic_conservation import SemanticConservationSystem
from spe_runtime.research.egac.compute_allocation import ValueOfInformationAllocator
from spe_runtime.research.egac.counterfactual_optimizer import CounterfactualOptimizer
from spe_runtime.research.egac.technique_evaluator import TechniqueEvaluator
from spe_runtime.research.egac.vsod_calculator import VsodCalculator

class SpeEgacEngine:
    """
    Unified SPE Ω Evidence-Gated Adaptive Compute (EGAC-1) Orchestrator.
    Controls the complete inference-optimization lifecycle across
    Mechanism A, Mechanism B, Mechanism C, and the 8-Technique catalog.
    """

    def __init__(self):
        self.conservation_system = SemanticConservationSystem()
        self.allocator = ValueOfInformationAllocator()
        self.counterfactual_optimizer = CounterfactualOptimizer()
        self.technique_evaluator = TechniqueEvaluator()
        self.vsod_calculator = VsodCalculator()

    def estimate_difficulty(self, prompt: str) -> float:
        """
        Calibrates difficulty based on conceptual and structural density,
        rejecting naive token length heuristics.
        """
        lower = prompt.lower()
        score = 0.2

        if re.search(r"(proof|theorem|formal|verification|lean 4|math)", lower):
            score += 0.35
        if re.search(r"(security|cryptographic|sha256|exploit|sandbox|egress)", lower):
            score += 0.25
        if re.search(r"(quantum|hamiltonian|differential|dispersion)", lower):
            score += 0.30
        if re.search(r"(architecture|microservice|concurrency|distributed)", lower):
            score += 0.15

        return min(1.0, score)

    def analyze_task(
        self,
        prompt: str,
        experience_level: ExperienceLevel = ExperienceLevel.EXPERT,
        is_long_form: bool = False,
        custom_invariants: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Analyzes prompt structure, classifies 5 information classes,
        and plans execution strategy.
        """
        nodes = self.conservation_system.classify_nodes(prompt, custom_invariants)
        diff_score = self.estimate_difficulty(prompt)
        strategy = self.allocator.plan_strategy(
            objective=prompt,
            experience_level=experience_level,
            difficulty_score=diff_score,
        )

        class_counts = {
            cls.value: sum(1 for n in nodes if n.classification == cls)
            for cls in InformationClass
        }

        return {
            "prompt": prompt,
            "experience_level": experience_level.value,
            "difficulty_score": round(diff_score, 2),
            "strategy": strategy,
            "nodes_count": len(nodes),
            "class_distribution": class_counts,
            "nodes": nodes,
        }

    def optimize_prompt(
        self,
        prompt: str,
        technique: TechniqueType,
        experience_level: ExperienceLevel = ExperienceLevel.EXPERT,
        is_long_form: bool = False,
        auth_scope: str = "tenant_production",
        custom_invariants: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        Applies a candidate optimization and subjects it to both
        Mechanism A (conservation) and Mechanism C (counterfactual tests).
        """
        # Step 1: Semantic classification
        nodes = self.conservation_system.classify_nodes(prompt, custom_invariants)

        # Step 2: Apply technique candidate
        candidate = self.technique_evaluator.apply_technique(
            technique=technique,
            source_text=prompt,
            is_long_form=is_long_form,
            auth_scope=auth_scope,
        )

        # Step 3: Mechanism A Conservation Verification
        candidate = self.conservation_system.validate_candidate(candidate, nodes)

        # Step 4: Mechanism C Counterfactual Adversarial Probing
        adv_scenarios = self.counterfactual_optimizer.generate_adversarial_suite(candidate)
        adv_results = self.counterfactual_optimizer.evaluate_scenarios(candidate, adv_scenarios)

        failed_adversarial = [s for s in adv_results if not s.passed]
        if failed_adversarial:
            candidate.status = ConservationStatus.VIOLATED
            candidate.rejection_reason = (
                (candidate.rejection_reason or "") + " " +
                "; ".join(f"[{f.name}: {f.details}]" for f in failed_adversarial)
            ).strip()

        # Step 5: Compute VSOD Metrics
        baseline_cost_nanos = len(prompt.split()) * 1500
        transformed_tokens = len(candidate.transformed_content.split())
        candidate_cost_nanos = transformed_tokens * 1500

        vsod = self.vsod_calculator.calculate_vsod(
            n_verified_successes=1 if candidate.status == ConservationStatus.CONSERVED else 0,
            total_cost_nanos=candidate_cost_nanos,
            tokens_saved=max(0, len(prompt.split()) - transformed_tokens),
            latency_p95_ms=120,
            critical_failures=len(failed_adversarial),
        )

        return {
            "candidate": candidate,
            "is_approved": candidate.status == ConservationStatus.CONSERVED,
            "rejection_reason": candidate.rejection_reason,
            "adversarial_scenarios": adv_results,
            "failed_scenarios_count": len(failed_adversarial),
            "diff": candidate.diff,
            "vsod_metrics": vsod,
        }

    def run_e01_experiment(self) -> EGACE01Result:
        """Runs the EGAC-E01 JSON Minification controlled experiment."""
        return self.technique_evaluator.run_egac_e01_experiment()
