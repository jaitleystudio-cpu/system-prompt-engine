"""
Skill Auto-Installer & Dynamic Dispatcher for SPE Ω.
Part of WDIC-VCT & Counterfactual Witness Continuation (CWC).

Detects missing technical domain skills, validates security integrity
(guarding against malicious skill scripts / exfiltration), and auto-injects
or installs verified skills into agent execution prompts.
"""

import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass(frozen=True)
class SkillRequirement:
    """
    A technical capability requirement mapped to a specialized environment skill.
    """
    skill_name: str
    domain: str
    is_installed: bool
    install_command: str
    security_verdict: str  # "SAFE", "SUSPICIOUS", "REJECTED"
    rationale: str


@dataclass
class SkillInstallationProposal:
    """
    Proposal to dynamically install or inject missing skills into the runtime.
    """
    required_skills: List[SkillRequirement]
    missing_skills: List[SkillRequirement]
    injected_prompt_headers: List[str]
    is_safe: bool


class SkillAutoInstaller:
    """
    Automated skill discovery, security qualification, and prompt injector.
    Eliminates model cognitive load by mapping tasks to exact specialized skills.
    """

    KNOWN_SKILL_REGISTRY: Dict[str, Dict[str, str]] = {
        "frontend-design": {
            "domain": "UI/UX & Frontend Styling",
            "install": "skills install frontend-design",
            "keywords": "ui,css,react,frontend,layout,tailwind,styling,design,button,responsive",
        },
        "systematic-debugging": {
            "domain": "Error Diagnosis & Bug Fixing",
            "install": "skills install systematic-debugging",
            "keywords": "bug,error,exception,traceback,fix,debug,crash,investigate,fail",
        },
        "tdd-workflow": {
            "domain": "Test-Driven Development",
            "install": "skills install tdd-workflow",
            "keywords": "test,tdd,pytest,jest,assert,unit test,regression,mock",
        },
        "security-auditor": {
            "domain": "Cybersecurity & Access Control",
            "install": "skills install security-auditor",
            "keywords": "security,auth,jwt,token,csrf,xss,injection,crypto,credentials,secret",
        },
        "clerk-auth": {
            "domain": "Authentication & Session Management",
            "install": "skills install clerk-auth",
            "keywords": "clerk,oauth,session,login,signup,auth middleware",
        },
        "drizzle-orm-expert": {
            "domain": "Database Schema & ORM Management",
            "install": "skills install drizzle-orm-expert",
            "keywords": "drizzle,sql,schema,migration,postgres,database,query",
        },
        "postgres-best-practices": {
            "domain": "PostgreSQL Optimization & Storage",
            "install": "skills install postgres-best-practices",
            "keywords": "postgres,acid,transaction,index,pool,query optimization",
        },
        "nextjs-best-practices": {
            "domain": "Next.js App Router Architecture",
            "install": "skills install nextjs-best-practices",
            "keywords": "nextjs,server component,app router,server actions,hydration",
        },
        "performance-engineer": {
            "domain": "Runtime Latency & Observability",
            "install": "skills install performance-engineer",
            "keywords": "latency,profiling,cpu,memory,benchmark,flamegraph,slow,bottleneck",
        },
        "writing-plans": {
            "domain": "Multi-Step Architecture & Planning",
            "install": "skills install writing-plans",
            "keywords": "plan,roadmap,architecture,multi-step,spec,design document",
        },
    }

    # Malicious patterns to reject during skill qualification
    MALICIOUS_PATTERNS = [
        re.compile(r"curl\s+.*\|\s*(?:bash|sh)", re.IGNORECASE),
        re.compile(r"wget\s+.*\|\s*(?:bash|sh)", re.IGNORECASE),
        re.compile(r"rm\s+-rf\s+/(?:\s|$)", re.IGNORECASE),
        re.compile(r"(?:api_key|password|secret|token)\s*=\s*['\"][^'\"]+['\"].*http", re.IGNORECASE),
        re.compile(r"requests\.post\(.*(?:evil|webhook|collect|exfil)", re.IGNORECASE),
    ]

    def __init__(self, local_installed_skills: Optional[Set[str]] = None):
        # Default installed skills from current environment if not passed
        self.installed_skills = local_installed_skills or {
            "frontend-design",
            "systematic-debugging",
            "tdd-workflow",
            "security-auditor",
            "writing-plans",
            "github",
            "jq",
        }

    def detect_required_skills(self, task_description: str, files_modified: Optional[List[str]] = None) -> List[SkillRequirement]:
        """
        Analyzes task intent and file extensions to detect necessary specialized skills.
        """
        text = task_description.lower()
        files = files_modified or []
        files_text = " ".join(files).lower()
        full_context = f"{text} {files_text}"

        requirements: List[SkillRequirement] = []
        matched_skills: Set[str] = set()

        for skill_name, meta in self.KNOWN_SKILL_REGISTRY.items():
            keywords = meta["keywords"].split(",")
            if any(re.search(rf"\b{re.escape(k.strip())}\b", full_context) for k in keywords):
                matched_skills.add(skill_name)

        # File-specific heuristics
        if any(f.endswith((".tsx", ".jsx", ".css", ".html")) for f in files):
            matched_skills.add("frontend-design")
        if any("test" in f or f.endswith((".spec.ts", ".test.ts", "_test.py", "test_.py")) for f in files):
            matched_skills.add("tdd-workflow")
        if any("auth" in f or "secret" in f for f in files):
            matched_skills.add("security-auditor")

        # Compile requirements
        for s in sorted(matched_skills):
            meta = self.KNOWN_SKILL_REGISTRY[s]
            is_installed = s in self.installed_skills
            requirements.append(
                SkillRequirement(
                    skill_name=s,
                    domain=meta["domain"],
                    is_installed=is_installed,
                    install_command=meta["install"],
                    security_verdict="SAFE",
                    rationale=f"Task involves {meta['domain'].lower()}",
                )
            )

        # If none matched, default to systematic-debugging and tdd-workflow
        if not requirements:
            requirements.append(
                SkillRequirement(
                    skill_name="systematic-debugging",
                    domain="Error Diagnosis & Bug Fixing",
                    is_installed="systematic-debugging" in self.installed_skills,
                    install_command=self.KNOWN_SKILL_REGISTRY["systematic-debugging"]["install"],
                    security_verdict="SAFE",
                    rationale="General defect-free execution",
                )
            )

        return requirements

    def audit_skill_safety(self, skill_content: str) -> Tuple[bool, str]:
        """
        Performs static security analysis on prospective skill scripts/instructions.
        Rejects arbitrary bash pipes, dangerous deletes, and network exfiltration.
        """
        for pattern in self.MALICIOUS_PATTERNS:
            if pattern.search(skill_content):
                return False, f"REJECTED: Malicious pattern detected ({pattern.pattern})"
        return True, "PASSED_SAFE"

    def formulate_installation_proposal(
        self,
        task_description: str,
        files_modified: Optional[List[str]] = None,
        skill_payloads_to_audit: Optional[Dict[str, str]] = None
    ) -> SkillInstallationProposal:
        """
        Synthesizes a complete skill binding proposal for task compilation.
        """
        requirements = self.detect_required_skills(task_description, files_modified)
        missing: List[SkillRequirement] = []
        headers: List[str] = []
        is_all_safe = True

        for req in requirements:
            if not req.is_installed:
                # Audit payload if provided
                if skill_payloads_to_audit and req.skill_name in skill_payloads_to_audit:
                    safe, msg = self.audit_skill_safety(skill_payloads_to_audit[req.skill_name])
                    if not safe:
                        is_all_safe = False
                        req = SkillRequirement(
                            skill_name=req.skill_name,
                            domain=req.domain,
                            is_installed=False,
                            install_command=req.install_command,
                            security_verdict="REJECTED",
                            rationale=msg,
                        )
                missing.append(req)

            # Build prompt directive header
            headers.append(f"- `@skill:{req.skill_name}` ({req.domain})")

        return SkillInstallationProposal(
            required_skills=requirements,
            missing_skills=missing,
            injected_prompt_headers=headers,
            is_safe=is_all_safe,
        )

    def auto_install_skill(self, skill_name: str) -> bool:
        """
        Simulates safe dynamic installation into the agent environment.
        """
        if skill_name in self.KNOWN_SKILL_REGISTRY:
            self.installed_skills.add(skill_name)
            return True
        return False
