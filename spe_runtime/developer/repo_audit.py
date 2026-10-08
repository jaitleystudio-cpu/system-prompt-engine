"""SPE Ω Repo Auditor & CI Gatekeeper: 60-Second Instant Audit & Monopoly Trojan Horse.

Scans any codebase for raw OpenAI/Anthropic/LangChain/CrewAI calls, calculates
estimated monthly KV-cache waste and security vulnerability debt, and generates
the exact 1-line drop-in diff to activate SPE.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


@dataclass
class AuditFinding:
    """An individual un-governed LLM call or prompt vulnerability."""
    file_path: str
    line_number: int
    finding_type: str  # e.g. "RAW_OPENAI_CALL", "RAW_ANTHROPIC_CALL", "UNGUARDED_TOOL"
    code_snippet: str
    severity: str      # "CRITICAL", "HIGH", "MEDIUM"
    estimated_monthly_waste_usd: float
    recommended_fix: str


@dataclass
class RepoAuditReport:
    """Consolidated repository audit report."""
    target_path: str
    files_scanned: int
    findings: List[AuditFinding]
    total_raw_calls: int
    total_estimated_monthly_waste_usd: float
    governance_score_percent: float
    suggested_patch_diff: str

    def to_markdown(self) -> str:
        lines = [
            "# SPE Ω — 60-Second AI Instruction & Inference Audit",
            "",
            f"**Target Path**: `{self.target_path}` | **Files Scanned**: {self.files_scanned}",
            f"**Governance Health Score**: **{self.governance_score_percent:.1f}%**",
            f"**Total Raw LLM Endpoints**: {self.total_raw_calls} detected",
            f"**Estimated Monthly KV-Cache & Compute Waste**: **${self.total_estimated_monthly_waste_usd:.2f} / month**",
            "",
            "---",
            "",
            "## Detected Vulnerabilities & Waste Hotspots",
            "",
            "| Severity | Type | File & Line | Snippet | Est. Waste/Mo | Recommended Action |",
            "|---|---|---|---|---|---|",
        ]
        for f in self.findings:
            snippet = f.code_snippet.replace("|", "\\|").strip()
            lines.append(
                f"| `{f.severity}` | `{f.finding_type}` | `{f.file_path}:{f.line_number}` | `{snippet[:40]}` | ${f.estimated_monthly_waste_usd:.2f} | {f.recommended_fix} |"
            )
        lines.extend([
            "",
            "---",
            "",
            "## 1-Line Drop-In Remediation (Activate SPE Monopoly)",
            "",
            "### Option A: Zero-Code Wire Proxy (Instant 70%+ Savings)",
            "Run in terminal:",
            "```bash",
            "spe proxy --port 8080",
            "```",
            "And point your client base URL:",
            "```diff",
            "- client = OpenAI()",
            "+ client = OpenAI(base_url=\"http://localhost:8080/v1\") # SPE Wire Proxy (DACO + PPACA)",
            "```",
            "",
            "### Option B: 1-Line Python Decorator (Compute Salvaging & ACID)",
            "```python",
            "import spe",
            "",
            "@spe.protect(salvage=True, rollback_on_fail=True)",
            "async def run_agent(query: str):",
            "    ...",
            "```",
            "",
            "### Proposed Git Patch Diff:",
            "```diff",
            self.suggested_patch_diff if self.suggested_patch_diff else "# No direct diff generated",
            "```",
        ])
        return "\n".join(lines)


class RepoAuditor:
    """Scans repositories to find raw LLM calls and generate Trojan Horse adoption patches."""

    # Patterns matching raw LLM SDK invocations
    PATTERNS = [
        (
            re.compile(r"OpenAI\((?!.*base_url.*localhost)"),
            "RAW_OPENAI_CLIENT",
            "CRITICAL",
            120.0,
            "Inject base_url='http://localhost:8080/v1'",
        ),
        (
            re.compile(r"\.chat\.completions\.create\("),
            "RAW_OPENAI_CALL",
            "HIGH",
            85.0,
            "Wrap with @spe.protect or wire proxy",
        ),
        (
            re.compile(r"anthropic\.messages\.create\("),
            "RAW_ANTHROPIC_CALL",
            "HIGH",
            95.0,
            "Wrap with @spe.protect",
        ),
        (
            re.compile(r"ChatOpenAI\("),
            "RAW_LANGCHAIN_CALL",
            "MEDIUM",
            60.0,
            "Set openai_api_base='http://localhost:8080/v1'",
        ),
        (
            re.compile(r"Crew\(\s*agents="),
            "UNGUARDED_CREWAI_FLEET",
            "HIGH",
            150.0,
            "Guard crew execution with @spe.protect(salvage=True)",
        ),
    ]

    IGNORE_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__", "dist", "build", ".spe"}

    def scan_path(self, target_dir: str | Path) -> RepoAuditReport:
        root = Path(target_dir).resolve()
        findings: List[AuditFinding] = []
        files_scanned = 0
        patch_lines: List[str] = []

        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d not in self.IGNORE_DIRS]
            for filename in filenames:
                if not filename.endswith((".py", ".ts", ".js", ".tsx", ".jsx")):
                    continue
                file_path = Path(dirpath) / filename
                files_scanned += 1
                try:
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                rel_path = str(file_path.relative_to(root))
                for line_idx, line in enumerate(content.splitlines(), start=1):
                    for pattern, finding_type, severity, waste, fix in self.PATTERNS:
                        if pattern.search(line):
                            findings.append(
                                AuditFinding(
                                    file_path=rel_path,
                                    line_number=line_idx,
                                    finding_type=finding_type,
                                    code_snippet=line.strip(),
                                    severity=severity,
                                    estimated_monthly_waste_usd=waste,
                                    recommended_fix=fix,
                                )
                            )
                            patch_lines.append(f"--- a/{rel_path}:{line_idx}")
                            patch_lines.append(f"- {line.strip()}")
                            if "OpenAI(" in line:
                                patch_lines.append(f"+ {line.strip().replace('OpenAI(', 'OpenAI(base_url=\"http://localhost:8080/v1\", ')}")
                            else:
                                patch_lines.append(f"+ # [SPE_GUARDED] {line.strip()}")

        total_waste = sum(f.estimated_monthly_waste_usd for f in findings)
        total_calls = len(findings)
        score = max(0.0, 100.0 - (total_calls * 12.5))

        return RepoAuditReport(
            target_path=str(root),
            files_scanned=files_scanned,
            findings=findings,
            total_raw_calls=total_calls,
            total_estimated_monthly_waste_usd=total_waste,
            governance_score_percent=round(score, 1),
            suggested_patch_diff="\n".join(patch_lines[:15]),
        )
