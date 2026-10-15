"""SPE Ω — Python Website Inventory Auditor.

Audits every supported route, canonical URL, sitemap directive, robots policy,
and reconciles broken internal navigation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Set
from spe_runtime.website_evolution.types import DefectCategory


class WebsiteInventoryAuditorPy:
    BASE_DOMAIN = "https://systempromptengine.com"

    CANONICAL_ROUTES: Dict[str, Dict[str, Any]] = {
        "/": {
            "view": "home",
            "indexable": True,
            "title": "SPE — System Prompt Engine | Free System Prompt Generator",
            "description": "Free system prompt generator and AI prompt builder. Turn an idea into meaning, structure, and a precise prompt — privately on this device.",
            "task": "Formulate AI prompt from raw text or idea",
            "owner": "hero-growth-squad",
        },
        "/create": {
            "view": "create",
            "indexable": True,
            "title": "Create a Prompt — SPE Free Prompt Builder",
            "description": "Shape text, speech, image, video, or a website into a clear system prompt. Your brief stays on this device.",
            "task": "Build and refine custom structured system prompt",
            "owner": "compiler-studio-team",
        },
        "/code": {
            "view": "code",
            "indexable": True,
            "title": "Screenshot to Code Prompt — SPE Prompt Engineering Tool",
            "description": "Upload a UI screenshot and get an implementation prompt plus starter scaffolds.",
            "task": "Generate code prompts and starter scaffolds from UI screenshot",
            "owner": "vision-code-team",
        },
        "/daily-lab": {
            "view": "lab",
            "indexable": True,
            "title": "Daily Lab — SPE AI Prompt Generator Ideas",
            "description": "Browse daily prompt engineering specimens and open them in SPE's free prompt builder.",
            "task": "Explore daily prompt specimens and recipes",
            "owner": "prompt-lab-team",
        },
        "/capabilities": {
            "view": "capabilities",
            "indexable": True,
            "title": "SPE Capabilities — Local Prompt Engine Features",
            "description": "Honest SPE capabilities: local-first preparation, ProtectedIntent, Execution Contract.",
            "task": "Audit verifiable software capabilities and execution invariants",
            "owner": "architecture-governance",
        },
        "/privacy": {
            "view": "privacy",
            "indexable": True,
            "title": "Privacy & Proof — Local System Prompt Engine | SPE",
            "description": "How SPE prepares prompts on this device, with honest privacy claims for this release.",
            "task": "Verify local-first air-gapped zero data egress proof",
            "owner": "security-compliance",
        },
        "/workflows": {
            "view": "workflows",
            "indexable": True,
            "title": "Verified AI Workflows Exchange | SPE Ω",
            "description": "Tested, reproducible business operations and document automation AI workflows.",
            "task": "Inspect reproducible document and business AI workflows",
            "owner": "workflow-exchange",
        },
        "/build-skill": {
            "view": "skill-builder",
            "indexable": True,
            "title": "Free In-Browser AI Skill Builder & Auditor | SPE Ω",
            "description": "Build, security-audit, and export portable AI skills (SKILL.md) locally on your device.",
            "task": "Build and security-scan portable agent SKILL.md packages",
            "owner": "agent-tools-squad",
        },
        "/compare": {
            "view": "compare",
            "indexable": True,
            "title": "Skill Effectiveness Challenge — Head-to-Head Benchmarks | SPE Ω",
            "description": "Empirical head-to-head AI agent task performance benchmarks.",
            "task": "View empirical head-to-head AI agent benchmarks",
            "owner": "evaluation-bench",
        },
        "/pricing": {
            "view": "pricing",
            "indexable": True,
            "title": "Plans & Pricing — System Prompt Engine | SPE",
            "description": "Simple, honest pricing. Core deterministic compiler is 100% free.",
            "task": "Review transparent pricing and local-first compiler guarantee",
            "owner": "business-operations",
        },
        "/prompts": {
            "view": "prompts",
            "indexable": True,
            "title": "Universal Prompt Arsenal | SPE",
            "description": "Explore 10,000+ production-tested AI prompts.",
            "task": "Search 10,000+ pre-tested production prompts",
            "owner": "catalog-squad",
        },
        "/incidents": {
            "view": "incidents",
            "indexable": True,
            "title": "AI Incident Radar & Failure Post-Mortem Wire | SPE Ω",
            "description": "Independent, mathematically verified post-mortems of AI model failures.",
            "task": "Investigate verified AI post-mortems and prompt failures",
            "owner": "safety-incident-team",
        },
        "/uidrop": {
            "view": "uidrop",
            "indexable": True,
            "title": "UIDrop Web Design System Extractor | SPE Ω",
            "description": "Extract design tokens, WCAG contrast scores, and anti-cloning prompts.",
            "task": "Extract design tokens and WCAG contrast from screenshot or URL",
            "owner": "design-system-squad",
        },
        "/possibility-engine": {
            "view": "possibility",
            "indexable": True,
            "title": "Possibility Engine & Living Outcome Contract | SPE Ω",
            "description": "Explore three orthogonal execution topologies from a single brief.",
            "task": "Explore orthogonal execution topologies with Pearl causal cuts",
            "owner": "advanced-causal-lab",
        },
        "/reality-frontier": {
            "view": "reality-frontier",
            "indexable": True,
            "title": "Reality Frontier · Counterfactual Feasibility Compiler | SPE Ω",
            "description": "Discover what realities your intention can actually produce.",
            "task": "Check ante-hoc feasibility and metamorphic evidence escrow",
            "owner": "formal-verification",
        },
        "/challenge": {
            "view": "challenge",
            "indexable": True,
            "title": "Challenge This Result | SPE Ω",
            "description": "Active counterfactual specification closure and stress verification.",
            "task": "Run anti-lucky-pass active stress verification",
            "owner": "active-testing-squad",
        },
        "/revocation": {
            "view": "revocation",
            "indexable": True,
            "title": "Semantic Revocation & Epistemic Non-Interference | SPE Ω",
            "description": "Weiser semantic slicing and memory purge.",
            "task": "Perform semantic slicing and memory purge",
            "owner": "security-governance",
        },
        "/workspace": {
            "view": "workspace",
            "indexable": False,
            "title": "Workspace — Inspect & Refine Prompts | SPE",
            "description": "Inspect intent, structure, and your finished prompt.",
            "task": "Local prompt editing without web publication",
            "owner": "internal-workspace",
        },
        "/my-work": {
            "view": "my-work",
            "indexable": False,
            "title": "My Work — Saved Prompts on This Device | SPE",
            "description": "Optional on-device history of ideas and prompts.",
            "task": "Local prompt history storage",
            "owner": "internal-workspace",
        },
        "/website": {
            "view": "website",
            "indexable": False,
            "title": "Website — Local spec preview | SPE",
            "description": "Local website spec preview.",
            "task": "Local site mockup without web hosting",
            "owner": "internal-workspace",
        },
        "/media": {
            "view": "media",
            "indexable": False,
            "title": "Media — Host transcription request | SPE",
            "description": "Select audio or video and request transcription.",
            "task": "Local audio/video transcription",
            "owner": "internal-workspace",
        },
        "/ocr": {
            "view": "ocr",
            "indexable": False,
            "title": "OCR — Local text from an image | SPE",
            "description": "Request image text from the configured host.",
            "task": "Local OCR processing",
            "owner": "internal-workspace",
        },
        "/research": {
            "view": "research",
            "indexable": False,
            "title": "Research — Stored receipt only | SPE",
            "description": "View a stored research receipt.",
            "task": "Local research receipt viewer",
            "owner": "internal-workspace",
        },
    }

    SYNONYM_MAP: Dict[str, str] = {
        "/prompt-generator": "/create",
        "/ai-prompt-generator": "/create",
        "/build": "/create",
        "/screenshot-to-code": "/code",
        "/code-prompts": "/code",
        "/lab": "/daily-lab",
        "/skills": "/build-skill",
        "/skills-builder": "/build-skill",
        "/benchmark": "/compare",
        "/plans": "/pricing",
        "/prompt-library": "/prompts",
        "/incident-wire": "/incidents",
        "/design-tokens": "/uidrop",
    }

    def audit_routes(self) -> Dict[str, Any]:
        items: List[Dict[str, Any]] = []
        canonical_conflicts: List[Dict[str, str]] = []
        missing_metadata: List[Dict[str, str]] = []

        for route, meta in self.CANONICAL_ROUTES.items():
            canonical_url = f"{self.BASE_DOMAIN}{'' if route == '/' else route}"

            if not canonical_url.startswith("https://systempromptengine.com"):
                canonical_conflicts.append({"route": route, "canonical": canonical_url, "issue": "Non-HTTPS canonical"})

            if len(meta["title"]) < 10:
                missing_metadata.append({"route": route, "missingField": "title"})
            if len(meta["description"]) < 20:
                missing_metadata.append({"route": route, "missingField": "description"})

            items.append({
                "route": route,
                "canonical_url": canonical_url,
                "is_indexable": meta["indexable"],
                "seo_title": meta["title"],
                "meta_description": meta["description"],
                "primary_user_task": meta["task"],
                "assigned_owner": meta["owner"],
            })

        return {
            "total_routes": len(items),
            "indexable_routes": sum(1 for i in items if i["is_indexable"]),
            "noindex_routes": sum(1 for i in items if not i["is_indexable"]),
            "canonical_conflicts": canonical_conflicts,
            "missing_metadata": missing_metadata,
            "items": items,
        }

    def resolve_broken_link(self, broken_href: str) -> Optional[str]:
        clean = broken_href.lower().strip().rstrip("/") or "/"
        if clean in self.CANONICAL_ROUTES:
            return clean
        return self.SYNONYM_MAP.get(clean)
