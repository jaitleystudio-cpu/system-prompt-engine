"""JSON Schema validation helpers for CrossCategoryEnvelope."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator

_SCHEMA_PATH = (
    Path(__file__).resolve().parents[2] / "schemas" / "xcat_envelope.schema.json"
)


def load_envelope_schema() -> dict[str, Any]:
    with _SCHEMA_PATH.open(encoding="utf-8") as fh:
        return json.load(fh)


def validate_envelope_dict(data: dict[str, Any]) -> list[str]:
    """Validate a dict against xcat_envelope.schema.json. Returns error messages."""
    schema = load_envelope_schema()
    validator = Draft202012Validator(schema)
    return sorted(e.message for e in validator.iter_errors(data))
