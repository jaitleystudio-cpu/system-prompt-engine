"""
SPE Ω — Evidence Passport & Top-3 Merit Ranking Kernel (Master Prompt 1)

Mathematical rigor, uncertainty-aware Wilson score confidence intervals,
6-dimension evaluation, security hard-gate disqualification, and zero-capital
influence ranking.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import datetime
import hashlib
import json
import math
from typing import Any, Dict, List, Optional, Set, Tuple


class SecurityDisqualificationError(ValueError):
    """Raised when an operation attempts to qualify or rank a candidate with security violations."""
    pass


def compute_wilson_lower_bound(successes: int, trials: int, z: float = 1.96) -> float:
    """
    Computes the Wilson score interval lower bound (default 95% confidence, z = 1.96).

    Formula:
        W_lower = (p_hat + z^2/(2n) - z * sqrt((p_hat * (1 - p_hat)/n) + (z^2 / (4n^2)))) / (1 + z^2/n)

    Invariants:
    - If trials <= 0: returns 0.0.
    - Demonstrates uncertainty awareness: 490/500 strictly dominates 5/5.
    - Clamped to [0.0, 1.0].
    """
    if trials <= 0:
        return 0.0
    if successes < 0 or successes > trials:
        raise ValueError(f"Successes ({successes}) must be between 0 and trials ({trials})")

    p_hat = successes / trials
    z2 = z * z
    n = float(trials)

    denominator = 1.0 + (z2 / n)
    center = p_hat + (z2 / (2.0 * n))
    radicand = (p_hat * (1.0 - p_hat) / n) + (z2 / (4.0 * (n * n)))
    spread = z * math.sqrt(max(0.0, radicand))

    w_lower = (center - spread) / denominator
    return max(0.0, min(1.0, w_lower))


@dataclass
class EvaluationDimensions:
    """
    6 Evaluation dimensions & weights defined in Master Prompt 1:
    - Functional Task Success (35%)
    - Reliability & Robustness (20%)
    - Verified Compatibility (15%)
    - Resource & Token Efficiency (10%)
    - Maintenance & Update Quality (10%)
    - Documentation & Ergonomics (10%)
    """
    functional_task_success: float = 0.0       # weight: 0.35
    reliability_robustness: float = 0.0        # weight: 0.20
    verified_compatibility: float = 0.0        # weight: 0.15
    resource_token_efficiency: float = 0.0     # weight: 0.10
    maintenance_update_quality: float = 0.0    # weight: 0.10
    documentation_ergonomics: float = 0.0      # weight: 0.10

    WEIGHTS = {
        "functional_task_success": 0.35,
        "reliability_robustness": 0.20,
        "verified_compatibility": 0.15,
        "resource_token_efficiency": 0.10,
        "maintenance_update_quality": 0.10,
        "documentation_ergonomics": 0.10,
    }

    def compute_composite_score(self) -> float:
        """Computes weighted composite score in [0.0, 1.0]."""
        raw = (
            self.functional_task_success * self.WEIGHTS["functional_task_success"]
            + self.reliability_robustness * self.WEIGHTS["reliability_robustness"]
            + self.verified_compatibility * self.WEIGHTS["verified_compatibility"]
            + self.resource_token_efficiency * self.WEIGHTS["resource_token_efficiency"]
            + self.maintenance_update_quality * self.WEIGHTS["maintenance_update_quality"]
            + self.documentation_ergonomics * self.WEIGHTS["documentation_ergonomics"]
        )
        return max(0.0, min(1.0, raw))

    def to_dict(self) -> Dict[str, float]:
        return {
            "functional_task_success": round(self.functional_task_success, 4),
            "reliability_robustness": round(self.reliability_robustness, 4),
            "verified_compatibility": round(self.verified_compatibility, 4),
            "resource_token_efficiency": round(self.resource_token_efficiency, 4),
            "maintenance_update_quality": round(self.maintenance_update_quality, 4),
            "documentation_ergonomics": round(self.documentation_ergonomics, 4),
            "composite_score": round(self.compute_composite_score(), 4),
        }


@dataclass
class SecurityAudit:
    static_analysis: str = "PASSED_SAFE"  # PASSED_SAFE / FAILED_RISK
    permission_footprint: List[str] = field(default_factory=lambda: ["FILESYSTEM_SCOPED_READ"])
    exfiltration_risk: str = "ZERO_DETECTED"  # ZERO_DETECTED / SUSPECTED / DETECTED
    unauthorized_network_egress: bool = False
    credential_exfiltration: bool = False
    ambient_authority_escalation: bool = False
    prompt_injection_detected: bool = False

    def is_disqualified(self) -> Tuple[bool, List[str]]:
        reasons = []
        if self.static_analysis.upper() != "PASSED_SAFE":
            reasons.append(f"Static analysis failed: {self.static_analysis}")
        if self.exfiltration_risk.upper() != "ZERO_DETECTED":
            reasons.append(f"Exfiltration risk detected: {self.exfiltration_risk}")
        if self.unauthorized_network_egress:
            reasons.append("Unauthorized network egress detected")
        if self.credential_exfiltration:
            reasons.append("Credential exfiltration detected")
        if self.ambient_authority_escalation:
            reasons.append("Ambient authority escalation detected")
        if self.prompt_injection_detected:
            reasons.append("Prompt injection detected in instructions")
        return (len(reasons) > 0, reasons)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "static_analysis": self.static_analysis,
            "permission_footprint": list(self.permission_footprint),
            "exfiltration_risk": self.exfiltration_risk,
        }


@dataclass
class TestedEnvironment:
    host_runtime: str = "Claude Code"  # Claude Code / Cursor / Gilden / Codex
    model_tested: str = "claude-3-7-sonnet"
    os: str = "macOS / Linux"
    trials_n: int = 150

    def to_dict(self) -> Dict[str, Any]:
        return {
            "host_runtime": self.host_runtime,
            "model_tested": self.model_tested,
            "os": self.os,
            "trials_n": self.trials_n,
        }


@dataclass
class PerformanceMetrics:
    success_rate: float = 0.0
    wilson_lower_bound_95: float = 0.0
    average_token_overhead: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "success_rate": round(self.success_rate, 4),
            "wilson_lower_bound_95": round(self.wilson_lower_bound_95, 4),
            "average_token_overhead": self.average_token_overhead,
        }


@dataclass
class ValidityWindow:
    qualified_at: str = "2026-10-10T00:00:00Z"
    expires_at: str = "2026-11-10T00:00:00Z"
    status: str = "CURRENT"  # CURRENT / EXPIRED / DISQUALIFIED / HOLD

    def to_dict(self) -> Dict[str, Any]:
        return {
            "qualified_at": self.qualified_at,
            "expires_at": self.expires_at,
            "status": self.status,
        }


@dataclass
class EvidencePassport:
    passport_id: str
    target_identifier: str
    version_digest: str
    tested_environment: TestedEnvironment
    security_audit: SecurityAudit
    performance_metrics: PerformanceMetrics
    validity_window: ValidityWindow
    top_three_eligibility: bool
    dimensions: EvaluationDimensions = field(default_factory=EvaluationDimensions)
    composite_score: float = 0.0

    # Metadata that MUST have ZERO weight on organic ranking:
    is_sponsored: bool = False
    sponsor_bid_usd: float = 0.0
    installation_count: int = 0
    marketing_claims: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "passport_id": self.passport_id,
            "target_identifier": self.target_identifier,
            "version_digest": self.version_digest,
            "tested_environment": self.tested_environment.to_dict(),
            "security_audit": self.security_audit.to_dict(),
            "performance_metrics": self.performance_metrics.to_dict(),
            "validity_window": self.validity_window.to_dict(),
            "top_three_eligibility": self.top_three_eligibility,
        }

    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)


@dataclass
class MeritRankingResult:
    top_3: List[EvidencePassport]
    ranked_candidates: List[EvidencePassport]
    disqualified_candidates: List[Dict[str, Any]]
    sponsored_inventory: List[Dict[str, Any]]
    evaluation_timestamp: str = ""
    total_evaluated: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "top_3": [p.to_dict() for p in self.top_3],
            "ranked_count": len(self.ranked_candidates),
            "disqualified_count": len(self.disqualified_candidates),
            "sponsored_count": len(self.sponsored_inventory),
            "total_evaluated": self.total_evaluated,
            "evaluation_timestamp": self.evaluation_timestamp,
            "disqualified_candidates": self.disqualified_candidates,
            "sponsored_inventory": self.sponsored_inventory,
        }


class MeritRanker:
    """
    SPE Ω Merit Ranker Engine.
    Evaluates candidates, enforces security gates, computes Wilson intervals,
    and isolates capital/advertising from organic Top 3.
    """

    @staticmethod
    def generate_evidence_passport(
        target_identifier: str,
        version_digest: str,
        trials_n: int,
        successes: int,
        host_runtime: str = "Claude Code / Cursor / Gilden",
        model_tested: str = "claude-3-7-sonnet",
        os_name: str = "macOS / Linux",
        average_token_overhead: int = 150,
        permission_footprint: Optional[List[str]] = None,
        security_audit: Optional[SecurityAudit] = None,
        dimensions: Optional[EvaluationDimensions] = None,
        is_sponsored: bool = False,
        sponsor_bid_usd: float = 0.0,
        installation_count: int = 0,
        qualified_at: Optional[str] = None,
        expires_at: Optional[str] = None,
        status: Optional[str] = None,
    ) -> EvidencePassport:
        """
        Creates an immutable, verifiable Evidence Passport.
        """
        perms = permission_footprint or ["FILESYSTEM_SCOPED_READ", "NO_NETWORK", "NO_CREDENTIALS"]
        sec = security_audit or SecurityAudit(
            static_analysis="PASSED_SAFE",
            permission_footprint=perms,
            exfiltration_risk="ZERO_DETECTED",
        )

        is_disq, disq_reasons = sec.is_disqualified()

        success_rate = (successes / trials_n) if trials_n > 0 else 0.0
        wilson_lb = compute_wilson_lower_bound(successes, trials_n)

        # Default dimensions if none supplied
        dims = dimensions or EvaluationDimensions(
            functional_task_success=wilson_lb,
            reliability_robustness=wilson_lb * 0.95,
            verified_compatibility=0.90,
            resource_token_efficiency=max(0.0, 1.0 - (average_token_overhead / 1000.0)),
            maintenance_update_quality=0.85,
            documentation_ergonomics=0.85,
        )

        composite_score = 0.0 if is_disq else dims.compute_composite_score()

        # Hard Gate status determination
        if is_disq:
            final_status = "DISQUALIFIED"
        elif status:
            final_status = status.upper()
        else:
            final_status = "CURRENT"

        top_three_eligibility = not is_disq and not is_sponsored and (final_status == "CURRENT") and (trials_n >= 10)

        now_iso = qualified_at or "2026-10-10T00:00:00Z"
        exp_iso = expires_at or "2026-11-10T00:00:00Z"

        # Unique reproducible passport ID
        passport_content = f"{target_identifier}:{version_digest}:{trials_n}:{successes}"
        passport_id = f"EVP-{hashlib.sha256(passport_content.encode('utf-8')).hexdigest()[:16]}"

        return EvidencePassport(
            passport_id=passport_id,
            target_identifier=target_identifier,
            version_digest=version_digest,
            tested_environment=TestedEnvironment(
                host_runtime=host_runtime,
                model_tested=model_tested,
                os=os_name,
                trials_n=trials_n,
            ),
            security_audit=sec,
            performance_metrics=PerformanceMetrics(
                success_rate=success_rate,
                wilson_lower_bound_95=wilson_lb,
                average_token_overhead=average_token_overhead,
            ),
            validity_window=ValidityWindow(
                qualified_at=now_iso,
                expires_at=exp_iso,
                status=final_status,
            ),
            top_three_eligibility=top_three_eligibility,
            dimensions=dims,
            composite_score=composite_score,
            is_sponsored=is_sponsored,
            sponsor_bid_usd=sponsor_bid_usd,
            installation_count=installation_count,
        )

    @classmethod
    def rank_candidates(
        cls,
        candidates: List[EvidencePassport | Dict[str, Any]],
        z_score: float = 1.96,
    ) -> MeritRankingResult:
        """
        Ranks candidate skills/MCPs with mathematical integrity:
        1. Hard Disqualification Gate filters out any security violation.
        2. Commercial Separation isolates sponsored candidates into labeled external inventory.
        3. Wilson Lower Bound + 6-dimension composite scores determine organic ranking.
        4. Top 3 are strictly unpurchasable.
        """
        passports: List[EvidencePassport] = []
        for c in candidates:
            if isinstance(c, EvidencePassport):
                passports.append(c)
            elif isinstance(c, dict):
                # Build passport from dictionary representation
                sec_dict = c.get("security_audit", {})
                static_analysis = sec_dict.get("static_analysis") or c.get("static_analysis", "PASSED_SAFE")
                perm_footprint = (
                    sec_dict.get("permission_footprint")
                    or c.get("permission_footprint")
                    or c.get("permissions")
                    or ["FILESYSTEM_SCOPED_READ"]
                )
                exfiltration_risk = sec_dict.get("exfiltration_risk") or c.get("exfiltration_risk", "ZERO_DETECTED")
                unauth_egress = sec_dict.get("unauthorized_network_egress", False) or c.get("unauthorized_network_egress", False)
                cred_exfil = sec_dict.get("credential_exfiltration", False) or c.get("credential_exfiltration", False)
                ambient_esc = sec_dict.get("ambient_authority_escalation", False) or c.get("ambient_authority_escalation", False)
                prompt_inj = sec_dict.get("prompt_injection_detected", False) or c.get("prompt_injection_detected", False)

                sec = SecurityAudit(
                    static_analysis=static_analysis,
                    permission_footprint=perm_footprint,
                    exfiltration_risk=exfiltration_risk,
                    unauthorized_network_egress=unauth_egress,
                    credential_exfiltration=cred_exfil,
                    ambient_authority_escalation=ambient_esc,
                    prompt_injection_detected=prompt_inj,
                )
                env_dict = c.get("tested_environment", {})
                perf_dict = c.get("performance_metrics", {})
                trials_n = env_dict.get("trials_n", c.get("trials_n", 100))
                successes = c.get("successes", int(trials_n * perf_dict.get("success_rate", 0.95)))

                dim_dict = c.get("dimensions", {})
                dims = EvaluationDimensions(
                    functional_task_success=dim_dict.get("functional_task_success", compute_wilson_lower_bound(successes, trials_n, z_score)),
                    reliability_robustness=dim_dict.get("reliability_robustness", 0.90),
                    verified_compatibility=dim_dict.get("verified_compatibility", 0.90),
                    resource_token_efficiency=dim_dict.get("resource_token_efficiency", 0.90),
                    maintenance_update_quality=dim_dict.get("maintenance_update_quality", 0.90),
                    documentation_ergonomics=dim_dict.get("documentation_ergonomics", 0.90),
                )

                val_dict = c.get("validity_window", {})
                cand_status = val_dict.get("status") or c.get("status")

                passport = cls.generate_evidence_passport(
                    target_identifier=c.get("target_identifier", c.get("name", "unknown-skill")),
                    version_digest=c.get("version_digest", hashlib.sha256(b"v1").hexdigest()),
                    trials_n=trials_n,
                    successes=successes,
                    host_runtime=env_dict.get("host_runtime", "Claude Code"),
                    model_tested=env_dict.get("model_tested", "claude-3-7-sonnet"),
                    os_name=env_dict.get("os", "macOS / Linux"),
                    average_token_overhead=perf_dict.get("average_token_overhead", c.get("average_token_overhead", 150)),
                    security_audit=sec,
                    dimensions=dims,
                    is_sponsored=c.get("is_sponsored", False),
                    sponsor_bid_usd=c.get("sponsor_bid_usd", 0.0),
                    installation_count=c.get("installation_count", 0),
                    status=cand_status,
                )
                passports.append(passport)

        disqualified: List[Dict[str, Any]] = []
        sponsored_inventory: List[Dict[str, Any]] = []
        eligible: List[EvidencePassport] = []

        for p in passports:
            is_disq, reasons = p.security_audit.is_disqualified()
            if is_disq or p.validity_window.status != "CURRENT":
                if not reasons and p.validity_window.status != "CURRENT":
                    reasons = [f"Validity status is {p.validity_window.status} (requires CURRENT)"]
                disqualified.append({
                    "target_identifier": p.target_identifier,
                    "passport_id": p.passport_id,
                    "reasons": reasons,
                    "status": p.validity_window.status,
                })
                continue

            # Commercial separation: sponsored candidates NEVER enter organic ranking
            if p.is_sponsored or p.sponsor_bid_usd > 0.0:
                sponsored_inventory.append({
                    "target_identifier": p.target_identifier,
                    "passport_id": p.passport_id,
                    "sponsor_bid_usd": p.sponsor_bid_usd,
                    "label": "SPONSORED_INVENTORY",
                    "wilson_lower_bound_95": p.performance_metrics.wilson_lower_bound_95,
                })
                continue

            eligible.append(p)

        # Sort eligible purely on composite score descending, then Wilson lower bound, then trials
        eligible.sort(
            key=lambda x: (
                x.composite_score,
                x.performance_metrics.wilson_lower_bound_95,
                x.tested_environment.trials_n,
            ),
            reverse=True,
        )

        top_3 = eligible[:3]

        return MeritRankingResult(
            top_3=top_3,
            ranked_candidates=eligible,
            disqualified_candidates=disqualified,
            sponsored_inventory=sponsored_inventory,
            evaluation_timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat(),
            total_evaluated=len(passports),
        )
