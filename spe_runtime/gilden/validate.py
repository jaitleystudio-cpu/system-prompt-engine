"""Schema boundary for a Gilden operations document."""

from __future__ import annotations

import json
import re
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


def _unexpected_property_names(error: ValidationError) -> tuple[str, ...]:
    """Names of properties the schema did not declare. Values stay out."""
    instance = error.instance
    schema = error.schema
    if not isinstance(instance, Mapping) or not isinstance(schema, Mapping):
        return ()
    properties = schema.get("properties", {})
    allowed = set(properties) if isinstance(properties, Mapping) else set()
    raw_patterns = schema.get("patternProperties", {})
    patterns: list[re.Pattern[str]] = []
    if isinstance(raw_patterns, Mapping):
        for pattern in raw_patterns:
            try:
                patterns.append(re.compile(str(pattern)))
            except re.error:
                continue
    names: list[str] = []
    for key in instance:
        name = str(key)
        if name in allowed or any(pattern.search(name) for pattern in patterns):
            continue
        names.append(name)
    return tuple(sorted(names, key=str))


def _detail(error: ValidationError) -> str:
    """Name the field and the schema keyword. Do not copy the invalid value."""
    path = "/".join(str(part) for part in error.absolute_path) or "(root)"
    code = str(error.validator or "schema")
    if code == "additionalProperties":
        names = _unexpected_property_names(error)
        if names:
            return f"{path}: {code} {', '.join(names)}"[:240]
    return f"{path}: {code}"[:240]


def schema_errors(document: Mapping[str, Any]) -> tuple[str, ...]:
    """Return schema failures. An empty tuple means the document matches."""
    validator = Draft202012Validator(load_schema())
    errors = sorted(
        validator.iter_errors(document),
        key=lambda error: [str(part) for part in error.absolute_path],
    )
    return tuple(_detail(error) for error in errors[:12])
