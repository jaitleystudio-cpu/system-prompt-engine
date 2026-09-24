"""Context recipe registry — data-driven, no network."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

_DATA_PATH = (
    Path(__file__).resolve().parents[2] / "data" / "grounding" / "context_recipes.json"
)


@dataclass(frozen=True)
class ContextRecipe:
    recipe_id: str
    domain_id: str
    steps: tuple[str, ...]
    source_policies: tuple[str, ...]
    freshness_rules: tuple[tuple[str, Any], ...]
    dedupe_key: str
    rerank_policy: str
    contradiction_queries: tuple[str, ...]
    license_gate: str
    privacy_minimization: bool
    failure_behavior: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "recipe_id": self.recipe_id,
            "domain_id": self.domain_id,
            "steps": list(self.steps),
            "source_policies": list(self.source_policies),
            "freshness_rules": dict(self.freshness_rules),
            "dedupe_key": self.dedupe_key,
            "rerank_policy": self.rerank_policy,
            "contradiction_queries": list(self.contradiction_queries),
            "license_gate": self.license_gate,
            "privacy_minimization": self.privacy_minimization,
            "failure_behavior": self.failure_behavior,
        }


def _as_tuple_str(value: Any) -> tuple[str, ...]:
    if not value:
        return ()
    return tuple(str(item) for item in value)


def _freshness_rules(raw: Any) -> tuple[tuple[str, Any], ...]:
    if not raw:
        return ()
    if isinstance(raw, dict):
        return tuple(sorted((str(k), v) for k, v in raw.items()))
    raise TypeError("freshness_rules must be a mapping")


def _recipe_from_dict(raw: dict[str, Any]) -> ContextRecipe:
    return ContextRecipe(
        recipe_id=str(raw["recipe_id"]),
        domain_id=str(raw["domain_id"]),
        steps=_as_tuple_str(raw.get("steps")),
        source_policies=_as_tuple_str(raw.get("source_policies")),
        freshness_rules=_freshness_rules(raw.get("freshness_rules")),
        dedupe_key=str(raw.get("dedupe_key", "none")),
        rerank_policy=str(raw.get("rerank_policy", "none")),
        contradiction_queries=_as_tuple_str(raw.get("contradiction_queries")),
        license_gate=str(raw.get("license_gate", "n/a")),
        privacy_minimization=bool(raw.get("privacy_minimization", True)),
        failure_behavior=str(raw.get("failure_behavior", "proceed_without_context")),
    )


@lru_cache(maxsize=1)
def _load_recipes() -> dict[str, ContextRecipe]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    recipes = payload.get("recipes", payload)
    if not isinstance(recipes, list):
        raise ValueError("context_recipes.json must contain a recipes list")
    result: dict[str, ContextRecipe] = {}
    for item in recipes:
        recipe = _recipe_from_dict(item)
        if recipe.recipe_id in result:
            raise ValueError(f"duplicate recipe_id: {recipe.recipe_id}")
        result[recipe.recipe_id] = recipe
    return result


def get_context_recipe(recipe_id: str) -> ContextRecipe:
    recipes = _load_recipes()
    try:
        return recipes[recipe_id]
    except KeyError as exc:
        raise KeyError(f"unknown recipe_id: {recipe_id!r}") from exc


def list_context_recipe_ids() -> tuple[str, ...]:
    return tuple(sorted(_load_recipes().keys()))
