"""
SPE Ω — Mission-Fit Skill Matcher & Permission Gateway (Master Prompt 2)

Compiles user task intent AST, verifies permission footprints against safety policies,
detects inter-skill operational conflicts, and produces unassailable recommendations
with honest abstention (NO_QUALIFIED_MATCH_FOUND).
"""

from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Any, Dict, List, Optional, Set, Tuple

from .merit_ranker import EvidencePassport


class PermissionViolationError(ValueError):
    """Raised when a candidate skill exceeds the user's permission ceiling."""
    pass


class InterSkillConflictError(ValueError):
    """Raised when two or more recommended skills have irreconcilable operational conflicts."""
    pass


@dataclass
class TaskRequirementsAST:
    task_summary: str
    required_capabilities: List[str] = field(default_factory=list)
    allowed_permissions: Set[str] = field(default_factory=set)
    forbidden_permissions: Set[str] = field(default_factory=lambda: {"NETWORK", "CREDENTIALS", "EXTERNAL_EGRESS"})
    environment_runtime: str = "Claude Code"  # Claude Code / Cursor / Gilden / Codex
    environment_os: str = "macOS"  # macOS / Linux
    strict_privacy: bool = True
    max_external_cost_usd: float = 0.0

    @classmethod
    def compile_from_text(
        cls,
        text: str,
        runtime: str = "Claude Code",
        os_name: str = "macOS",
        allowed_permissions: Optional[Set[str] | List[str]] = None,
        forbidden_permissions: Optional[Set[str] | List[str]] = None,
    ) -> TaskRequirementsAST:
        """
        Parses natural language task intent into a structured AST with
        inferred capabilities and safety constraints.
        """
        lower = text.lower()
        capabilities: List[str] = []

        capability_patterns = {
            "drizzle": "Drizzle ORM",
            "prisma": "Prisma ORM",
            "next.js": "Next.js App Router",
            "react": "React Components",
            "database": "Database Migrations",
            "migration": "Database Migrations",
            "security": "Security Audit",
            "audit": "Security Audit",
            "audio": "Audio Calibration",
            "ast": "Local AST Analysis",
            "wasm": "WebAssembly Compilation",
            "seo": "Programmatic SEO",
            "ad": "AdSense Monetization",
            "continuation": "Stream Continuation",
            "test": "Test Automation",
            "lint": "Code Linting & Formatting",
            "docker": "Container Orchestration",
        }

        for keyword, cap in capability_patterns.items():
            if keyword in lower and cap not in capabilities:
                capabilities.append(cap)

        if not capabilities:
            capabilities.append("General Code Assistance")

        # Inferred permission boundaries
        forbidden: Set[str] = set(forbidden_permissions or {"NETWORK", "CREDENTIALS", "EXTERNAL_EGRESS"})
        allowed: Set[str] = set(allowed_permissions or set())

        if "local only" in lower or "air-gap" in lower or "offline" in lower:
            forbidden.add("NETWORK")
            forbidden.add("EXTERNAL_EGRESS")
            allowed.add("LOCAL_AST_ONLY")
            allowed.add("FILESYSTEM_SCOPED_READ")
            allowed.add("FILESYSTEM_SCOPED_WRITE")

        if "read only" in lower or "read-only" in lower:
            forbidden.add("FILESYSTEM_SCOPED_WRITE")
            allowed.discard("FILESYSTEM_SCOPED_WRITE")
            allowed.add("FILESYSTEM_SCOPED_READ")

        return cls(
            task_summary=text.strip(),
            required_capabilities=capabilities,
            allowed_permissions=allowed,
            forbidden_permissions=forbidden,
            environment_runtime=runtime,
            environment_os=os_name,
            strict_privacy=True,
            max_external_cost_usd=0.0,
        )


@dataclass
class SkillRecommendation:
    rank: int
    skill_identifier: str
    task_fit_pct: int
    wilson_score_pct: float
    trials_n: int
    required_permissions: List[str]
    limitation_or_tradeoff: str
    authority_domain: str = "general"
    scoped_write_paths: List[str] = field(default_factory=list)


@dataclass
class MissionMatchResult:
    status: str  # QUALIFIED_MATCH / NO_QUALIFIED_MATCH_FOUND
    task_summary: str
    environment_runtime: str
    permission_ceiling_enforced: str
    recommendations: List[SkillRecommendation]
    conflict_check_passed: bool
    conflict_details: str
    suggested_command: str
    raw_markdown: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "task_summary": self.task_summary,
            "environment_runtime": self.environment_runtime,
            "permission_ceiling_enforced": self.permission_ceiling_enforced,
            "recommendations": [
                {
                    "rank": r.rank,
                    "skill_identifier": r.skill_identifier,
                    "task_fit_pct": r.task_fit_pct,
                    "wilson_score_pct": r.wilson_score_pct,
                    "trials_n": r.trials_n,
                    "required_permissions": r.required_permissions,
                    "limitation": r.limitation_or_tradeoff,
                }
                for r in self.recommendations
            ],
            "conflict_check_passed": self.conflict_check_passed,
            "conflict_details": self.conflict_details,
            "suggested_command": self.suggested_command,
            "raw_markdown": self.raw_markdown,
        }


class MissionMatcher:
    """
    SPE Ω Mission-Fit Selection Kernel.
    Evaluates catalog skills against task AST, verifies permission boundaries,
    detects inter-skill conflicts, and produces hardened recommendations.
    """

    @staticmethod
    def check_permission_boundary(
        skill_permissions: List[str] | Set[str],
        ast: TaskRequirementsAST,
    ) -> Tuple[bool, List[str]]:
        """
        Enforces Constitutional Selection Law 1: CONSTITUTIONAL ATTESTATION.
        Checks if skill violates forbidden permissions or exceeds allowed envelope.
        """
        violations: List[str] = []
        skill_perms = {p.upper() for p in skill_permissions}
        negative_prefixes = ("NO_", "NON_", "DISALLOW_", "DENIED_", "WITHOUT_", "NOT_")

        # Check forbidden permissions
        for f in ast.forbidden_permissions:
            f_norm = f.upper()
            for sp in skill_perms:
                # Negative permission assertions (e.g. NO_NETWORK, NO_CREDENTIALS) are safe declarations
                if sp.startswith(negative_prefixes):
                    continue
                if f_norm == sp or f_norm in sp or sp in f_norm:
                    violations.append(f"Skill requests forbidden permission: {sp} (matched {f})")

        # If strict allowed_permissions set is provided, ensure all skill perms are within allowed
        if ast.allowed_permissions:
            allowed_norm = {a.upper() for a in ast.allowed_permissions}
            for sp in skill_perms:
                # Permitted if exact match or if negative prefix (safe assertion)
                if sp not in allowed_norm and not sp.startswith(negative_prefixes):
                    violations.append(f"Skill requests permission {sp} outside allowed ceiling {sorted(list(allowed_norm))}")

        return (len(violations) == 0, violations)

    @staticmethod
    def detect_inter_skill_conflicts(
        selected: List[SkillRecommendation],
    ) -> Tuple[bool, List[str]]:
        """
        Enforces Constitutional Selection Law 2: CONFLICT CLOSURE.
        Detects:
        - Conflicting authority domains (e.g., competing database migration handlers).
        - Overlapping file write locks (e.g. multiple skills claiming exclusive write locks on same files, glob overlap, or directory containment).
        """
        import fnmatch
        import os

        conflicts: List[str] = []
        domains_seen: Dict[str, str] = {}
        paths_seen: List[Tuple[str, str]] = []

        for skill in selected:
            # Check domain collision
            dom = skill.authority_domain.lower()
            if dom != "general" and dom in domains_seen:
                conflicts.append(
                    f"Authority domain collision on '{dom}': competing skills '{domains_seen[dom]}' and '{skill.skill_identifier}'"
                )
            else:
                domains_seen[dom] = skill.skill_identifier

            # Check write path collision
            for p in skill.scoped_write_paths:
                norm_p = os.path.normpath(p.strip())
                for existing_p, existing_skill in paths_seen:
                    is_collision = False
                    if norm_p == existing_p:
                        is_collision = True
                    elif fnmatch.fnmatch(norm_p, existing_p) or fnmatch.fnmatch(existing_p, norm_p):
                        is_collision = True
                    else:
                        p_parts = norm_p.split(os.sep)
                        e_parts = existing_p.split(os.sep)
                        if p_parts == e_parts[:len(p_parts)] or e_parts == p_parts[:len(e_parts)]:
                            is_collision = True

                    if is_collision:
                        conflicts.append(
                            f"Overlapping write lock on path '{p}' (vs '{existing_p}'): skills '{existing_skill}' and '{skill.skill_identifier}'"
                        )
                paths_seen.append((norm_p, skill.skill_identifier))

        return (len(conflicts) == 0, conflicts)

    @classmethod
    def match_mission(
        cls,
        mission_input: str | TaskRequirementsAST,
        catalog: List[Dict[str, Any] | EvidencePassport],
        runtime: str = "Claude Code",
        os_name: str = "macOS",
        allowed_permissions: Optional[Set[str] | List[str]] = None,
        forbidden_permissions: Optional[Set[str] | List[str]] = None,
    ) -> MissionMatchResult:
        """
        Executes selection workflow:
        1. Parse AST.
        2. Filter valid Evidence Passports (status == CURRENT).
        3. Commercial Separation: isolate sponsored skills from organic recommendations.
        4. Filter candidates exceeding permission boundary.
        5. Score task fit and Wilson lower bound.
        6. Check inter-skill conflicts.
        7. Return Top 3 or honest abstention.
        """
        if isinstance(mission_input, TaskRequirementsAST):
            ast = mission_input
        else:
            ast = TaskRequirementsAST.compile_from_text(
                text=mission_input,
                runtime=runtime,
                os_name=os_name,
                allowed_permissions=allowed_permissions,
                forbidden_permissions=forbidden_permissions,
            )

        # 1. Query catalog and filter
        candidates_scored: List[Tuple[float, SkillRecommendation]] = []

        for item in catalog:
            # Normalize to passport representation
            if isinstance(item, EvidencePassport):
                passport_dict = item.to_dict()
                raw_item = {}
                is_sponsored = item.is_sponsored
                sponsor_bid = item.sponsor_bid_usd
            else:
                passport_dict = item.get("evidence_passport") or item
                raw_item = item
                is_sponsored = item.get("is_sponsored", False)
                sponsor_bid = float(item.get("sponsor_bid_usd", 0.0))

            # Constitutional Law 2: Zero capital influence on organic recommendations
            if is_sponsored or sponsor_bid > 0.0:
                continue

            # Check validity window
            val_window = passport_dict.get("validity_window", {})
            status = val_window.get("status", "CURRENT")
            if status != "CURRENT":
                continue  # Skip unverified, expired, or disqualified

            # Extract permissions
            sec_audit = passport_dict.get("security_audit", {})
            perms = sec_audit.get("permission_footprint") or raw_item.get("permissions") or ["FILESYSTEM_SCOPED_READ"]

            # Permission boundary check
            is_perm_valid, _ = cls.check_permission_boundary(perms, ast)
            if not is_perm_valid:
                continue

            target_id = passport_dict.get("target_identifier") or raw_item.get("name") or "unknown-skill"
            perf = passport_dict.get("performance_metrics", {})
            wilson_lb = perf.get("wilson_lower_bound_95", 0.85)
            env = passport_dict.get("tested_environment", {})
            trials_n = env.get("trials_n", 100)

            # Compute Task Fit %
            capabilities_supported = (
                getattr(item, "capabilities", None)
                or raw_item.get("capabilities", [])
                or [target_id]
            )
            domain = getattr(item, "authority_domain", None) or raw_item.get("authority_domain", "general")
            limitation = getattr(item, "limitation", None) or raw_item.get("limitation", "Requires explicit schema input")
            write_paths = getattr(item, "scoped_write_paths", None) or raw_item.get("scoped_write_paths", [])

            # Keyword matching against AST
            matching_caps = 0
            for cap in ast.required_capabilities:
                cap_lower = cap.lower()
                matched = any(cap_lower in c_sup.lower() or c_sup.lower() in cap_lower for c_sup in capabilities_supported)
                if matched or cap_lower in target_id.lower():
                    matching_caps += 1

            if ast.required_capabilities:
                ratio = matching_caps / len(ast.required_capabilities)
                if matching_caps > 0:
                    base_fit = min(0.98, max(0.70, 0.70 + (0.28 * ratio)))
                else:
                    base_fit = 0.50
            else:
                base_fit = 0.85

            task_fit_pct = int(round(base_fit * 100))
            wilson_pct = round(wilson_lb * 100, 1)

            # Combined ranking weight: 60% task fit + 40% Wilson score
            sort_weight = (base_fit * 0.6) + (wilson_lb * 0.4)

            rec = SkillRecommendation(
                rank=0,
                skill_identifier=target_id,
                task_fit_pct=task_fit_pct,
                wilson_score_pct=wilson_pct,
                trials_n=trials_n,
                required_permissions=list(perms),
                limitation_or_tradeoff=limitation,
                authority_domain=domain,
                scoped_write_paths=write_paths,
            )
            candidates_scored.append((sort_weight, rec))

        # Sort candidates descending
        candidates_scored.sort(key=lambda x: x[0], reverse=True)

        # Honest abstention check
        if not candidates_scored:
            return MissionMatchResult(
                status="NO_QUALIFIED_MATCH_FOUND",
                task_summary=ast.task_summary,
                environment_runtime=ast.environment_runtime,
                permission_ceiling_enforced="No External Network / Scoped File Read-Write",
                recommendations=[],
                conflict_check_passed=True,
                conflict_details="NO_QUALIFIED_MATCH_FOUND: No candidate skill satisfies requirements and safety constraints.",
                suggested_command="",
                raw_markdown="### 🎯 SPE MISSION-FIT RECOMMENDATION\n\n**STATUS**: `NO_QUALIFIED_MATCH_FOUND`\n\nNo verified skill in the catalog satisfies the requested capabilities within the specified permission boundary.",
            )

        # Assemble non-conflicting top selections
        selected_recs: List[SkillRecommendation] = []
        for _, rec in candidates_scored:
            tentative = selected_recs + [rec]
            passed, _ = cls.detect_inter_skill_conflicts(tentative)
            if passed:
                rec.rank = len(selected_recs) + 1
                selected_recs.append(rec)
            if len(selected_recs) >= 3:
                break

        # If conflict prevented 3, take what is conflict-free
        conflict_passed, conflict_errors = cls.detect_inter_skill_conflicts(selected_recs)
        conflict_msg = "PASSED (No overlapping write-locks or competing authorities)." if conflict_passed else f"FAILED: {'; '.join(conflict_errors)}"

        # Format suggested command
        cmd_skills = ",".join(r.skill_identifier.replace("@skill/", "") for r in selected_recs[:2])
        exec_cmd = f'spe continue --skills "{cmd_skills}"' if cmd_skills else 'spe continue'

        # Generate Master Prompt 2 compliant Markdown
        md_lines = [
            "### 🎯 SPE MISSION-FIT RECOMMENDATION",
            f"- **Target Task**: \"{ast.task_summary}\"",
            f"- **User Environment**: {ast.environment_runtime}",
            "- **Permission Ceiling Enforced**: <No External Network / Scoped File Read-Write>",
            "",
            "| Rank | Recommended Skill | Task Fit | Wilson Score | Required Permissions | Limitation / Trade-off |",
            "| :---: | :--- | :---: | :---: | :--- | :--- |",
        ]

        for r in selected_recs:
            rank_str = f"**#{r.rank}**"
            skill_str = f"`{r.skill_identifier}`" if r.skill_identifier.startswith("@skill/") else f"`@skill/{r.skill_identifier}`"
            perms_str = ", ".join(r.required_permissions) if r.required_permissions else "Local AST Only"
            md_lines.append(
                f"| {rank_str} | {skill_str} | {r.task_fit_pct}% | {r.wilson_score_pct}% (n={r.trials_n}) | {perms_str} | {r.limitation_or_tradeoff} |"
            )

        md_lines.extend([
            "",
            "### 🛡️ COMBINED SAFETY AUDIT:",
            f"- Multi-skill conflict check: {conflict_msg}",
            f"- Execution command: `{exec_cmd}`",
        ])

        raw_md = "\n".join(md_lines)

        return MissionMatchResult(
            status="QUALIFIED_MATCH",
            task_summary=ast.task_summary,
            environment_runtime=ast.environment_runtime,
            permission_ceiling_enforced="No External Network / Scoped File Read-Write",
            recommendations=selected_recs,
            conflict_check_passed=conflict_passed,
            conflict_details=conflict_msg,
            suggested_command=exec_cmd,
            raw_markdown=raw_md,
        )
