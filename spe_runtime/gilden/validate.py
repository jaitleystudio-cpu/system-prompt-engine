"""Schema boundary for a Gilden operations document."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from jsonschema import Draft202012Validator
from jsonschema.exceptions import ValidationError

_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schemas" / "gilden_operations.schema.json"
)


@lru_cache(maxsize=1)
def load_schema() -> dict[str, Any]:
    with _SCHEMA_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError("gilden operations schema must be an object")
    Draft202012Validator.check_schema(payload)
    return payload


def _detail(error: ValidationError) -> str:
    path = "/".join(str(part) for part in error.absolute_path) or "(root)"
    return f"{path}: {error.message}"[:240]


def schema_errors(document: Mapping[str, Any]) -> tuple[str, ...]:
    """Return schema failures. An empty tuple means the document matches."""
    validator = Draft202012Validator(load_schema())
    errors = sorted(
        validator.iter_errors(document),
        key=lambda error: [str(part) for part in error.absolute_path],
    )
    return tuple(_detail(error) for error in errors[:12])
