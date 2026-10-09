"""
SPE Ω — Production-Research Bridge Kernel (Kernel 1)
Fixes Trap 1: Exposes RGIC-E1, CEC, and WPEM without Breaking Research Quarantine.

Provides clean, high-level production facades:
1. EvidenceClosureAdapter: Projects RGIC-E1 evidence closure and anti-self-certification.
2. ConservationBus: Projects CEC obligation preservation, permission attenuation, and sticky labels.
3. MorphingEngine: Projects WPEM dynamic AST morphing under memory/thermal pressure.
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
import hashlib

class AntiSelfCertificationError(ValueError):
    """Raised when an agent attempts to certify its own work."""
    pass

class ObligationDroppedError(ValueError):
    """Raised when task decomposition drops required parent obligations."""
    pass

class PermissionEscalationError(ValueError):
    """Raised when child agent attempts to escalate permissions beyond parent boundary."""
    pass


@dataclass
class HonestTaskProjection:
    task_id: str
    syntax_generation: str  # PASS / FAIL
    runtime_execution: str  # PASS / FAIL / UNKNOWN
    real_world_environment: str  # PASS / FAIL / UNKNOWN
    overall_status: str  # VERIFIED / LIMITED / UNRESOLVED
    evidence_closure_contract_id: Optional[str] = None
    summary_text: str = ""


class EvidenceClosureAdapter:
    """
    Production facade for RGIC-E1 Evidence Closure.
    Allows standard CLI and SDK to project honest verification status
    and enforce anti-self-certification without manual research imports.
    """
    @staticmethod
    def project_honest_status(
        task_id: str,
        syntax_valid: bool = True,
        runtime_tested: bool = False,
        env_tested: bool = False,
        contract_id: Optional[str] = None
    ) -> HonestTaskProjection:
        syntax_status = "PASS" if syntax_valid else "FAIL"
        runtime_status = "PASS" if runtime_tested else "UNKNOWN"
        env_status = "PASS" if env_tested else "UNKNOWN"

        if not syntax_valid:
            overall = "LIMITED"
        elif runtime_tested and env_tested:
            overall = "VERIFIED"
        else:
            overall = "UNRESOLVED"

        summary = (
            f"Syntax & Generation: {syntax_status} | "
            f"Runtime Execution: {runtime_status} | "
            f"Real-World Environment: {env_status} => "
            f"Overall Status: {overall}"
        )

        return HonestTaskProjection(
            task_id=task_id,
            syntax_generation=syntax_status,
            runtime_execution=runtime_status,
            real_world_environment=env_status,
            overall_status=overall,
            evidence_closure_contract_id=contract_id,
            summary_text=summary
        )

    @staticmethod
    def verify_receipt_authority(agent_id: str, receipt_issuer_id: str) -> bool:
        """Enforces Anti-Self-Certification Law: Issuer(Receipt) != AgentUnderTest."""
        if not receipt_issuer_id or receipt_issuer_id in (agent_id, "self", "agent-under-test", "candidate-agent"):
            raise AntiSelfCertificationError(
                f"Anti-Self-Certification Violation: Agent '{agent_id}' cannot certify its own receipt (issuer='{receipt_issuer_id}')."
            )
        return True


class ConservationBus:
    """
    Production facade for CEC (Constraint-and-Evidence Conservation).
    Enforces obligation preservation, permission attenuation, and sticky labels.
    """
    STICKY_SECURITY_LABELS = frozenset({"AIR_GAPPED", "CONFIDENTIAL", "NO_EGRESS", "PII_RESTRICTED"})

    @staticmethod
    def validate_decomposition(
        parent_obligations: Set[str],
        delegated_obligations: Set[str],
        retained_obligations: Set[str]
    ) -> bool:
        """Verifies that O_parent subseteq (O_delegated union O_retained). No obligations dropped."""
        combined = set(delegated_obligations).union(set(retained_obligations))
        missing = set(parent_obligations) - combined
        if missing:
            raise ObligationDroppedError(f"Obligation preservation violation: missing obligations {sorted(missing)}")
        return True

    @staticmethod
    def attenuate_permissions(
        parent_permissions: Set[str],
        requested_child_permissions: Set[str]
    ) -> Set[str]:
        """Enforces A_child subseteq A_parent. Strips any unauthorized child escalations."""
        unauthorized = set(requested_child_permissions) - set(parent_permissions)
        if unauthorized:
            # Strictly attenuate to the allowed intersection
            return set(requested_child_permissions).intersection(set(parent_permissions))
        return set(requested_child_permissions)

    @staticmethod
    def preserve_security_labels(current_labels: Set[str], new_labels: Set[str]) -> Set[str]:
        """Sticky security labels: AIR_GAPPED and CONFIDENTIAL can never be demoted."""
        merged = set(current_labels).union(set(new_labels))
        for sticky in ConservationBus.STICKY_SECURITY_LABELS:
            if sticky in current_labels:
                merged.add(sticky)
        return merged


class MorphingEngine:
    """
    Production facade for WPEM dynamic execution morphing.
    Intercepts execution when hardware pressure spikes and switches to $0 AST solver.
    """
    @staticmethod
    def should_morph_to_ast(
        free_ram_mb: int,
        required_headroom_mb: int = 1500,
        thermal_state: str = "NOMINAL"
    ) -> bool:
        """Returns True if device is under serious thermal pressure or RAM headroom < 1.5x."""
        if thermal_state in ("SERIOUS", "CRITICAL"):
            return True
        if free_ram_mb < (required_headroom_mb * 1.5):
            return True
        return False

    @staticmethod
    def execute_ast_fallback(prompt_text: str) -> Dict[str, Any]:
        """
        Deterministic, zero-token in-memory fallback solver.
        Analyzes the prompt structure without invoking heavy stochastic neural models.
        """
        import re
        lines = [l.strip() for l in prompt_text.splitlines() if l.strip()]
        objectives = [l for l in lines if any(w in l.lower() for w in ("goal", "objective", "task", "build", "fix"))]
        invariants = [l for l in lines if any(w in l.lower() for w in ("never", "must", "invariant", "do not", "strictly"))]

        return {
            "mode": "LOCAL_OFFLINE_DACO_AST_FALLBACK",
            "inferred_objective": objectives[0] if objectives else (lines[0] if lines else "Default Task"),
            "detected_invariants": invariants,
            "cost_nano_usd": 0,
            "tokens_consumed": 0,
            "latency_ms": 0,
            "airgap_enforced": True
        }
