"""Capability Firewall: Deterministic evaluation of agent capability requests."""

from __future__ import annotations

import fnmatch
from datetime import datetime, timezone
from typing import Any

from .models import CapabilityGrant, CapabilityRequest, CapabilityType, Decision, PolicyEvaluationResult


class CapabilityFirewall:
    def __init__(self) -> None:
        self.grants: dict[str, CapabilityGrant] = {}
        self.used_grant_nonces: set[str] = set()
        self.used_request_nonces: set[str] = set()

    def install_grant(self, grant: CapabilityGrant, installer_id: str | None = None) -> None:
        # Prevent replay attacks on grant installation
        if grant.nonce in self.used_grant_nonces:
            raise ValueError(f"Replay attack detected: grant nonce '{grant.nonce}' already consumed.")
        # Prevent self-grant attacks by agents
        if installer_id and (installer_id == grant.issuer or installer_id == grant.approval_identity):
            raise PermissionError("Self-granting capability authority is strictly prohibited.")
        self.used_grant_nonces.add(grant.nonce)
        self.grants[grant.grant_id] = grant

    def revoke_grant(self, grant_id: str) -> bool:
        return self.grants.pop(grant_id, None) is not None

    def evaluate_request(self, req: CapabilityRequest) -> PolicyEvaluationResult:
        """Evaluates capability requests strictly independent of LLM content.
        Model output alone can NEVER grant itself authority.
        """
        # Request nonce replay defense
        if req.nonce:
            if req.nonce in self.used_request_nonces:
                return PolicyEvaluationResult(
                    decision=Decision.DENY,
                    reason=f"Replay attack detected: request nonce '{req.nonce}' already consumed.",
                )
            self.used_request_nonces.add(req.nonce)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Find matching grants
        matching_grants: list[CapabilityGrant] = []
        for g in self.grants.values():
            if g.capability != req.capability:
                continue
            # Check expiration
            if g.expiration_iso and g.expiration_iso < now_iso:
                continue
            # Self-grant defense: agent cannot evaluate against a grant where agent is issuer or approver
            if req.agent_id and (req.agent_id == g.issuer or req.agent_id == g.approval_identity):
                continue
            # Check resource scope pattern
            if not fnmatch.fnmatch(req.target_resource, g.resource_scope):
                continue
            # Check action scope
            if g.action_scope != "*" and req.action not in g.action_scope.split(","):
                continue
            matching_grants.append(g)

        if not matching_grants:
            return PolicyEvaluationResult(
                decision=Decision.DENY,
                reason=f"No active CapabilityGrant found for {req.capability.value} on resource '{req.target_resource}'.",
            )

        # Evaluate budget if applicable
        for g in matching_grants:
            if g.amount_budget is not None:
                if g.remaining_budget is not None and g.remaining_budget < req.amount:
                    return PolicyEvaluationResult(
                        decision=Decision.REQUIRES_APPROVAL,
                        reason=f"Operation amount {req.amount} exceeds remaining grant budget {g.remaining_budget}.",
                        matched_grant_id=g.grant_id,
                        remaining_budget=g.remaining_budget,
                    )
                # Decrement budget
                if g.remaining_budget is not None:
                    g.remaining_budget -= req.amount

            # High risk capabilities require explicit human approval unless specifically permitted
            if req.capability in (CapabilityType.PRODUCTION_CHANGE, CapabilityType.DEPLOY, CapabilityType.PAYMENT):
                if "auto_approved" not in g.action_scope:
                    return PolicyEvaluationResult(
                        decision=Decision.REQUIRES_APPROVAL,
                        reason=f"High-impact capability {req.capability.value} requires human approval.",
                        matched_grant_id=g.grant_id,
                        remaining_budget=g.remaining_budget,
                    )

            return PolicyEvaluationResult(
                decision=Decision.ALLOW,
                reason=f"Authorized under grant {g.grant_id} by issuer {g.issuer}.",
                matched_grant_id=g.grant_id,
                remaining_budget=g.remaining_budget,
            )

        return PolicyEvaluationResult(decision=Decision.DENY, reason="Capability grant rejected.")
