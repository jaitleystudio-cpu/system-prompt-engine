"""Capability Firewall: Deterministic evaluation of agent capability requests."""

from __future__ import annotations

import fnmatch
from datetime import datetime, timezone
from typing import Any

from .models import CapabilityGrant, CapabilityRequest, CapabilityType, Decision, PolicyEvaluationResult


class CapabilityFirewall:
    def __init__(self) -> None:
        self.grants: dict[str, CapabilityGrant] = {}

    def install_grant(self, grant: CapabilityGrant) -> None:
        self.grants[grant.grant_id] = grant

    def revoke_grant(self, grant_id: str) -> bool:
        return self.grants.pop(grant_id, None) is not None

    def evaluate_request(self, req: CapabilityRequest) -> PolicyEvaluationResult:
        """Evaluates capability requests strictly independent of LLM content.
        Model output alone can NEVER grant itself authority.
        """
        now_iso = datetime.now(timezone.utc).isoformat()

        # Find matching grants
        matching_grants: list[CapabilityGrant] = []
        for g in self.grants.values():
            if g.capability != req.capability:
                continue
            # Check expiration
            if g.expiration_iso and g.expiration_iso < now_iso:
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
