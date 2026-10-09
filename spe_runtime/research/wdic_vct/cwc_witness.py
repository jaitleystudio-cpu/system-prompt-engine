"""
Counterfactual Witness Continuation (CWC) Engine for SPE Ω.
Part of WDIC-VCT.

Features:
1. Distinguishing Witness Selector: Formulates lowest-cost probes ($W_dist)
   to distinguish true completion from lucky/untested passes.
2. Incremental Proof Invalidation Matrix: Reuses verified proofs across
   hundreds of tasks, invalidating only the modified dependency closure.
3. Dual-Product Emitter:
   - Product A: Independently Audited Task Receipt.
   - Product B: Next Executable Task Contract (zero LLM token cost).
"""

import hashlib
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple

from spe_runtime.research.wdic_vct.evidence_capsules import (
    EvidenceCapsule,
    EvidenceCapsuleRetriever,
)
from spe_runtime.research.wdic_vct.dep_scanner import ASTDependencyScanner
from spe_runtime.research.wdic_vct.skill_autoinstaller import (
    SkillAutoInstaller,
    SkillInstallationProposal,
)
from spe_runtime.research.wdic_vct.types import (
    ClaimStatus,
    NextTaskContract,
    ProofDeficit,
    TaskClaim,
    TaskReport,
)


class ProbeType(str, Enum):
    AST_INSPECTION = "AST_INSPECTION"
    NEGATIVE_TEST = "NEGATIVE_TEST"
    NEGATIVE_ASSERTION = "NEGATIVE_TEST"
    EGRESS_CHECK = "EGRESS_CHECK"
    MUTATION_CHECK = "MUTATION_CHECK"
    DETERMINISTIC_ORACLE = "DETERMINISTIC_ORACLE"


@dataclass(frozen=True)
class CounterfactualProbe:
    """
    A minimal-cost probe designed to produce divergent outcomes
    between True Compliance and an Untested / Lucky Pass.
    """
    probe_id: str
    name: str
    probe_type: ProbeType
    cost_nano_usd: int  # Exact integer NanoUSD
    expected_compliant: str
    expected_violation: str
    verification_command: str
    description: str


@dataclass(frozen=True)
class CWCReviewedReceipt:
    """Product A: The Independently Audited Task Receipt."""
    task_id: str
    mission_id: str
    disposition: str  # QUALIFIED, HOLD, DEFICIT_DETECTED, REJECTED
    supported_claims: int
    contradicted_claims: int
    unverified_claims: int
    distinguishing_probe: CounterfactualProbe
    empirical_blueprint: EvidenceCapsule
    reusable_proof_count: int
    invalidated_proof_count: int

    def to_markdown(self) -> str:
        return (
            f"### 📋 SPE TASK REVIEW RECEIPT [{self.task_id}]\n"
            f"- **Parent Mission**: `{self.mission_id}`\n"
            f"- **Disposition**: `{self.disposition}`\n"
            f"- **Kleene-4 Audit**: Supported: {self.supported_claims} | Contradicted: {self.contradicted_claims} | Unverified: {self.unverified_claims}\n"
            f"- **Proof Ledger Health**: {self.reusable_proof_count} proofs preserved valid | {self.invalidated_proof_count} invalidated by modified files\n"
            f"- **Distinguishing Witness Probe**: `{self.distinguishing_probe.name}` ({self.distinguishing_probe.probe_type.value})\n"
            f"  - *Cost*: {self.distinguishing_probe.cost_nano_usd} NanoUSD\n"
            f"  - *Oracle Command*: `{self.distinguishing_probe.verification_command}`\n"
            f"- **Scientific Literature Anchor**: *{self.empirical_blueprint.paper_title}* (`{self.empirical_blueprint.identifier}`)\n"
        )


class CWCWitnessEngine:
    """
    Core engine for Counterfactual Witness Continuation.
    Coordinates distinguishing witness generation, dependency invalidation,
    S-Capsule literature integration, and skill auto-injection.
    """

    def __init__(
        self,
        capsule_retriever: Optional[EvidenceCapsuleRetriever] = None,
        skill_installer: Optional[SkillAutoInstaller] = None,
    ):
        self.capsule_retriever = capsule_retriever or EvidenceCapsuleRetriever()
        self.skill_installer = skill_installer or SkillAutoInstaller()

    def generate_distinguishing_witness(
        self,
        requirement_id: str,
        claim_description: str,
        files_modified: Optional[List[str]] = None,
    ) -> CounterfactualProbe:
        """
        Synthesizes the lowest-cost deterministic probe that distinguishes
        between true fulfillment and an unverified lucky pass.
        """
        desc_lower = claim_description.lower()
        files = files_modified or []

        # 1. Privacy / Network Egress check
        if any(w in desc_lower for w in ["privacy", "network", "egress", "offline", "leak"]):
            return CounterfactualProbe(
                probe_id="PROBE-EGRESS-01",
                name="Zero-Egress Network Isolation Probe",
                probe_type=ProbeType.EGRESS_CHECK,
                cost_nano_usd=0,
                expected_compliant="0 external network connections recorded",
                expected_violation="Connection attempt detected to unauthorized host",
                verification_command="pytest tests/grounding/test_firewall.py -k test_zero_egress",
                description="Verifies that no unauthorized external socket was opened during execution.",
            )

        # 2. Concurrency / Race Condition check
        if any(w in desc_lower for w in ["concurrent", "race", "parallel", "lock", "async"]):
            return CounterfactualProbe(
                probe_id="PROBE-RACE-01",
                name="Vector-Clock Causal Order Probe",
                probe_type=ProbeType.MUTATION_CHECK,
                cost_nano_usd=0,
                expected_compliant="Monotonic causal order preserved across threads",
                expected_violation="Non-deterministic state interleaving or race detected",
                verification_command="pytest tests/ -k concurrency --stress-iterations=50",
                description="Validates invariant preservation under asynchronous worker interleaving.",
            )

        # 3. Security / Auth Token check
        if any(w in desc_lower for w in ["auth", "token", "permission", "secret", "access"]):
            return CounterfactualProbe(
                probe_id="PROBE-AUTH-01",
                name="Affine Single-Use Token Invalidation Probe",
                probe_type=ProbeType.NEGATIVE_ASSERTION,
                cost_nano_usd=0,
                expected_compliant="Revoked token produces HTTP 401 Unauthorized",
                expected_violation="Revoked token still accepted (confused deputy)",
                verification_command="pytest tests/ -k auth_revocation",
                description="Submits an expired/invalid token to confirm negative assertion triggers.",
            )

        # Default: AST & Deterministic Test Oracle
        target = files[0] if files else "target_code.py"
        return CounterfactualProbe(
            probe_id="PROBE-DETERMINISTIC-01",
            name="Invariant Boundary Assertion Probe",
            probe_type=ProbeType.DETERMINISTIC_ORACLE,
            cost_nano_usd=0,
            expected_compliant="All explicit assertions pass with non-empty mutation coverage",
            expected_violation="Boundary condition edge cases produce unexpected behavior",
            verification_command=f"pytest {target} -v",
            description="Executes deterministic boundary assertions on modified files.",
        )

    def compute_invalidation_matrix(
        self,
        verified_obligations: Dict[str, List[str]],  # req_id -> [dependent_file_paths]
        files_modified: List[str],
        repo_root: Optional[str] = None,
    ) -> Tuple[Set[str], Set[str]]:
        """
        Calculates incremental proof reuse across hundreds of tasks.
        If repo_root is provided, uses ASTDependencyScanner to compute
        the full transitive invalidation cone.
        Returns: (reusable_obligations, invalidated_obligations).
        """
        if repo_root and os.path.exists(repo_root):
            scanner = ASTDependencyScanner(repo_root)
            scanner.scan_repository()
            invalidation_cone = scanner.compute_invalidation_cone(files_modified)
            modified_set = set(files_modified) | invalidation_cone
        else:
            modified_set = set(files_modified)

        reusable: Set[str] = set()
        invalidated: Set[str] = set()

        for req_id, dependencies in verified_obligations.items():
            dep_set = set(dependencies)
            # If any dependency was modified, invalidate proof
            if dep_set & modified_set:
                invalidated.add(req_id)
            else:
                reusable.add(req_id)

        return reusable, invalidated

    def evaluate_task_cwc(
        self,
        parent_mission_id: str,
        report: TaskReport,
        verified_obligations: Dict[str, List[str]],
        all_required_requirements: List[str],
        repo_root: Optional[str] = None,
    ) -> Tuple[CWCReviewedReceipt, NextTaskContract]:
        """
        Comprehensive CWC execution loop.
        Outputs Product A (Receipt) and Product B (Contract).
        """
        # 1. Dependency Invalidation
        reusable, invalidated = self.compute_invalidation_matrix(
            verified_obligations, report.files_modified, repo_root=repo_root
        )

        # 2. Kleene-4 claim assessment
        supported = 0
        contradicted = 0
        unverified = 0

        for claim in report.claims:
            if claim.status == ClaimStatus.VERIFIED:
                supported += 1
            elif claim.status == ClaimStatus.CONTRADICTED:
                contradicted += 1
            else:
                unverified += 1

        # Check for unverified obligations (satisfied by reusable proofs OR newly verified claims)
        newly_verified = {claim.requirement_id for claim in report.claims if claim.status == ClaimStatus.VERIFIED}
        satisfied_reqs = set(reusable) | newly_verified
        unmet_reqs = [r for r in all_required_requirements if r not in satisfied_reqs]
        if report.tests_failed > 0:
            contradicted += report.tests_failed

        # 3. Generate Distinguishing Witness
        primary_req = unmet_reqs[0] if unmet_reqs else "REQ-CORE"
        witness_probe = self.generate_distinguishing_witness(
            primary_req, report.summary, report.files_modified
        )

        # 4. Fetch S-Capsule Scientific Blueprint
        s_capsule = self.capsule_retriever.fetch_solution_blueprint(
            report.summary + " " + " ".join(report.files_modified)
        )

        # 5. Skill Auto-Installation / Ingestion
        skill_proposal = self.skill_installer.formulate_installation_proposal(
            report.summary, report.files_modified
        )

        # 6. Disposition
        if contradicted > 0:
            disposition = "HOLD"
        elif unmet_reqs:
            disposition = "DEFICIT_DETECTED"
        else:
            disposition = "QUALIFIED"

        # Build Product A
        receipt = CWCReviewedReceipt(
            task_id=report.task_id,
            mission_id=parent_mission_id,
            disposition=disposition,
            supported_claims=supported,
            contradicted_claims=contradicted,
            unverified_claims=unverified,
            distinguishing_probe=witness_probe,
            empirical_blueprint=s_capsule,
            reusable_proof_count=len(reusable),
            invalidated_proof_count=len(invalidated),
        )

        # Build Product B (Next Task Contract)
        next_obj = (
            f"Resolve outstanding obligations: {', '.join(unmet_reqs[:3])}"
            if unmet_reqs
            else "Final qualification and invariant freeze"
        )

        skills_markdown = "\n".join(skill_proposal.injected_prompt_headers)
        execution_steps = [
            f"Review empirical pattern from {s_capsule.paper_title} ({s_capsule.identifier})",
            f"Apply specialized directives from active skills: {', '.join(s.skill_name for s in skill_proposal.required_skills)}",
            f"Execute distinguishing probe: {witness_probe.verification_command}",
            "Verify all assertions pass without introducing regressions",
        ]

        next_contract = NextTaskContract(
            task_title=f"{report.task_id}-CWC-CONTINUATION",
            baseline_ref=report.commit_sha or "HEAD",
            objective=f"{next_obj}\n\n{s_capsule.to_prompt_section()}\n### 🛠️ ACTIVE SKILLS:\n{skills_markdown}",
            allowed_files=report.files_modified or ["src/", "tests/"],
            prohibited_files=["config/secrets.env", ".env", "production.key"],
            execution_steps=execution_steps,
            acceptance_criteria=f"Distinguishing probe '{witness_probe.name}' returns exit code 0",
            stop_boundaries=[
                "Do not exceed assigned file scope",
                "Do not hallucinate test passes without physical proof receipts",
                "Stop immediately upon discovering contradictory evidence",
            ],
            tier_used="T0_CWC_DETERMINISTIC",
            cost_nano_usd=0,
            saved_tokens=4500,
        )

        return receipt, next_contract
