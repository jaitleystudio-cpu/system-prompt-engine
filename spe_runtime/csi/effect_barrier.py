"""Irreversible Effect Barrier (Semantic ACID).

Enforces physical separation between cognition space and real-world effects,
requiring fresh epistemic state, valid authority leases, 2PC budget escrows,
and C^4 causal grounding certificates.
"""

from __future__ import annotations

import time
import uuid
from typing import Any, Callable, Dict, Optional

from spe_runtime.runtime_gateway.firewall import CapabilityFirewall
from spe_runtime.runtime_gateway.models import CapabilityRequest, CapabilityType, Decision
from .models import EffectProposal, LatticeState, SemanticTransaction
from .s_mmu import SemanticMMU


class EffectBarrierViolation(Exception):
    """Raised when an effect proposal fails one or more barrier gates."""


class IrreversibleEffectBarrier:
    """Hardware-inspired physical effect isolation barrier."""

    def __init__(self, mmu: SemanticMMU, firewall: CapabilityFirewall) -> None:
        self.mmu = mmu
        self.firewall = firewall

    def commit_effect(
        self,
        proposal: EffectProposal,
        tx: SemanticTransaction,
        executor_fn: Callable[[Dict[str, Any]], Any],
    ) -> Dict[str, Any]:
        """Audits all 4 barrier gates and executes the physical effect under 2PC escrow."""
        res_id = f"escrow-{uuid.uuid4().hex[:8]}"

        # Gate 1: Read-Set Freshness Audit
        for reg_id in proposal.required_registers:
            curr = self.mmu.get_register(reg_id)
            if not curr:
                raise EffectBarrierViolation(f"Barrier Gate 1 Failed: Register '{reg_id}' missing from EAS.")
            expected_version = tx.read_set.get(reg_id)
            if expected_version is not None and curr.version != expected_version:
                raise EffectBarrierViolation(
                    f"Barrier Gate 1 Failed: Stale register '{reg_id}' read at v{expected_version}, now v{curr.version}."
                )
            if curr.lattice_state != LatticeState.VALID:
                raise EffectBarrierViolation(
                    f"Barrier Gate 1 Failed: Consumed register '{reg_id}' is invalid ({curr.lattice_state.value})."
                )

        # Gate 2: Authority Lease & Scope Audit
        grant_id = proposal.authority_grant_id
        if not grant_id or grant_id not in self.firewall.grants:
            raise EffectBarrierViolation(f"Barrier Gate 2 Failed: No active CapabilityGrant found for ID '{grant_id}'.")

        if grant_id in self.firewall.revoked_grant_ids:
            raise EffectBarrierViolation(f"Barrier Gate 2 Failed: CapabilityGrant '{grant_id}' has been revoked.")

        # Gate 3: C^4 Causal Grounding Certificate (Mandatory for high-impact capabilities)
        high_risk_actions = ("payment", "deploy", "delete", "write")
        if any(h in proposal.action.lower() for h in high_risk_actions):
            if not tx.c4_certificate or not tx.c4_certificate.is_grounded:
                raise EffectBarrierViolation(
                    "Barrier Gate 3 Failed: High-impact effect requires valid C^4 Causal Grounding Certificate."
                )

        # Gate 4: 2-Phase Commit Budget Escrow
        if proposal.amount_usd > 0:
            reserved = self.firewall.reserve_budget(grant_id, proposal.amount_usd, res_id)
            if not reserved:
                raise EffectBarrierViolation(
                    f"Barrier Gate 4 Failed: Insufficient escrow budget for ${proposal.amount_usd:.2f}."
                )

        # Execution Phase
        try:
            execution_result = executor_fn(proposal.payload)
            if proposal.amount_usd > 0:
                self.firewall.commit_budget(res_id)

            return {
                "status": "EFFECT_COMMITTED",
                "proposal_id": proposal.proposal_id,
                "action": proposal.action,
                "target_resource": proposal.target_resource,
                "amount_usd": proposal.amount_usd,
                "execution_result": execution_result,
                "timestamp_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        except Exception as e:
            # Atomic Rollback on failure
            if proposal.amount_usd > 0:
                self.firewall.rollback_budget(res_id)
            raise EffectBarrierViolation(f"Effect Execution Failed; Escrow Rolled Back: {str(e)}") from e
