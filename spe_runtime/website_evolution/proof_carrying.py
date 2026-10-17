"""SPE Ω — Python Proof-Carrying Website Evolution Authority Controller.

Grounded in Proof-Carrying Code and Evaluator Authority Firewall.
Enforces Autonomy Levels L0-L5, anti-mutation kill rate >= 0.95, and forward rollback.
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Dict, List, Optional
from spe_runtime.website_evolution.types import (
    AutonomyLevel,
    ChangeRiskLevel,
    DefectCategory,
    ProofCarryingChangeProposal,
    ProposalStatus,
)


class ProofCarryingEvolutionControllerPy:
    ALLOWED_AUTO_RELEASE = {
        DefectCategory.BROKEN_INTERNAL_LINK,
        DefectCategory.SITEMAP_INCONSISTENCY,
        DefectCategory.INVALID_STRUCTURED_DATA,
    }

    def compute_digest(self, proposal: ProofCarryingChangeProposal) -> str:
        payload = json.dumps({
            "id": proposal.id,
            "category": proposal.defect_category.value,
            "patch": {
                "target_file": proposal.minimal_patch.target_file,
                "original_chunk": proposal.minimal_patch.original_chunk,
                "replacement_chunk": proposal.minimal_patch.replacement_chunk,
            },
            "failing_test": proposal.failing_test_before_fix.test_name,
            "risk": proposal.risk_level.value,
            "rollback": proposal.rollback_reference.snapshot_commit,
        }, sort_keys=True)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return f"sha256:prop-{digest[:16]}"

    def evaluate_release_authority(self, proposal: ProofCarryingChangeProposal) -> Dict[str, Any]:
        audit_log: List[str] = []

        # 0. Sparse or Inconclusive Evidence Check
        if proposal.observed_evidence and (proposal.observed_evidence.confidence_score < 0.5 or not proposal.observed_evidence.is_finalized):
            audit_log.append("Search Console Evidence Inconclusive: Proposal held pending reliable finalized data.")
            return {
                "status": ProposalStatus.HELD_INCONCLUSIVE,
                "authorized_autonomy": AutonomyLevel.L0_OBSERVE,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 1. Silent-Failure Watchdog: Failing test reproduction required
        if not getattr(proposal.failing_test_before_fix, "reproduced", False):
            audit_log.append("REJECT: Problem was not reproduced with a failing test before fix.")
            return {
                "status": ProposalStatus.REJECTED,
                "authorized_autonomy": AutonomyLevel.L1_DIAGNOSE,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 2. Evaluator Authority Firewall: Test suite tampering detection
        if not proposal.qualification_results.oracle_integrity_preserved:
            audit_log.append("CRITICAL REJECT: Test assertions were modified or weakened to force PASS.")
            return {
                "status": ProposalStatus.REJECTED,
                "authorized_autonomy": AutonomyLevel.L1_DIAGNOSE,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 3. Qualification results
        q = proposal.qualification_results
        tests_passed = (
            q.targeted_unit_tests_passed
            and q.regression_suite_passed
            and q.security_policy_passed
            and q.visual_a11y_passed
            and q.seo_policy_passed
        )
        if not tests_passed:
            audit_log.append("REJECT: One or more qualification test dimensions failed.")
            return {
                "status": ProposalStatus.REJECTED,
                "authorized_autonomy": AutonomyLevel.L3_QUALIFY,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 4. Anti-Mutation Kill Rate >= 0.95
        if q.anti_mutation_kill_rate < 0.95:
            audit_log.append(f"REJECT: Anti-mutation kill rate {q.anti_mutation_kill_rate * 100:.1f}% < 95% threshold.")
            return {
                "status": ProposalStatus.REJECTED,
                "authorized_autonomy": AutonomyLevel.L3_QUALIFY,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 5. Rollback demonstration check
        if not proposal.rollback_reference.verified_rollback_capable:
            audit_log.append("REJECT: Proposal lacks a demonstrated, verified rollback recipe.")
            return {
                "status": ProposalStatus.REJECTED,
                "authorized_autonomy": AutonomyLevel.L3_QUALIFY,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        # 6. This staging controller sees caller-owned assertion flags, not
        # independently verified execution receipts. No automated live release
        # authority may be inferred from those flags.
        if proposal.risk_level == ChangeRiskLevel.LOW and proposal.defect_category in self.ALLOWED_AUTO_RELEASE:
            audit_log.append("RELEASE_AUTHORITY_HOLD: candidate staged; independent execution verification required.")
            return {
                "status": ProposalStatus.PATCH_PREPARED,
                "authorized_autonomy": AutonomyLevel.L3_QUALIFY,
                "authorized_for_live_deploy": False,
                "audit_log": audit_log,
            }

        audit_log.append(f"GATED: Risk level is {proposal.risk_level.value}. Requires L5 Human Authorization.")
        return {
            "status": ProposalStatus.APPROVED_FOR_RELEASE,
            "authorized_autonomy": AutonomyLevel.L5_HUMAN_AUTHORIZED,
            "authorized_for_live_deploy": False,
            "audit_log": audit_log,
        }

    def execute_rollback(self, proposal: ProofCarryingChangeProposal) -> Dict[str, Any]:
        # An authored rollback recipe is not a real execution receipt.
        # Only the independent release executor may declare a restore complete.
        return {
            "success": False,
            "restored_commit": "",
            "receipt_id": "",
            "details": "NOT_EXECUTED: rollback executor was not invoked; no restore receipt exists.",
        }
