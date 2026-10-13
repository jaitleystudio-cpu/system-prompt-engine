"""
SPE AGI BRAIN Ω — Scientific Prompt-Engineering Contract
October 12, 2026 | Research Quarantine Track
"""

from typing import Dict, Any, List, Optional
from spe_runtime.research.agi_brain.types import (
    ScientificPromptContract,
    VerificationStatus,
    ScientificObjective,
    InventionCandidate,
    VerificationResult,
)

class ScientificPromptContractCompiler:
    """
    Compiles user requests into structured 6-part scientific deliverables:
    1. Original Objective
    2. Optimized Scientific Task Specification
    3. Research & Execution Record
    4. Material Improvement Rationale
    5. Final Deliverable
    6. Verification Status
    """

    def compile_contract(
        self,
        objective: ScientificObjective,
        candidate: Optional[InventionCandidate] = None,
        verification: Optional[VerificationResult] = None,
        custom_deliverable: Optional[str] = None,
    ) -> ScientificPromptContract:
        # 1. Original Objective
        orig = objective.frozen_intent or objective.description

        # 2. Optimized Specification preserving hard constraints
        constraints_str = (
            "\n".join(f"- {c}" for c in objective.hard_constraints)
            if objective.hard_constraints
            else "- Standard scientific validity & exact mathematical invariants"
        )
        spec = (
            f"Domain: {objective.domain.value}\n"
            f"Operational Goal: {objective.description}\n"
            f"Mandatory Invariants:\n{constraints_str}"
        )

        # 3. Research & Execution Record
        strat_name = candidate.strategy.value if candidate else "FIRST_PRINCIPLES"
        rec = (
            f"Exploration Strategy: {strat_name}\n"
            f"Hypothesis Investigated: {candidate.hypothesis_statement if candidate else 'Default Axiomatic Derivation'}\n"
            f"Mechanism Tested: {candidate.mechanism if candidate else 'Deterministic baseline'}"
        )

        # 4. Material Improvement Rationale
        rationale = (
            "1. Multi-strategy hypothesis generation prevents premature convergence.\n"
            "2. Executable simulation models decouple predictions from observations.\n"
            "3. Mechanical Lean 4 and property checks eliminate hallucinated proofs.\n"
            "4. Truth conservation guarantees explicit UNKNOWN status over false certainty."
        )

        # 5. Final Deliverable
        if custom_deliverable:
            deliverable = custom_deliverable
        elif candidate:
            deliverable = (
                f"# Scientific Discovery Deliverable: {objective.description}\n\n"
                f"## Core Mechanism\n{candidate.mechanism}\n\n"
                f"## Formal Model\n{candidate.hypothesis_statement}\n\n"
                f"## Parameters & Invariants\nFeasibility: {candidate.feasibility_score:.2f} | "
                f"Novelty: {candidate.novelty_score:.2f} | "
                f"Testability: {candidate.testability_score:.2f}"
            )
        else:
            deliverable = f"# Baseline Research Package: {objective.description}"

        # 6. Verification Status
        status = verification.status if verification else VerificationStatus.UNKNOWN

        return ScientificPromptContract(
            original_objective=orig,
            optimized_specification=spec,
            execution_record=rec,
            material_improvement_rationale=rationale,
            final_deliverable=deliverable,
            verification_status=status,
        )

    def render_markdown(self, contract: ScientificPromptContract) -> str:
        """Renders the contract into clean, publication-grade markdown."""
        return (
            f"## 1. Original Objective\n{contract.original_objective}\n\n"
            f"## 2. Optimized Task Specification\n{contract.optimized_specification}\n\n"
            f"## 3. Research and Execution Record\n{contract.execution_record}\n\n"
            f"## 4. Why This Approach Is Materially Stronger\n{contract.material_improvement_rationale}\n\n"
            f"## 5. Final Scientific Deliverable\n{contract.final_deliverable}\n\n"
            f"## 6. Verification Status\n**Status**: `{contract.verification_status.value}`\n"
        )
