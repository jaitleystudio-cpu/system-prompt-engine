"""Repository scanner and migration adopter (spe adopt)."""

from __future__ import annotations

import json
import os
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from spe_runtime.spe_package.spec import SpePackage

SDK_PATTERNS = {
    "openai": [r"import\s+.*OpenAI", r"from\s+openai", r"require\([\"']openai[\"']\)", r"@ai-sdk/openai"],
    "anthropic": [r"import\s+.*Anthropic", r"from\s+anthropic", r"require\([\"']@anthropic-ai/sdk[\"']\)", r"@ai-sdk/anthropic"],
    "gemini": [r"google-generativeai", r"@google/generative-ai", r"from\s+google\.genai"],
    "vercel_ai_sdk": [r"ai/react", r"import\s+.*from\s+[\"']ai[\"']", r"generateText", r"streamText"],
    "langchain": [r"from\s+langchain", r"import\s+.*from\s+[\"']@langchain", r"PromptTemplate"],
    "mcp": [r"@modelcontextprotocol/sdk", r"Server\(", r"mcp_server", r"ListToolsRequestSchema"],
}

PROMPT_PATTERNS = [
    r"(?i)system_prompt\s*=\s*[\"']{1,3}(.*?)[\"']{1,3}",
    r"(?i)system:\s*[\"']{1,3}(.*?)[\"']{1,3}",
    r"(?i)const\s+SYSTEM_INSTRUCTION\s*=",
    r"(?i)role:\s*[\"']system[\"']",
]

UNDOCUMENTED_CONSTRAINTS = [
    r"(?i)(never|do not|don't|must not|prohibited)\s+([a-zA-Z0-9_\s]{5,60})",
    r"(?i)(always|must|mandatory|strictly)\s+([a-zA-Z0-9_\s]{5,60})",
]


@dataclass
class DetectedArtifact:
    artifact_type: str  # prompt, tool, sdk_usage, agent_def, config
    provider: str
    file_path: str
    line_number: int
    snippet: str
    confidence: float
    candidate_relationships: list[str] = field(default_factory=list)
    undocumented_constraints: list[str] = field(default_factory=list)


@dataclass
class AdoptionReport:
    root_dir: str
    detected_prompts: int
    detected_agents: int
    detected_tools: int
    detected_providers: list[str]
    detected_schemas: int
    undocumented_constraints_count: int
    artifacts: list[DetectedArtifact]
    migration_plan: list[dict[str, Any]]


class RepoAdoptionScanner:
    def __init__(self, root: Path | str) -> None:
        self.root = Path(root).resolve()

    def scan(self) -> AdoptionReport:
        artifacts: list[DetectedArtifact] = []
        providers_found: set[str] = set()
        prompts_count = 0
        agents_count = 0
        tools_count = 0
        schemas_count = 0
        constraints_found: list[str] = []

        # Ignore typical build/deps dirs
        ignored = {".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__", ".turbo", ".next", "target-canonical"}

        for root_dir, dirs, files in os.walk(self.root):
            dirs[:] = [d for d in dirs if d not in ignored]
            for file_name in files:
                p = Path(root_dir) / file_name
                if file_name not in {".cursorrules", "promptfooconfig.yaml", "promptfoo.yaml"} and p.suffix.lower() not in {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".json", ".yaml", ".yml", ".md"}:
                    continue
                if file_name in {"package-lock.json", "yarn.lock", "pnpm-lock.yaml"} or p.stat().st_size > 300_000:
                    continue

                rel_str = str(p.relative_to(self.root))
                if p.name in {".cursorrules", "promptfooconfig.yaml", "promptfoo.yaml"}:
                    artifacts.append(DetectedArtifact(
                        artifact_type="config",
                        provider="cursor" if ".cursorrules" in p.name else "promptfoo",
                        file_path=rel_str,
                        line_number=1,
                        snippet=f"Detected instruction config: {p.name}",
                        confidence=1.0,
                    ))

                try:
                    content = p.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue

                lines = content.splitlines()
                for line_idx, line in enumerate(lines, 1):
                    # SDK detection
                    for prov, patterns in SDK_PATTERNS.items():
                        for pat in patterns:
                            if re.search(pat, line):
                                providers_found.add(prov)
                                artifacts.append(DetectedArtifact(
                                    artifact_type="sdk_usage",
                                    provider=prov,
                                    file_path=rel_str,
                                    line_number=line_idx,
                                    snippet=line.strip()[:120],
                                    confidence=0.9,
                                ))
                                break

                    # Prompt detection
                    for p_pat in PROMPT_PATTERNS:
                        if re.search(p_pat, line):
                            prompts_count += 1
                            # Check for undocumented constraints
                            local_constraints = []
                            context_window = "\n".join(lines[max(0, line_idx - 1) : min(len(lines), line_idx + 15)])
                            for c_pat in UNDOCUMENTED_CONSTRAINTS:
                                for match in re.finditer(c_pat, context_window):
                                    local_constraints.append(match.group(0).strip())
                                    constraints_found.append(match.group(0).strip())

                            artifacts.append(DetectedArtifact(
                                artifact_type="prompt",
                                provider="unknown",
                                file_path=rel_str,
                                line_number=line_idx,
                                snippet=line.strip()[:120],
                                confidence=0.85,
                                undocumented_constraints=local_constraints,
                            ))
                            break

                    # Tool & Schema detection
                    if "tools" in line and ("[" in line or "{" in line):
                        tools_count += 1
                    if "json_schema" in line or "z.object(" in line or "BaseModel" in line:
                        schemas_count += 1
                    if "Agent(" in line or "agent = " in line or "createReactAgent" in line:
                        agents_count += 1

        migration_plan = [
            {
                "step": 1,
                "action": "CREATE_SPE_PROJECT",
                "description": "Initialize .spe package structure and manifest.json",
            },
            {
                "step": 2,
                "action": "EXTRACT_PROTECTED_INTENT",
                "description": f"Lift {len(constraints_found)} discovered constraints into ProtectedIntent non-negotiables",
            },
            {
                "step": 3,
                "action": "BIND_PROMPT_ABI",
                "description": f"Compile detected prompts to canonical Prompt ABI for targets: {sorted(providers_found) or ['openai']}",
            },
            {
                "step": 4,
                "action": "SETUP_CI_MERGE_GATE",
                "description": "Install spe check --strict GitHub Action and pre-commit hook",
            },
        ]

        return AdoptionReport(
            root_dir=str(self.root),
            detected_prompts=prompts_count,
            detected_agents=agents_count,
            detected_tools=tools_count,
            detected_providers=sorted(providers_found),
            detected_schemas=schemas_count,
            undocumented_constraints_count=len(constraints_found),
            artifacts=artifacts,
            migration_plan=migration_plan,
        )


def adopt_repository(target_path: Path | str, mode: str = "scan") -> dict[str, Any]:
    target = Path(target_path).resolve()
    scanner = RepoAdoptionScanner(target)
    report = scanner.scan()

    if mode == "apply":
        from spe_runtime.sov.kernel import SOVKernel

        # Sovereign multi-IDE adoption with atomic rollback snapshot
        sov_res = SOVKernel.adopt_repository(root_dir=target, skill_name=f"spe-{target.name}")

        spe_dir = target / ".spe"
        spe_pkg = SpePackage.create_layout(spe_dir, package_id=f"spe.{target.name}.adopted")
        # Write adopted intent
        intent_data = {
            "goal": f"Adopted AI instruction suite for {target.name}",
            "adopted_from": str(target),
            "detected_prompts": report.detected_prompts,
            "detected_providers": report.detected_providers,
            "ides_detected": sov_res.ides_detected,
        }
        (spe_dir / "intent.json").write_text(json.dumps(intent_data, indent=2), encoding="utf-8")
        spe_pkg.update_digests()
        return {
            "mode": "apply",
            "status": "APPLIED",
            "package_path": str(spe_dir),
            "ides_detected": sov_res.ides_detected,
            "rollback_marker_path": sov_res.rollback_marker_path,
            "duration_seconds": sov_res.duration_seconds,
            "summary": asdict(report),
        }
    elif mode == "plan":
        return {
            "mode": "plan",
            "summary": asdict(report),
            "migration_plan": report.migration_plan,
        }
    else:
        return {
            "mode": "scan",
            "summary": asdict(report),
        }


def revert_repository(target_path: Path | str = ".", dry_run: bool = False) -> dict[str, Any]:
    from spe_runtime.sov.kernel import SOVKernel
    res = SOVKernel.revert_adoption(root_dir=target_path, dry_run=dry_run)
    return asdict(res)

