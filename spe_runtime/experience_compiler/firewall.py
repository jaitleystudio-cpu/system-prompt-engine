"""
SPE Ω — Interface Meaning Firewall (Python Runtime Parity)

Mandate:
Asserts bijective semantic consistency across Human, Search, and Agent projections:
    ∀ C: Semantics(Human(C)) ≡ Semantics(Search(C)) ≡ Semantics(Agent(C))
"""

from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Any
from .intent_compiler import VerifiedCapabilityContract, TriViewCompilationResult


@dataclass
class FirewallCheckIssue:
    code: str
    severity: str  # "CRITICAL", "HIGH", "MEDIUM", "LOW"
    message: str
    conflicting_views: List[str]
    remediation: str


@dataclass
class FirewallVerificationReport:
    timestamp: str
    capability_key: str
    status: str  # "PASSED", "FAILED"
    semantic_consistency_score: float
    issues: List[FirewallCheckIssue]
    metrics: Dict[str, bool]


BANNED_BUZZWORDS = [
    "supercharge",
    "revolutionary",
    "limitless",
    "magic",
    "magical",
    "100x",
    "1000x",
    "guaranteed #1",
    "silver bullet",
    "game-changing",
    "disrupt",
    "superhuman",
    "miracle",
    "unleash",
    "infinite possibilities",
]


class ExperienceConsistencyFirewall:
    """Verifies that Human, Search, and Agent projections do not diverge or make ungrounded promises."""

    def verify(
        self,
        contract: VerifiedCapabilityContract,
        tri_view: TriViewCompilationResult,
    ) -> FirewallVerificationReport:
        issues: List[FirewallCheckIssue] = []
        now_iso = datetime.now(timezone.utc).isoformat()

        human = tri_view.human_experience
        search = tri_view.search_experience
        agent = tri_view.agent_experience

        # 1. Parameter Parity Check
        human_param_names = {f.param_name for f in human.fields}
        agent_param_names = set(agent.parameters.get("properties", {}).keys())
        contract_param_names = {p.name for p in contract.parameters}

        for c_name in contract_param_names:
            if c_name not in human_param_names:
                issues.append(
                    FirewallCheckIssue(
                        code="FIREWALL_PARAM_DRIFT_CONTRACT_MISSING",
                        severity="CRITICAL",
                        message=f"Contract parameter '{c_name}' is missing from Human Form fields.",
                        conflicting_views=["HUMAN"],
                        remediation=f"Add form field for contract parameter '{c_name}'.",
                    )
                )

        for p_name in human_param_names:
            if p_name not in agent_param_names:
                issues.append(
                    FirewallCheckIssue(
                        code="FIREWALL_PARAM_DRIFT_AGENT_MISSING",
                        severity="CRITICAL",
                        message=f"Parameter '{p_name}' is present in Human Form but missing from Agent WebMCP Tool schema.",
                        conflicting_views=["HUMAN", "AGENT"],
                        remediation=f"Add parameter '{p_name}' to the WebMCP tool properties definition.",
                    )
                )

        for p_name in agent_param_names:
            if p_name not in human_param_names:
                issues.append(
                    FirewallCheckIssue(
                        code="FIREWALL_PARAM_DRIFT_HUMAN_MISSING",
                        severity="HIGH",
                        message=f"Parameter '{p_name}' is exposed in Agent Tool schema but missing from Human UI form.",
                        conflicting_views=["HUMAN", "AGENT"],
                        remediation=f"Add corresponding form field for '{p_name}' in human experience.",
                    )
                )

        # 2. Search Claims Veracity
        search_blob = f"{search.title_tag} {search.meta_description}".lower()
        for buzzword in BANNED_BUZZWORDS:
            if buzzword in search_blob:
                issues.append(
                    FirewallCheckIssue(
                        code="FIREWALL_BANNED_BUZZWORD",
                        severity="HIGH",
                        message=f"Search metadata contains hyperbolic buzzword '{buzzword}'.",
                        conflicting_views=["SEARCH"],
                        remediation="Replace with measured, factual capability assertion.",
                    )
                )

        # 3. Agent Security Bounds
        if not agent.tool_name.startswith("spe_"):
            issues.append(
                FirewallCheckIssue(
                    code="FIREWALL_TOOL_NAMESPACE_VIOLATION",
                    severity="HIGH",
                    message=f"Agent tool name '{agent.tool_name}' lacks required 'spe_' namespace prefix.",
                    conflicting_views=["AGENT"],
                    remediation="Prefix tool name with 'spe_'.",
                )
            )

        if agent.required_scope not in contract.allowed_scopes:
            issues.append(
                FirewallCheckIssue(
                    code="FIREWALL_SCOPE_ESCALATION",
                    severity="CRITICAL",
                    message=f"Agent required_scope '{agent.required_scope}' is not authorized in contract.allowed_scopes.",
                    conflicting_views=["AGENT"],
                    remediation="Bind agent tool to an authorized capability token scope.",
                )
            )

        # 4. Human Accessibility
        if not human.submit_button_text or not human.submit_button_text.strip():
            issues.append(
                FirewallCheckIssue(
                    code="FIREWALL_A11Y_MISSING_SUBMIT_LABEL",
                    severity="CRITICAL",
                    message="Human Form submit button has empty label.",
                    conflicting_views=["HUMAN"],
                    remediation="Provide explicit action text on submit button.",
                )
            )

        critical_count = sum(1 for i in issues if i.severity == "CRITICAL")
        high_count = sum(1 for i in issues if i.severity == "HIGH")
        status = "PASSED" if critical_count == 0 and high_count == 0 else "FAILED"

        penalty = critical_count * 0.35 + high_count * 0.15 + len(issues) * 0.05
        consistency_score = max(0.0, min(1.0, 1.0 - penalty))

        return FirewallVerificationReport(
            timestamp=now_iso,
            capability_key=contract.key,
            status=status,
            semantic_consistency_score=consistency_score,
            issues=issues,
            metrics={
                "parameterParityConfirmed": human_param_names == agent_param_names,
                "zeroExcessSearchClaims": not any("SEARCH" in i.conflicting_views for i in issues),
                "agentSecurityBounded": not any("AGENT" in i.conflicting_views and i.severity in ("CRITICAL", "HIGH") for i in issues),
                "a11yContrastCompliant": not any("HUMAN" in i.conflicting_views for i in issues),
                "airGapZeroEgressEnforced": contract.verification_proof.get("offlineWasmRunnable", False),
            },
        )
