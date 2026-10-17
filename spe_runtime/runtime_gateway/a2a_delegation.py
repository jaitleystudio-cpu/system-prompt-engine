"""Agent-to-Agent (A2A) Delegation Policy Engine."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .models import A2ADelegationContract, CapabilityRequest, CapabilityType, Decision, PolicyEvaluationResult


class A2APolicyEngine:
    def __init__(self) -> None:
        self.contracts: dict[str, A2ADelegationContract] = {}

    def register_contract(self, contract: A2ADelegationContract) -> None:
        self.contracts[contract.contract_id] = contract

    def evaluate_delegation(
        self,
        delegator_id: str,
        delegatee_id: str,
        requested_capability: CapabilityType,
    ) -> PolicyEvaluationResult:
        now_iso = datetime.now(timezone.utc).isoformat()

        # Find matching delegation contracts
        active_contracts = [
            c for c in self.contracts.values()
            if c.delegator_agent_id == delegator_id and c.delegatee_agent_id == delegatee_id
        ]

        if not active_contracts:
            return PolicyEvaluationResult(
                decision=Decision.DENY,
                reason=f"No delegation contract exists between {delegator_id} and {delegatee_id}.",
            )

        for c in active_contracts:
            if c.expiration_iso and c.expiration_iso < now_iso:
                continue
            if requested_capability in c.forbidden_capabilities:
                return PolicyEvaluationResult(
                    decision=Decision.DENY,
                    reason=f"Capability {requested_capability.value} is explicitly forbidden by contract {c.contract_id}.",
                )
            if requested_capability in c.allowed_capabilities:
                return PolicyEvaluationResult(
                    decision=Decision.ALLOW,
                    reason=f"Capability {requested_capability.value} permitted by delegation contract {c.contract_id}.",
                )

        return PolicyEvaluationResult(
            decision=Decision.DENY,
            reason=f"Capability {requested_capability.value} not included in allowed delegation scopes.",
        )
