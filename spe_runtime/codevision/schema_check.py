"""Validate CODEVISION documents against the repo JSON Schemas."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import jsonschema

from spe_runtime.codevision.errors import CodevisionContractError

_ROOT = Path(__file__).resolve().parents[2]


def validate_instance(instance: Any, schema_filename: str) -> None:
    path = _ROOT / "schemas" / schema_filename
    if not path.is_file():
        raise CodevisionContractError("SCHEMA_FILE_MISSING", schema_filename)
    schema = json.loads(path.read_text(encoding="utf-8"))
    try:
        jsonschema.validate(instance, schema)
    except jsonschema.ValidationError as exc:
        raise CodevisionContractError("SCHEMA_REJECTED", exc.message) from exc
