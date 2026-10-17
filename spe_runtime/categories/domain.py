"""DOMAIN v2 production category path.

Sole semantic writer: ``apply_category_payload``.
Legacy direct writers (decide/research/communicate/analyze/form_execution_intent)
are not imported and must not be reachable from this module.
"""

from __future__ import annotations

import ast
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.categories.apply import apply_category_payload
from spe_runtime.xcat.models import CATEGORY_IDS, CrossCategoryEnvelope

OWNERSHIP_CLASS = "DOMAIN_V2_PRODUCTION"
DOMAIN_PRODUCTION = True

# Names of pre-ratification direct writers. Strings only — this module must
# not call them.
LEGACY_DIRECT_WRITER_NAMES: frozenset[str] = frozenset(
    {
        "decide",
        "research",
        "communicate",
        "analyze",
        "form_execution_intent",
        "retry_form_execution_intent",
    }
)

_KERNEL_REPLACE_KEYS: frozenset[str] = frozenset(
    {
        "facts",
        "provenance",
        "uncertainties",
        "hard_constraints",
        "user_preferences",
        "goal_identity",
        "analysis",
        "recommendation",
        "rendering",
        "authority_state",
        "execution_grants",
    }
)

_CATEGORIES_ROOT = Path(__file__).resolve().parent


def apply_domain_category(
    envelope: CrossCategoryEnvelope,
    category_id: str,
    payload: Mapping[str, Any],
    proof_obligation_proposals: tuple[Mapping[str, Any], ...] | list[Mapping[str, Any]] = (),
    **kwargs: Any,
) -> CrossCategoryEnvelope:
    """Specialize category_payload for one of C01–C12. Never a legacy writer."""
    if kwargs:
        raise ValueError(
            "DOMAIN production path cannot reach legacy direct-writer API: "
            + ",".join(sorted(str(key) for key in kwargs))
        )
    if category_id not in CATEGORY_IDS:
        raise ValueError(f"invalid category_id: {category_id!r}")
    return apply_category_payload(
        envelope,
        category_id,
        payload,
        proof_obligation_proposals=proof_obligation_proposals,
    )


def production_legacy_writer_reachability() -> int:
    """Count calls from this module to legacy direct-writer functions.

    The denylist above is data, not calls. A non-zero result means the
    DOMAIN production module invokes a legacy writer.
    """
    tree = ast.parse(Path(__file__).read_text(encoding="utf-8"))
    hits = 0
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = None
        if isinstance(func, ast.Name):
            name = func.id
        elif isinstance(func, ast.Attribute):
            name = func.attr
        if name in LEGACY_DIRECT_WRITER_NAMES:
            hits += 1
    return hits


def category_kernel_write_sites() -> list[dict[str, Any]]:
    """replace_envelope keyword sites that assign canonical kernel fields."""
    sites: list[dict[str, Any]] = []
    for path in sorted(_CATEGORIES_ROOT.rglob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            func = node.func
            called = None
            if isinstance(func, ast.Name):
                called = func.id
            elif isinstance(func, ast.Attribute):
                called = func.attr
            if called != "replace_envelope":
                continue
            keys = sorted(
                kw.arg
                for kw in node.keywords
                if kw.arg and kw.arg in _KERNEL_REPLACE_KEYS
            )
            if not keys:
                continue
            rel = path.relative_to(_CATEGORIES_ROOT.parent.parent).as_posix()
            legacy_dirs = {
                "c01_decide",
                "c02_research",
                "c03_communicate",
                "c06_analyze",
                "c07_execute",
            }
            sites.append(
                {
                    "file": rel,
                    "line": node.lineno,
                    "keys": keys,
                    "class": (
                        "LEGACY_COMPATIBILITY"
                        if path.parent.name in legacy_dirs
                        else "DOMAIN_BYPASS"
                    ),
                }
            )
    return sites


def domain_production_kernel_bypasses() -> int:
    """DOMAIN production files must not assign kernel fields via replace_envelope."""
    return sum(1 for site in category_kernel_write_sites() if site["class"] == "DOMAIN_BYPASS")
