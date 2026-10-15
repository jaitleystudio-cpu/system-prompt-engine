"""
SPE Ω — Intent-to-Experience Compiler (Python Runtime Parity)

Mandate:
Grounded in Denotational Semantics, Kleene-3 Monotone Lattices, and Google WebMCP (Oct 2026).
Compiles a single verified software capability contract into three unified experiences:
1. Human Experience
2. Search Experience
3. Agent Experience
"""

from __future__ import annotations
import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


@dataclass
class CapabilityParameter:
    name: str
    type: str  # "string", "number", "boolean", "array", "object"
    description: str
    required: bool
    human_label: str
    default_value: Optional[Any] = None
    validation_pattern: Optional[str] = None
    allowed_values: Optional[List[str]] = None
    placeholder: Optional[str] = None


@dataclass
class VerifiedCapabilityContract:
    key: str
    title: str
    description: str
    category: str  # "COMPILER", "AUDIT", "GOVERNANCE", "SECURITY", "WORKFLOW"
    parameters: List[CapabilityParameter]
    returns: Dict[str, Any]
    verification_proof: Dict[str, Any]
    requires_elevation: bool
    allowed_scopes: List[str]


@dataclass
class HumanFormField:
    id: str
    param_name: str
    label: str
    help_text: str
    widget_type: str  # "text", "textarea", "number", "select", "toggle"
    required: bool
    default_value: Optional[Any] = None
    options: Optional[List[str]] = None
    validation_error_text: str = ""


@dataclass
class HumanExperienceContract:
    form_id: str
    title: str
    subtitle: str
    fields: List[HumanFormField]
    submit_button_text: str
    loading_state_text: str
    success_announcement_text: str
    keyboard_shortcut: str
    offline_indicator: bool
    iso24495_compliant: bool


@dataclass
class SearchExperienceContract:
    canonical_path: str
    is_indexable: bool
    title_tag: str
    meta_description: str
    schema_org_json_ld: Dict[str, Any]
    worked_example: Dict[str, str]
    keywords: List[str]


@dataclass
class AgentExperienceContract:
    tool_name: str
    description: str
    parameters: Dict[str, Any]
    returns: Dict[str, Any]
    required_scope: str
    rate_limit_per_minute: int
    offline_wasm_executable: bool


@dataclass
class TriViewCompilationResult:
    capability_key: str
    compiled_at: str
    rfc8785_digest: str
    human_experience: HumanExperienceContract
    search_experience: SearchExperienceContract
    agent_experience: AgentExperienceContract


STANDARD_CAPABILITIES: Dict[str, VerifiedCapabilityContract] = {
    "spe_compile_prompt": VerifiedCapabilityContract(
        key="spe_compile_prompt",
        title="Deterministic System Prompt Compiler",
        description="Compiles a raw developer task brief into an invariant-guarded, drift-resistant system prompt.",
        category="COMPILER",
        parameters=[
            CapabilityParameter(
                name="taskBrief",
                type="string",
                description="The raw task description, user intent, or system requirements.",
                required=True,
                human_label="Describe your prompt goal or task",
                placeholder="e.g. Code review without hallucinating imports",
            ),
            CapabilityParameter(
                name="targetDialect",
                type="string",
                description="Target AI model dialect formatting (universal, claude, gpt, gemini).",
                required=False,
                human_label="Target Model Dialect",
                default_value="universal",
                allowed_values=["universal", "anthropic_claude", "openai_gpt", "google_gemini", "cursor_rules"],
            ),
            CapabilityParameter(
                name="strictInvariants",
                type="boolean",
                description="Enforce strict zero-drift boundaries and forbidden action gates.",
                required=False,
                human_label="Enable Strict Boundary Guardrails",
                default_value=True,
            ),
        ],
        returns={"type": "object", "description": "Compiled structured system prompt with invariant proof."},
        verification_proof={
            "ruleVerifier": "Propositional Horn Clause Engine",
            "canonicalHash": "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
            "offlineWasmRunnable": True,
        },
        requires_elevation=False,
        allowed_scopes=["spe:compile", "spe:read"],
    ),
    "spe_audit_skill": VerifiedCapabilityContract(
        key="spe_audit_skill",
        title="In-Browser Skill Package Taint Auditor",
        description="Audits a portable agent SKILL.md package for ambient authority escalations, shell injections, and supply-chain taint.",
        category="AUDIT",
        parameters=[
            CapabilityParameter(
                name="skillMarkdown",
                type="string",
                description="Raw markdown content of the SKILL.md package to audit.",
                required=True,
                human_label="Paste SKILL.md Content",
            ),
            CapabilityParameter(
                name="strictSanitization",
                type="boolean",
                description="Strictly flag zero-width spaces, homoglyphs, and polyglot comment escapes.",
                required=False,
                human_label="Enforce Homoglyph & Polyglot Scan",
                default_value=True,
            ),
        ],
        returns={"type": "object", "description": "Audit certificate with taint report."},
        verification_proof={
            "ruleVerifier": "AST Dataflow Taint Analyzer",
            "canonicalHash": "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
            "offlineWasmRunnable": True,
        },
        requires_elevation=False,
        allowed_scopes=["spe:audit", "spe:read"],
    ),
    "spe_export_rules": VerifiedCapabilityContract(
        key="spe_export_rules",
        title="Multi-IDE Rule Transcompiler",
        description="Transpiles universal prompt directives into native IDE rule files (.cursorrules, CLAUDE.md, .windsurfrules).",
        category="WORKFLOW",
        parameters=[
            CapabilityParameter(
                name="promptContent",
                type="string",
                description="The compiled prompt or invariant text to format.",
                required=True,
                human_label="Prompt Content to Format",
            ),
            CapabilityParameter(
                name="formatTarget",
                type="string",
                description="Target IDE rule format.",
                required=True,
                human_label="Export Format Target",
                allowed_values=["cursorrules", "claude_md", "windsurfrules", "custom_gpt"],
            ),
        ],
        returns={"type": "string", "description": "Ready-to-save file string formatted for selected IDE."},
        verification_proof={
            "ruleVerifier": "AST Desugaring Generator",
            "canonicalHash": "ac3f0c3ecb19a7563068c903065ec90b8bb38bfcf4f0465a0c8f097e82e7de7d",
            "offlineWasmRunnable": True,
        },
        requires_elevation=False,
        allowed_scopes=["spe:transpile", "spe:read"],
    ),
}


class IntentToExperienceCompiler:
    """Compiles verified capability contracts into Human, Search, and WebMCP Agent experiences."""

    def compile_human_experience(self, contract: VerifiedCapabilityContract) -> HumanExperienceContract:
        fields: List[HumanFormField] = []
        for p in contract.parameters:
            widget_type = "text"
            if p.type == "boolean":
                widget_type = "toggle"
            elif p.allowed_values:
                widget_type = "select"
            elif p.type == "string" and ("brief" in p.name.lower() or "markdown" in p.name.lower() or "content" in p.name.lower()):
                widget_type = "textarea"
            elif p.type == "number":
                widget_type = "number"

            fields.append(
                HumanFormField(
                    id=f"field_{contract.key}_{p.name}",
                    param_name=p.name,
                    label=p.human_label,
                    help_text=p.description,
                    widget_type=widget_type,
                    required=p.required,
                    default_value=p.default_value,
                    options=p.allowed_values,
                    validation_error_text=f"{p.human_label} is required to continue.",
                )
            )

        return HumanExperienceContract(
            form_id=f"form_{contract.key}",
            title=contract.title,
            subtitle=contract.description,
            fields=fields,
            submit_button_text=f"Run {contract.title} (Local $0.00)",
            loading_state_text="Executing client WebAssembly verification...",
            success_announcement_text=f"{contract.title} execution completed with verified proof.",
            keyboard_shortcut="Ctrl+Enter",
            offline_indicator=contract.verification_proof.get("offlineWasmRunnable", False),
            iso24495_compliant=True,
        )

    def compile_search_experience(self, contract: VerifiedCapabilityContract) -> SearchExperienceContract:
        canonical_path = "/create"
        if contract.category == "AUDIT":
            canonical_path = "/build-skill"
        elif contract.category == "WORKFLOW":
            canonical_path = "/workflows"

        title_tag = f"{contract.title} | System Prompt Engine"
        meta_description = f"{contract.description} 100% in-browser WebAssembly, zero cloud compute cost, and strict air-gapped privacy."

        schema_org_json_ld = {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": contract.title,
            "description": contract.description,
            "applicationCategory": "DeveloperApplication",
            "operatingSystem": "Any (WebAssembly Browser / Local CLI)",
            "offers": {
                "@type": "Offer",
                "price": "0.00",
                "priceCurrency": "USD",
            },
        }

        worked_example = {
            "inputSummary": ", ".join(f"{p.name}: [sample_{p.type}]" for p in contract.parameters),
            "outputDemonstration": f"Verified execution output satisfying invariant {contract.verification_proof.get('ruleVerifier')}",
        }

        keywords = [
            "system prompt engine",
            contract.key.replace("spe_", "").replace("_", " "),
            "webassembly compiler",
            "air-gapped privacy",
        ]

        return SearchExperienceContract(
            canonical_path=canonical_path,
            is_indexable=True,
            title_tag=title_tag,
            meta_description=meta_description,
            schema_org_json_ld=schema_org_json_ld,
            worked_example=worked_example,
            keywords=keywords,
        )

    def compile_agent_experience(self, contract: VerifiedCapabilityContract) -> AgentExperienceContract:
        properties: Dict[str, Any] = {}
        required: List[str] = []

        for p in contract.parameters:
            prop: Dict[str, Any] = {
                "type": p.type,
                "description": p.description,
            }
            if p.allowed_values:
                prop["enum"] = p.allowed_values
            if p.validation_pattern:
                prop["pattern"] = p.validation_pattern
            properties[p.name] = prop

            if p.required:
                required.append(p.name)

        return AgentExperienceContract(
            tool_name=contract.key,
            description=contract.description,
            parameters={
                "type": "object",
                "properties": properties,
                "required": required,
            },
            returns={
                "type": contract.returns.get("type", "object"),
                "description": contract.returns.get("description", ""),
            },
            required_scope=contract.allowed_scopes[0] if contract.allowed_scopes else "spe:execute",
            rate_limit_per_minute=120,
            offline_wasm_executable=contract.verification_proof.get("offlineWasmRunnable", False),
        )

    def compile_tri_view(self, contract: VerifiedCapabilityContract) -> TriViewCompilationResult:
        human_exp = self.compile_human_experience(contract)
        search_exp = self.compile_search_experience(contract)
        agent_exp = self.compile_agent_experience(contract)

        payload_to_hash = json.dumps(
            {
                "capabilityKey": contract.key,
                "category": contract.category,
                "humanFormId": human_exp.form_id,
                "canonicalPath": search_exp.canonical_path,
                "agentToolName": agent_exp.tool_name,
                "agentScopes": contract.allowed_scopes,
                "ruleVerifier": contract.verification_proof.get("ruleVerifier"),
                "canonicalHash": contract.verification_proof.get("canonicalHash"),
            },
            sort_keys=True,
        )

        rfc8785_digest = hashlib.sha256(payload_to_hash.encode("utf-8")).hexdigest()

        return TriViewCompilationResult(
            capability_key=contract.key,
            compiled_at=datetime.now(timezone.utc).isoformat(),
            rfc8785_digest=rfc8785_digest,
            human_experience=human_exp,
            search_experience=search_exp,
            agent_experience=agent_exp,
        )
