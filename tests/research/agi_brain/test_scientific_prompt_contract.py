"""
Unit Tests for Scientific Prompt-Engineering Contract
"""

import pytest
from spe_runtime.research.agi_brain.types import (
    ScientificObjective,
    DomainType,
    InventionCandidate,
    InventionStrategy,
    VerificationResult,
    VerificationStatus,
)
from spe_runtime.research.agi_brain.prompt_contract import ScientificPromptContractCompiler

def test_compilation_of_six_part_contract():
    compiler = ScientificPromptContractCompiler()
    objective = ScientificObjective(
        objective_id="obj-opt",
        description="Develop sparse-attention kernel with linear memory complexity",
        domain=DomainType.COMPUTER_SCIENCE,
        frozen_intent="Linear attention kernel with O(N) memory",
        hard_constraints=["memory <= O(N)", "gradient_check == PASS"],
    )
    candidate = InventionCandidate(
        candidate_id="c-cs",
        strategy=InventionStrategy.FIRST_PRINCIPLES,
        hypothesis_statement="Kernel decomposition into low-rank random Fourier features.",
        mechanism="Linearized kernel map avoiding full N x N matrix instantiation.",
        feasibility_score=0.92,
        novelty_score=0.85,
        testability_score=1.00,
        prior_art_overlap=0.20,
    )
    verification = VerificationResult(
        result_id="vr-cs",
        candidate_id="c-cs",
        status=VerificationStatus.VERIFIED,
        formal_proof_verified=True,
    )

    contract = compiler.compile_contract(objective, candidate, verification)
    assert "Linear attention kernel" in contract.original_objective
    assert "Operational Goal" in contract.optimized_specification
    assert "memory <= O(N)" in contract.optimized_specification
    assert "FIRST_PRINCIPLES" in contract.execution_record
    assert len(contract.material_improvement_rationale) > 20
    assert contract.verification_status == VerificationStatus.VERIFIED

    md = compiler.render_markdown(contract)
    assert "## 1. Original Objective" in md
    assert "## 2. Optimized Task Specification" in md
    assert "## 3. Research and Execution Record" in md
    assert "## 4. Why This Approach Is Materially Stronger" in md
    assert "## 5. Final Scientific Deliverable" in md
    assert "## 6. Verification Status" in md
    assert "**Status**: `VERIFIED`" in md
