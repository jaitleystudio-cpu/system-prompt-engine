"""Canonical prompt contract for offline workflow export.

This module reads. It does not send, store credentials, or execute.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Any, Mapping

EXPORT_CONTRACT_VERSION = "spe.workflow-export.v1"
PROMPT_CONTRACT_VERSION = "spe.prompt-contract.v1"
TEXT_FORMAT = "SPE_WORKFLOW_TEXT v1"
WITHHELD_MARKER = "SPE_PROMPT_WITHHELD"

FACETS: tuple[str, ...] = (
    "prompt_body",
    "variables",
    "required_inputs",
    "expected_outputs",
    "constraints",
    "provider_target",
)
TARGETS: frozenset[str] = frozenset(
    {"n8n", "make", "zapier", "generic_json", "generic_text"}
)
GUARANTEES: dict[str, Any] = {
    "network": False,
    "credentials_stored": False,
    "executed": False,
    "published": False,
    "webhook_triggered": False,
    "authority": "NONE",
    "validation_is_not_execution": True,
    "capability_is_not_authority": True,
}

_LIST_FACETS = ("required_inputs", "expected_outputs", "constraints")
_FORBIDDEN_KEYS = frozenset(
    {
        "password",
        "secret",
        "token",
        "apikey",
        "credential",
        "credentials",
        "authorization",
        "auth",
        "webhook",
        "webhookurl",
        "privatekey",
        "accesskey",
        "refreshtoken",
        "accesstoken",
        "bearertoken",
    }
)
_CREDENTIAL_RE = re.compile(
    r"(?i)\b(?:api[_-]?key|secret|password|token|bearer|authorization)\b"
    r"\s*[:=]\s*(?:bearer\s+)?(\S+)"
)


def _norm_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]", "", key.lower())


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _require_string_list(value: Any, field: str) -> list[str]:
    if value is None:
        return []
    if not isinstance(value, list) or any(not isinstance(item, str) or item == "" for item in value):
        raise ValueError(f"{field} must be a list of non-empty strings")
    return list(value)


def _variables_from(value: Any) -> tuple[list[dict[str, str]], list[str]]:
    if value is None:
        return [], []
    items: list[tuple[str, str]] = []
    if isinstance(value, Mapping):
        for name in sorted(value):
            raw = value[name]
            if not isinstance(name, str) or name == "" or not isinstance(raw, str):
                raise ValueError("variables must map non-empty names to strings")
            items.append((name, raw))
    elif isinstance(value, list):
        for entry in value:
            if not isinstance(entry, Mapping):
                raise ValueError("variable entries must be objects")
            name = entry.get("name")
            raw = entry.get("value")
            if not isinstance(name, str) or name == "" or not isinstance(raw, str):
                raise ValueError("variable entries require string name and value")
            items.append((name, raw))
    else:
        raise ValueError("variables must be an object or a list")
    seen: set[str] = set()
    normalized: list[dict[str, str]] = []
    secrets: list[str] = []
    for name, raw in items:
        if name in seen:
            raise ValueError(f"duplicate variable name: {name}")
        seen.add(name)
        stripped = _norm_key(name) in _FORBIDDEN_KEYS
        if stripped and len(raw) >= 8:
            secrets.append(raw)
        normalized.append(
            {
                "name": name,
                "value": "" if stripped else raw,
                "disposition": "STRIPPED" if stripped else "KEPT",
            }
        )
    return normalized, secrets


def _collect_forbidden(value: Any, path: tuple[str, ...], found: list[tuple[str, str]]) -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            _collect_forbidden(child, path + (str(key),), found)
        return
    if isinstance(value, list):
        for index, child in enumerate(value):
            _collect_forbidden(child, path + (str(index),), found)
        return
    if path:
        found.append((".".join(path), value if isinstance(value, str) else ""))


def _strip_tree(source: Mapping[str, Any]) -> tuple[list[str], list[str]]:
    paths: list[str] = []
    secrets: list[str] = []
    found: list[tuple[str, str]] = []

    def walk(obj: Any, path: tuple[str, ...]) -> None:
        if isinstance(obj, Mapping):
            for key, child in obj.items():
                child_path = path + (str(key),)
                if _norm_key(str(key)) in _FORBIDDEN_KEYS:
                    _collect_forbidden(child, child_path, found)
                else:
                    walk(child, child_path)
        elif isinstance(obj, list):
            for child in obj:
                walk(child, path)

    walk(source, ())
    for path, secret in found:
        paths.append(path)
        if len(secret) >= 8:
            secrets.append(secret)
    return paths, secrets


@dataclass(frozen=True)
class Extracted:
    canonical: dict[str, Any]
    source_info: dict[str, Any]
    stripped_paths: tuple[str, ...]
    secrets: tuple[str, ...]
    prompt_withheld: bool


def extract_contract(source: Mapping[str, Any]) -> Extracted:
    if not isinstance(source, Mapping):
        raise ValueError("source must be an object")
    spe_format = source.get("spe_format")
    if isinstance(spe_format, str) and spe_format.startswith("spe.artifact."):
        prompt_body = source.get("rendered_prompt")
        provider_target = source.get("target")
        kind = "spe_artifact"
        contract_version = None
        recorded_format: str | None = spe_format
    elif "prompt_body" in source or source.get("contract_version") == PROMPT_CONTRACT_VERSION:
        prompt_body = source.get("prompt_body")
        provider_target = source.get("provider_target")
        kind = "prompt_contract"
        version = source.get("contract_version", PROMPT_CONTRACT_VERSION)
        if version != PROMPT_CONTRACT_VERSION:
            raise ValueError("contract_version must be spe.prompt-contract.v1")
        contract_version = PROMPT_CONTRACT_VERSION
        recorded_format = None
    else:
        raise ValueError("source must be an SPE artifact or spe.prompt-contract.v1")

    if not isinstance(prompt_body, str):
        raise ValueError("prompt_body is required")
    if not isinstance(provider_target, str) or provider_target == "":
        raise ValueError("provider_target is required")

    variables, variable_secrets = _variables_from(source.get("variables"))
    lists = {name: _require_string_list(source.get(name), name) for name in _LIST_FACETS}
    paths, secrets = _strip_tree(source)
    secrets.extend(variable_secrets)
    for variable in variables:
        if variable["disposition"] == "STRIPPED":
            path = f"variables.{variable['name']}"
            if path not in paths:
                paths.append(path)

    withheld = False
    stored_body = prompt_body
    matched = [match.group(1) for match in _CREDENTIAL_RE.finditer(prompt_body)]
    leaked = [secret for secret in secrets if secret and secret in prompt_body]
    if matched or leaked:
        withheld = True
        stored_body = ""
        for secret in matched:
            if len(secret) >= 8:
                secrets.append(secret)

    canonical = {
        "prompt_body": stored_body,
        "prompt_body_disposition": "WITHHELD_CREDENTIAL" if withheld else "VERBATIM",
        "prompt_body_sha256": _sha256(prompt_body),
        "variables": variables,
        "required_inputs": lists["required_inputs"],
        "expected_outputs": lists["expected_outputs"],
        "constraints": lists["constraints"],
        "provider_target": provider_target,
    }
    return Extracted(
        canonical=canonical,
        source_info={
            "kind": kind,
            "spe_format": recorded_format,
            "contract_version": contract_version,
        },
        stripped_paths=tuple(paths),
        secrets=tuple(secrets),
        prompt_withheld=withheld,
    )
