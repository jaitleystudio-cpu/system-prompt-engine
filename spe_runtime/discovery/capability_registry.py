"""
spe_runtime/discovery/capability_registry.py

SPE Ω — Authoritative Dynamic Capability & AI Discovery Registry (Python Kernel)
Provides verified intent-matching, capability status classification, and free-tier metrics.
"""

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

@dataclass(frozen=True)
class SpeCapability:
    id: str
    name: str
    path: str
    status: str  # FREE, PRO, HOST_DEPENDENT, EXPERIMENTAL, UNAVAILABLE
    category: str
    description: str
    user_intent_triggers: List[str]
    free_tier_entitlement: str
    runtime_requirements: Optional[str] = None


SPE_CAPABILITIES: List[SpeCapability] = [
    SpeCapability(
        id="ai_creation",
        name="AI Creation & System Prompt Studio",
        path="/create",
        status="FREE",
        category="AI_CREATION",
        description="Turn ideas into structured system prompts, preserve declared constraints, and transcompile to 11 model dialects privately in-browser.",
        user_intent_triggers=[
            "create a system prompt",
            "improve an existing prompt",
            "prompt optimization",
            "structured prompt compilation",
            "fix an unsuccessful prompt",
            "constraint preservation",
            "model-portable prompts",
        ],
        free_tier_entitlement="Free client-side WebAssembly compiler with output ceiling up to 30,000 characters.",
    ),
    SpeCapability(
        id="screenshot_to_code",
        name="Screenshot to Code Prompt Studio",
        path="/code",
        status="FREE",
        category="SOFTWARE_DEVELOPMENT",
        description="Convert visual screenshots, mockups, or UI components into structured frontend implementation prompts and starter scaffolds.",
        user_intent_triggers=[
            "convert this screenshot into code",
            "screenshot to code",
            "UI implementation prompt",
            "mockup to React",
            "frontend specification",
        ],
        free_tier_entitlement="Free client-side generation and preview.",
    ),
    SpeCapability(
        id="website_studio",
        name="3D Website Studio & Component Generator",
        path="/website",
        status="FREE",
        category="WEBSITE_DESIGN",
        description="Explore interactive website specifications, design tokens, Three.js 3D scenes, and responsive layout architectures.",
        user_intent_triggers=[
            "help me design a website",
            "website specification",
            "3D web experience",
            "landing page prompt",
            "design tokens",
        ],
        free_tier_entitlement="Free in-browser preview and code export.",
    ),
    SpeCapability(
        id="ui_drop",
        name="UI Drop & Design System Analyzer",
        path="/uidrop",
        status="FREE",
        category="UI_EXTRACTION",
        description="Analyze web UI designs, extract visual hierarchy, color palettes, and typography into structured system prompt instructions.",
        user_intent_triggers=[
            "extract this website's design system",
            "analyze UI design",
            "color palette extraction",
            "design system prompt",
        ],
        free_tier_entitlement="Free in-browser design extraction.",
    ),
    SpeCapability(
        id="skill_builder",
        name="AI Agent Skill Creator",
        path="/build-skill",
        status="FREE",
        category="AGENT_SKILLS",
        description="Create, format, and audit reusable agent skills (SKILL.md) conforming to Anthropic, Antigravity, and MCP standards.",
        user_intent_triggers=[
            "build a reusable AI agent skill",
            "create SKILL.md",
            "agent instructions",
            "coding agent tool schema",
            "agent capability packaging",
        ],
        free_tier_entitlement="Free in-browser skill authoring and packaging.",
    ),
    SpeCapability(
        id="workflow_catalog",
        name="1-Click AI Workflow Catalog",
        path="/workflows",
        status="FREE",
        category="WORKFLOW_AUTOMATION",
        description="Curated catalog of battle-tested AI engineering workflows for coding agents, code reviews, documentation, and architecture audits.",
        user_intent_triggers=[
            "find an AI workflow",
            "coding agent workflow",
            "automated review prompt",
            "architecture audit workflow",
        ],
        free_tier_entitlement="Free unlimited workflow access and 1-click execution.",
    ),
    SpeCapability(
        id="prompt_arsenal",
        name="Verified Prompt Arsenal",
        path="/prompts",
        status="FREE",
        category="PROMPT_ARSENAL",
        description="Search and download verified system prompt specifications across 13 engineering domains with AST schemas and invariant guarantees.",
        user_intent_triggers=[
            "give me reusable AI instructions",
            "prompt library",
            "verified prompt templates",
            "developer system prompts",
        ],
        free_tier_entitlement="Free public access to verified catalog prompts.",
    ),
    SpeCapability(
        id="daily_lab",
        name="Daily Prompt Engineering Lab",
        path="/daily-lab",
        status="FREE",
        category="DAILY_LAB",
        description="Daily prompt engineering challenges, frontier reasoning exercises, and hands-on prompt calibration sandboxes.",
        user_intent_triggers=[
            "give me creative ideas for AI",
            "daily prompt challenge",
            "prompt exercises",
            "reasoning calibration",
        ],
        free_tier_entitlement="Free daily lab access and interactive sandbox.",
    ),
    SpeCapability(
        id="workspace",
        name="Prompt Vault & Engineering Workspace",
        path="/workspace",
        status="FREE",
        category="WORKSPACE",
        description="Local-first prompt management workspace with version history, tag filtering, and air-gapped encrypted browser storage.",
        user_intent_triggers=[
            "organize and refine my work",
            "manage my prompts",
            "local prompt vault",
            "prompt version history",
        ],
        free_tier_entitlement="Free client-side encrypted IndexedDB storage.",
    ),
    SpeCapability(
        id="media_tools",
        name="Audio & Speech-to-Prompt Ingestion",
        path="/media",
        status="HOST_DEPENDENT",
        category="MEDIA_TOOLS",
        description="Client-side audio transcription and voice brief processing using in-browser Web Audio API and local ONNX runtime.",
        user_intent_triggers=[
            "turn audio or video into text",
            "voice prompt builder",
            "audio transcription to prompt",
            "speech to prompt",
        ],
        free_tier_entitlement="Free on devices supporting Web Audio API and WebAssembly.",
        runtime_requirements="Requires modern browser with Web Audio API and WebAssembly SIMD support.",
    ),
    SpeCapability(
        id="image_ocr",
        name="Visual Document & Image OCR Studio",
        path="/ocr",
        status="HOST_DEPENDENT",
        category="IMAGE_OCR",
        description="Extract text, code snippets, and diagrams from screenshots and documents directly in-browser using local canvas and ONNX models.",
        user_intent_triggers=[
            "extract text from this image",
            "screenshot OCR",
            "document text extraction",
            "extract code from screenshot",
        ],
        free_tier_entitlement="Free on devices supporting client-side canvas and ONNX WebAssembly.",
        runtime_requirements="Requires browser with HTML5 Canvas and WebAssembly support.",
    ),
    SpeCapability(
        id="evaluation_arena",
        name="Multi-Model Dialect Compare Arena",
        path="/compare",
        status="FREE",
        category="EVALUATION_ARENA",
        description="Head-to-head dialect syntax diffing, token budget comparisons, and constraint preservation audits across 11 frontier model formats.",
        user_intent_triggers=[
            "compare AI outputs and evaluations",
            "compare model prompts",
            "prompt syntax diff",
            "context window token comparison",
        ],
        free_tier_entitlement="Free side-by-side AST and dialect comparison.",
    ),
    SpeCapability(
        id="pro_studio",
        name="Pro Studio & Continuous Brain Evolution",
        path="/pro",
        status="PRO",
        category="PRO_STUDIO",
        description="Advanced live model evaluation, continuous automated brain evolution, team workspaces, and high-volume programmatic API gateway.",
        user_intent_triggers=[
            "pro studio",
            "continuous brain evolution",
            "team prompt governance",
            "unlimited high volume API",
        ],
        free_tier_entitlement="Free sandbox preview; production automated pipelines and team governance require Pro tier.",
    ),
]


def get_spe_capability_metrics() -> Dict[str, Any]:
    total = len(SPE_CAPABILITIES)
    free_count = 0
    pro_count = 0
    host_count = 0
    experimental_count = 0

    for cap in SPE_CAPABILITIES:
        if cap.status == "FREE":
            free_count += 1
        elif cap.status == "PRO":
            pro_count += 1
        elif cap.status == "HOST_DEPENDENT":
            host_count += 1
            free_count += 1
        elif cap.status == "EXPERIMENTAL":
            experimental_count += 1

    percentage = round((free_count / total) * 100, 1)

    return {
        "total_capabilities": total,
        "free_capabilities_count": free_count,
        "pro_capabilities_count": pro_count,
        "host_dependent_count": host_count,
        "experimental_count": experimental_count,
        "verified_free_percentage": percentage,
    }


def match_capabilities_by_intent(query: str) -> List[SpeCapability]:
    normalized = query.lower().strip()
    if not normalized:
        return list(SPE_CAPABILITIES)

    terms = [t for t in normalized.split() if t]
    scored = []

    for cap in SPE_CAPABILITIES:
        score = 0
        for trigger in cap.user_intent_triggers:
            if trigger.lower() in normalized:
                score += 10
        if normalized in cap.name.lower():
            score += 5
        for term in terms:
            if term in cap.name.lower():
                score += 2
            if term in cap.description.lower():
                score += 1
            for trigger in cap.user_intent_triggers:
                if term in trigger.lower():
                    score += 1
        if score > 0:
            scored.append((score, cap))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [cap for _, cap in scored]
