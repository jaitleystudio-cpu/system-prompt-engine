"""Deterministic ContextNeed compiler — keyword/shape routing, no network."""

from __future__ import annotations

import hashlib
import re
from typing import Mapping

from spe_runtime.grounding.models import ContextNeed, ContextType, PrivacyClass
from spe_runtime.grounding.policies import get_source_policy
from spe_runtime.grounding.profiles import get_domain_profile
from spe_runtime.grounding.recipes import get_context_recipe

_WHITESPACE_RE = re.compile(r"\s+")

# Ordered rules: first match wins. Explicit deterministic features only.
_ROUTE_RULES: tuple[tuple[str, tuple[str, ...], str], ...] = (
    # (domain_id, keyword_any, recipe_id) — keyword match is substring on normalized text
    (
        "writing_communication",
        ("birthday", "happy birthday", "congratulat", "thank-you note", "thank you note"),
        "recipe.none.local_only",
    ),
    (
        "personal_planning",
        ("grocery list", "packing list", "reminder to", "to-do list", "todo list"),
        "recipe.personal.local_only",
    ),
    (
        "coding",
        (
            "react",
            "migrate",
            "typescript",
            "javascript",
            "api migration",
            "latest api",
            "framework",
            "npm package",
            "python package",
            "sdk",
            "library docs",
        ),
        "recipe.coding.official_docs",
    ),
    (
        "debugging",
        ("stack trace", "segfault", "nullpointer", "bugfix", "debug this"),
        "recipe.coding.official_docs",
    ),
    (
        "research",
        (
            "research whether",
            "research if",
            "systematic review",
            "peer-reviewed",
            "peer reviewed",
            "meta-analysis",
            "empirical evidence",
            "affects sleep",
            "blue light",
        ),
        "recipe.research.scholarly",
    ),
    (
        "health_information",
        ("symptom", "diagnosis", "treatment guideline", "medical advice"),
        "recipe.research.scholarly",
    ),
    (
        "news_current",
        ("breaking news", "today's news", "current events", "latest headlines"),
        "recipe.general.default",
    ),
)


def _normalize(text: str) -> str:
    return _WHITESPACE_RE.sub(" ", text.strip().lower())


def _need_id(request_text: str, domain_id: str) -> str:
    digest = hashlib.sha256(request_text.encode("utf-8")).hexdigest()[:16]
    return f"need-{domain_id}-{digest}"


def _route(request_text: str) -> tuple[str, str]:
    """Return (domain_id, recipe_id) using deterministic keyword/shape rules."""
    text = _normalize(request_text)
    for domain_id, keywords, recipe_id in _ROUTE_RULES:
        for keyword in keywords:
            if keyword.lower() in text:
                return domain_id, recipe_id
    return "general", "recipe.general.default"


def _freshness_required(recipe_freshness: Mapping[str, object] | dict, profile_policy: str) -> bool:
    if "required" in recipe_freshness:
        return bool(recipe_freshness["required"])
    return profile_policy not in {"not_required", "version_insensitive"}


def _context_types_for(domain_id: str, recipe_id: str) -> tuple[str, ...]:
    if recipe_id in {"recipe.none.local_only", "recipe.personal.local_only"}:
        return (ContextType.NONE.value,)
    if domain_id == "coding" or recipe_id == "recipe.coding.official_docs":
        return (ContextType.OFFICIAL_DOCUMENTATION.value,)
    if domain_id == "research" or recipe_id == "recipe.research.scholarly":
        return (ContextType.SCHOLARLY_EVIDENCE.value,)
    if domain_id == "news_current":
        return (ContextType.CURRENT_FACTS.value,)
    if domain_id in {"math_engineering", "data_statistics"}:
        return (ContextType.DETERMINISTIC_COMPUTATION.value,)
    return (ContextType.NONE.value,)


def _risk_level(domain_id: str) -> str:
    if domain_id in {
        "research",
        "health_information",
        "legal_information",
        "finance",
        "cybersecurity",
    }:
        return "HIGH"
    if domain_id in {"coding", "debugging", "news_current", "shopping"}:
        return "MEDIUM"
    return "LOW"


def _abstain(domain_id: str, profile_policy: str) -> bool:
    if profile_policy in {"abstain_if_insufficient", "abstain_if_stale"}:
        return True
    return domain_id in {"research", "health_information", "legal_information", "finance"}


def compile_context_need(
    request_text: str,
    *,
    user_flags: Mapping[str, object] | None = None,
) -> ContextNeed:
    """Compile an immutable ContextNeed from request text.

    Deterministic keyword/shape router only — never retrieves content or
    contacts the network. ``user_flags`` may force domain/recipe overrides.
    """
    if not isinstance(request_text, str):
        raise TypeError("request_text must be a string")

    flags = dict(user_flags or {})
    domain_id, recipe_id = _route(request_text)
    if isinstance(flags.get("domain_id"), str) and flags["domain_id"]:
        domain_id = str(flags["domain_id"])
    if isinstance(flags.get("recipe_id"), str) and flags["recipe_id"]:
        recipe_id = str(flags["recipe_id"])

    profile = get_domain_profile(domain_id)
    recipe = get_context_recipe(recipe_id)

    # Prefer first declared source policy on the recipe when present.
    required: tuple[str, ...] = ()
    optional: tuple[str, ...] = ()
    if recipe.source_policies:
        policy = get_source_policy(recipe.source_policies[0])
        required = policy.required_source_classes
        optional = policy.optional_source_classes
    elif profile.preferred_source_classes:
        required = profile.preferred_source_classes[:1]
        optional = profile.preferred_source_classes[1:]

    freshness_map = dict(recipe.freshness_rules)
    freshness_required = _freshness_required(freshness_map, profile.freshness_policy)

    context_types = _context_types_for(domain_id, recipe_id)
    if context_types == (ContextType.NONE.value,):
        max_sources = 0
        max_context_bytes = 0
        required = ()
        optional = ()
        freshness_required = False
        reason_codes = ("NO_EXTERNAL_CONTEXT_REQUIRED",)
    else:
        max_sources = int(flags.get("max_sources", 12))
        max_context_bytes = int(flags.get("max_context_bytes", 65536))
        reason_codes = (
            f"ROUTED_{domain_id.upper()}",
            f"RECIPE_{recipe_id.replace('.', '_').upper()}",
        )

    privacy_raw = flags.get("privacy_class", "PRIVATE")
    privacy_class = (
        privacy_raw if isinstance(privacy_raw, PrivacyClass) else str(privacy_raw)
    )

    return ContextNeed(
        need_id=_need_id(request_text, domain_id),
        domain_tags=(domain_id,),
        context_types=context_types,
        freshness_required=freshness_required,
        risk_level=_risk_level(domain_id),
        privacy_class=privacy_class,
        query_minimization_required=True,
        required_source_classes=required,
        optional_source_classes=optional,
        max_sources=max_sources,
        max_context_bytes=max_context_bytes,
        abstain_if_missing=_abstain(domain_id, profile.abstention_policy)
        if context_types != (ContextType.NONE.value,)
        else False,
        reason_codes=reason_codes,
    )
