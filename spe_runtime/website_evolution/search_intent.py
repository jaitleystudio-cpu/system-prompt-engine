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

        if any(term in q for term in ["workflow", "template", "claude code", "cursor"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="AI_WORKFLOW_AUTOMATION",
                authoritative_route="/workflows",
                expected_user_task="Browse reproducible pre-audited business and code automation workflows",
                title_aligned=current_page == "/workflows",
                cta_aligned=True,
                recommendation="Demonstrate verified workflow execution receipts.",
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

        if any(term in q for term in ["eval", "benchmark", "compare", "test prompt", "probe"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="PROMPT_EVALUATION_BENCHMARK",
                authoritative_route="/eval-studio",
                expected_user_task="Evaluate and benchmark prompt directives side-by-side against frontier models",
                title_aligned=current_page in ["/eval-studio", "/compare"],
                cta_aligned=True,
                recommendation="Provide side-by-side prompt evaluation assertions.",
            )

        if any(term in q for term in ["skill", "agent skill", "skill.md", "build skill"]):
            return IntentTaskMapping(
                query=query,
                detected_intent="SKILL_BUILDER_TAINT_SCAN",
                authoritative_route="/build-skill",
                expected_user_task="Build and security-scan portable agent SKILL.md packages",
                title_aligned=current_page == "/build-skill",
                cta_aligned=True,
                recommendation="Highlight AST taint scanning and export.",
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

        # Fabricated claims and ungrounded commercial guarantees
        combined = f"{title.lower()} {description.lower()}"
        if re.search(r"rated\s+\d+(\.\d+)?\s+stars?", combined):
            violations.append("Fabricated claim: unverified user rating")
        if re.search(r"\d+([,\.]\d+)?\s*(million|k|m)\s+(happy\s+)?(users|customers|developers)", combined):
            violations.append("Fabricated claim: unverified user count statistics")
        if "money back guarantee" in combined or "money-back guarantee" in combined:
            violations.append("Forbidden warranty claim: money back guarantee")

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

    def validate_structured_data(
        self,
        route: str,
        structured_data: Dict[str, Any],
        visible_content: Dict[str, str],
    ) -> Dict[str, Any]:
        issues: List[str] = []
        schema_type = str(structured_data.get("@type", ""))
        expected_type = visible_content.get("expectedType", visible_content.get("expected_type"))

        if expected_type and schema_type != expected_type:
            issues.append(f'Structured data @type "{schema_type}" contradicts expected page type "{expected_type}".')

        schema_name = str(structured_data.get("name") or structured_data.get("headline") or "")
        if not schema_name:
            issues.append("Structured data is missing required 'name' or 'headline' property.")

        if "aggregateRating" in structured_data or "aggregate_rating" in structured_data:
            issues.append("Fabricated 'aggregateRating' detected in structured data without verified user reviews.")

        corrected_data = None
        if issues:
            corrected_data = dict(structured_data)
            corrected_data["@type"] = expected_type or schema_type or "WebPage"
            corrected_data["name"] = visible_content.get("title", "")
            corrected_data["description"] = visible_content.get("description", "")
            corrected_data.pop("aggregateRating", None)
            corrected_data.pop("aggregate_rating", None)

        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "corrected_data": corrected_data,
        }

