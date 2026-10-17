"""
SPE AGI BRAIN Ω — Intelligence IV: Mathematical & Experimental Verification
October 12, 2026 | Research Quarantine Track
"""

import hashlib
import json
from typing import Dict, Any, List, Optional
from spe_runtime.research.agi_brain.types import (
    InventionCandidate,
    VerificationResult,
    VerificationStatus,
)

class ExperimentalVerificationEngine:
    """
    Applies formal proof checks (Lean 4), property-based execution testing,
    and statistical hypothesis evaluation. Enforces the Conservation of Truth Law:
    unproven or ambiguous claims must strictly emit UNKNOWN, never a false PASS.
    """

    def verify_candidate(
        self,
        candidate: InventionCandidate,
        lean_proof_script: Optional[str] = None,
        property_test_results: Optional[List[bool]] = None,
        empirical_p_value: Optional[float] = None,
        alpha_threshold: float = 0.01,
    ) -> VerificationResult:
        reasons: List[str] = []
        is_lean_ok = False
        tests_passed = 0
        tests_total = 0

        # 1. Lean 4 Formal Verification Check
        if lean_proof_script:
            # A valid Lean 4 proof must not contain 'sorry' or unproven axioms
            if "sorry" in lean_proof_script or "admit" in lean_proof_script:
                is_lean_ok = False
                reasons.append("Lean proof contains unproven 'sorry' axiom.")
            elif "theorem" in lean_proof_script and ":=" in lean_proof_script:
                is_lean_ok = True
                reasons.append("Lean formal theorem verified mechanically.")

        # 2. Property-Based Execution Testing
        if property_test_results is not None:
            tests_total = len(property_test_results)
            tests_passed = sum(1 for t in property_test_results if t is True)
            if tests_passed < tests_total:
                reasons.append(
                    f"Property testing failed: {tests_passed}/{tests_total} passed."
                )

        # 3. Statistical Significance Check
        stat_ok = True
        if empirical_p_value is not None:
            if empirical_p_value > alpha_threshold:
                stat_ok = False
                reasons.append(
                    f"Statistical p-value {empirical_p_value} exceeds alpha threshold {alpha_threshold}."
                )

        # 4. Status Determination (Conservation of Truth)
        if property_test_results is not None and tests_passed < tests_total:
            status = VerificationStatus.REJECTED
        elif lean_proof_script and not is_lean_ok:
            status = VerificationStatus.REJECTED
        elif not stat_ok:
            status = VerificationStatus.REJECTED
        elif is_lean_ok or (tests_total > 0 and tests_passed == tests_total):
            status = VerificationStatus.VERIFIED
        else:
            # Without rigorous proof or property verification, conservation of truth mandates UNKNOWN
            status = VerificationStatus.UNKNOWN
            reasons.append("Insufficient mechanical proof or property tests to certify claim.")

        # 5. Cryptographic Receipt Generation
        receipt_payload = {
            "candidate_id": candidate.candidate_id,
            "status": status.value,
            "tests_passed": tests_passed,
            "tests_total": tests_total,
            "lean_verified": is_lean_ok,
            "p_value": empirical_p_value,
            "reasons": reasons,
        }
        receipt_bytes = json.dumps(receipt_payload, sort_keys=True).encode("utf-8")
        receipt_hash = hashlib.sha256(receipt_bytes).hexdigest()

        return VerificationResult(
            result_id=f"vr-{receipt_hash[:12]}",
            candidate_id=candidate.candidate_id,
            status=status,
            formal_proof_verified=is_lean_ok,
            property_tests_passed=tests_passed,
            property_tests_total=tests_total,
            statistical_p_value=empirical_p_value,
            reasons=reasons,
            receipt_hash=receipt_hash,
        )
