"""SPE Ω — Python Search Intent & Query Intelligence.

Grounded in SAGEO Arena (KDD 2026), Google Search Central, and Google Search Console API.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional
from spe_runtime.website_evolution.types import IntentTaskMapping, SearchConsoleQueryRow


class SearchIntentEnginePy:
    def map_query_to_intent(self, query: str, current_page: Optional[str] = None) -> IntentTaskMapping:
        q = query.lower().strip()

        if any(term in q for term in ["create", "generator", "builder", "make prompt"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="CREATE_SYSTEM_PROMPT",
                authoritative_route="/create",
                expected_user_task="Create and structure a custom system prompt privately on-device",
                title_aligned=current_page in ["/create", "/"],
                cta_aligned=True,
                recommendation="Ensure prompt creation canvas is immediately accessible.",
            )

        if any(term in q for term in ["improve", "chatgpt prompt", "refine", "fix prompt"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="REFINE_EXISTING_PROMPT",
                authoritative_route="/create",
                expected_user_task="Paste rough instructions and convert them into clear structured directives",
                title_aligned=current_page == "/create",
                cta_aligned=True,
                recommendation="Provide before/after prompt refinement example.",
            )

        if any(term in q for term in ["screenshot", "code", "ui to code", "flutter", "react"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="UI_SCREENSHOT_TO_CODE",
                authoritative_route="/code",
                expected_user_task="Upload UI screenshot and receive coding prompts plus starter scaffolds",
                title_aligned=current_page == "/code",
                cta_aligned=True,
                recommendation="Explain that SPE produces prompt scaffolds for coding AI, not in-product compiler.",
            )

        if any(term in q for term in ["incident", "leak", "bug", "failure", "post mortem"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="AI_INCIDENT_INVESTIGATION",
                authoritative_route="/incidents",
                expected_user_task="Examine mathematically verified AI failure post-mortems and regression receipts",
                title_aligned=current_page == "/incidents",
                cta_aligned=True,
                recommendation="Link to verified failure post-mortems.",
            )

        if any(term in q for term in ["extract", "design token", "contrast", "wcag"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="DESIGN_TOKEN_EXTRACTION",
                authoritative_route="/uidrop",
                expected_user_task="Extract design tokens and WCAG contrast ratings locally from screenshot or URL",
                title_aligned=current_page == "/uidrop",
                cta_aligned=True,
                recommendation="Display offline design token extractor.",
            )

        return IntentTaskMapping(
            query=query,
            detected_intent="GENERAL_EXPLORATION",
            authoritative_route="/",
            expected_user_task="Understand SPE's local-first compiler capabilities and begin prompt creation",
            title_aligned=current_page == "/",
            cta_aligned=True,
            recommendation="Keep hero copy plain English and task-oriented.",
        )

    def validate_seo_copy(self, title: str, description: str) -> Dict[str, Any]:
        violations: List[str] = []

        # Keyword stuffing
        words = re.findall(r"\b[a-zA-Z]{4,}\b", title.lower())
        counts: Dict[str, int] = {}
        for w in words:
            counts[w] = counts.get(w, 0) + 1
            if counts[w] > 2:
                violations.append(f"Keyword stuffing: '{w}' repeated {counts[w]} times in title.")

        # Length guidelines
        if len(title) > 70:
            violations.append(f"Title length {len(title)} > 70 chars")
        if len(description) > 170:
            violations.append(f"Meta description length {len(description)} > 170 chars")

        # Forbidden speculative ranking claims
        forbidden_terms = ["rank #1", "guaranteed first page", "hack google", "ai overviews secret"]
        for term in forbidden_terms:
            if term in title.lower() or term in description.lower():
                violations.append(f"Forbidden ranking claim: '{term}'")

        return {
            "valid": len(violations) == 0,
            "violations": violations,
        }

    def evaluate_indexing_api_eligibility(self, page_type: str, url: str) -> Dict[str, Any]:
        if page_type in ["JobPosting", "BroadcastEvent"]:
            return {"eligible": True}
        return {
            "eligible": False,
            "rejection_reason": f"Page type '{page_type}' for URL '{url}' is strictly ineligible for Google Indexing API. Use XML sitemaps instead.",
        }
