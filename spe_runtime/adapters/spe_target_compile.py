"""Adapter: saved .spe → EXISTING formatTargetModelPrompt.

Path:
  saved .spe
  → manifest / integrity verification
  → deserialize canonical SPE artifact
  → recover ProtectedIntent, requirements, evidence, authority
  → canonical intermediate form
  → formatTargetModelPrompt() in apps/web/src/engine/continuation/continuationCompiler.ts
  → target-specific prompt

This module is an adapter only. It does not create TargetCompiler2,
ModelAdapter2, WorkflowExporter2, or a second formatTargetModelPrompt.
The compiler body is the canonical TypeScript export, invoked through Node.
"""

from __future__ import annotations

import copy
import hashlib
import json
import shutil
import subprocess
from typing import Any, Mapping, MutableMapping, Sequence
from spe_runtime.portability.canonical import canonicalize, strict_equal
from spe_runtime.portability.spe_artifact import (
    SPE_FORMAT_V1,
    SPE_FORMAT_V2,
    dumps_spe_artifact,
    loads_spe_artifact,
    verify_integrity,
)

CANONICAL_COMPILER_SYMBOL = "formatTargetModelPrompt"
CANONICAL_COMPILER_PATH = (
    "apps/web/src/engine/continuation/continuationCompiler.ts"
)
# Commit that introduced the symbol. The bytes executed are the later
# canonical body (see CANONICAL_COMPILER_SOURCE_SHA), not a rewrite.
CANONICAL_COMPILER_SHA = "2536c469a43bd8fe43c5342fb58a8b8270a2143f"
CANONICAL_COMPILER_SOURCE_SHA = "5011b5409c86cc7f5426a49d963b72a648bc2765"
CANONICAL_COMPILER_BLOB = "a05d5900327c92ea87f0aeaeb81d7f774eb2ba18"
INTERMEDIATE_SCHEMA = "spe.target-compile.intermediate.v1"

TARGET_EXPORT_MODELS: tuple[str, ...] = (
    "claude",
    "codex",
    "cursor",
    "grok",
    "local_coder",
    "generic",
)

# Human labels accepted at TARGET SELECT. Not a second compiler.
TARGET_SELECT_ALIASES: dict[str, str] = {
    "claude": "claude",
    "claude_code": "claude",
    "claude-code": "claude",
    "Claude Code": "claude",
    "CLAUDE CODE": "claude",
    "codex": "codex",
    "openai_codex": "codex",
    "openai-codex": "codex",
    "OpenAI Codex": "codex",
    "OPENAI CODEX": "codex",
    "cursor": "cursor",
    "Cursor": "cursor",
    "CURSOR": "cursor",
    "grok": "grok",
    "Grok": "grok",
    "GROK": "grok",
    "local_coder": "local_coder",
    "local-coder": "local_coder",
    "Local Coder": "local_coder",
    "LOCAL CODER": "local_coder",
    "generic": "generic",
    "Generic": "generic",
    "GENERIC": "generic",
}

_ALLOWED_FORMATS = frozenset({SPE_FORMAT_V1, SPE_FORMAT_V2})
_REQUIRED_SECTIONS = (
    "spe_format",
    "created_at_utc",
    "user_request",
    "category",
    "target",
    "envelope",
    "wasm",
    "rendered_prompt",
    "intent",
    "lineage",
    "integrity",
)
_INTENT_SECTIONS = ("confirmed", "assumed", "unknowns", "conflicts")


class TargetCompileError(Exception):
    """Fail-closed adapter error with a stable code."""

    def __init__(self, code: str, reason: str) -> None:
        self.code = code
        self.reason = reason
        super().__init__(f"{code}: {reason}")



class UnknownTargetError(TargetCompileError):
    """Fail-closed when the named target is not in the required set."""

    def __init__(self, target: object) -> None:
        super().__init__("UNKNOWN_TARGET", f"unknown target model: {target!r}")
        self.target = target


def resolve_target_model(target: str) -> str:
    """Map a TARGET SELECT label onto the existing TargetExportModel ids."""
    if not isinstance(target, str) or not target.strip():
        raise UnknownTargetError(target)
    if target in TARGET_EXPORT_MODELS:
        return target
    if target in TARGET_SELECT_ALIASES:
        return TARGET_SELECT_ALIASES[target]
    lowered = target.strip().lower().replace(" ", "_").replace("-", "_")
    for alias, canonical in TARGET_SELECT_ALIASES.items():
        if alias.lower().replace(" ", "_").replace("-", "_") == lowered:
            return canonical
    raise UnknownTargetError(target)


def _compiler_file() -> Path:
    from pathlib import Path as _Path

    return _Path(__file__).resolve().parents[2] / CANONICAL_COMPILER_PATH


def assert_canonical_compiler_bytes() -> str:
    """Refuse to run unless the vendored file is the canonical blob."""
    from pathlib import Path as _Path

    path = _compiler_file()
    if not path.is_file():
        raise TargetCompileError(
            "NOT_YET_BOUND",
            "canonical formatTargetModelPrompt file is missing",
        )
    data = path.read_bytes()
    blob = hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()
    if blob != CANONICAL_COMPILER_BLOB:
        raise TargetCompileError(
            "NOT_YET_BOUND",
            "formatTargetModelPrompt bytes are not the canonical compiler",
        )
    guards = path.with_name("oracleGuards.ts")
    if not guards.is_file():
        raise TargetCompileError(
            "NOT_YET_BOUND",
            "canonical compiler dependency oracleGuards.ts is missing",
        )
    return blob


def invoke_format_target_model_prompt(
    target: str,
    mission: str,
    baseline_sha: str,
    protected_intent: str,
    steps: Sequence[str],
    evidence: Sequence[str],
    contradictions: Sequence[str],
    unknowns: Sequence[str],
    test_gates: Sequence[str],
    stop_conditions: Sequence[str],
    extras: Mapping[str, Sequence[str]] | None = None,
) -> str:
    """Call the existing TypeScript formatTargetModelPrompt. Do not reimplement it.

    ``extras`` is the compiler's existing structured argument
    (mustNot / privacy / rollback). Omit it only when the saved package has
    none. An empty list is passed through so compiler defaults cannot refill
    a field the adapter deleted.
    """
    if target not in TARGET_EXPORT_MODELS:
        raise UnknownTargetError(target)
    assert_canonical_compiler_bytes()
    node = shutil.which("node")
    if not node:
        raise TargetCompileError(
            "NOT_YET_BOUND",
            "node is required to execute formatTargetModelPrompt",
        )
    from pathlib import Path as _Path

    here = _Path(__file__).resolve().parent
    repo = here.parents[1]
    payload = {
        "target": target,
        "mission": mission,
        "baselineSha": baseline_sha,
        "protectedIntent": protected_intent,
        "steps": list(steps),
        "evidence": list(evidence),
        "contradictions": list(contradictions),
        "unknowns": list(unknowns),
        "testGates": list(test_gates),
        "stopConditions": list(stop_conditions),
    }
    if extras is not None:
        payload["extras"] = {key: list(value) for key, value in extras.items()}
    try:
        proc = subprocess.run(
            [
                node,
                "--experimental-strip-types",
                "--import",
                str(here / "register_ts_extension_hooks.mjs"),
                str(here / "invoke_format_target_model_prompt.mjs"),
            ],
            input=json.dumps(payload),
            text=True,
            capture_output=True,
            cwd=str(repo),
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise TargetCompileError(
            "NOT_YET_BOUND",
            f"formatTargetModelPrompt did not execute: {exc}",
        ) from None
    if proc.returncode != 0:
        message = (proc.stderr or proc.stdout or "compiler failed").strip()
        tail = message[-800:]
        if "MANDATORY_OBLIGATION_PRESERVATION" in message:
            raise TargetCompileError("OBLIGATION_DROPPED", tail)
        if "Cursor export invented" in message:
            raise TargetCompileError("MALICIOUS_FIELD", tail)
        raise TargetCompileError("COMPILER_REFUSED", tail)
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        raise TargetCompileError(
            "COMPILER_REFUSED",
            "formatTargetModelPrompt returned non-JSON",
        ) from None
    prompt = data.get("prompt") if isinstance(data, Mapping) else None
    if not isinstance(prompt, str) or data.get("symbol") != CANONICAL_COMPILER_SYMBOL:
        raise TargetCompileError(
            "COMPILER_REFUSED",
            "formatTargetModelPrompt symbol was not returned",
        )
    return prompt


def _reject_duplicate_json_sections(text: str) -> None:
    def hook(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        seen: dict[str, Any] = {}
        for key, value in pairs:
            if key in seen:
                raise TargetCompileError(
                    "DUPLICATE_SECTION", f"duplicate section: {key}"
                )
            seen[key] = value
        return seen

    try:
        json.loads(text, object_pairs_hook=hook)
    except TargetCompileError:
        raise
    except json.JSONDecodeError as exc:
        raise TargetCompileError("TAMPERED_SPE", f"spe text is not JSON: {exc}") from None


def _as_mapping(value: Any, *, code: str, reason: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise TargetCompileError(code, reason)
    return value


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return list(value)
    raise TargetCompileError("MALICIOUS_FIELD", "expected a list field")


def _text_of(item: Any) -> str:
    if isinstance(item, str):
        return item
    if isinstance(item, Mapping):
        for key in ("text", "statement", "label", "id"):
            raw = item.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw
    return ""


def _item_id(item: Any, *, fallback_prefix: str, index: int) -> str:
    if isinstance(item, Mapping):
        for key in ("id", "constraint_id", "fact_id", "provenance_id", "preference_id"):
            raw = item.get(key)
            if isinstance(raw, str) and raw.strip():
                return raw
    return f"{fallback_prefix}-{index}"


def deserialize_spe(source: Any) -> dict[str, Any]:
    """Deserialize a saved .spe package and verify integrity. Fail closed."""
    try:
        if isinstance(source, (bytes, bytearray)):
            source = source.decode("utf-8")
        if isinstance(source, str):
            _reject_duplicate_json_sections(source)
            artifact = loads_spe_artifact(source)
        elif isinstance(source, Mapping):
            # Refuse future / unknown formats before integrity.
            fmt = source.get("spe_format")
            if fmt not in _ALLOWED_FORMATS:
                raise TargetCompileError(
                    "FUTURE_FORMAT" if isinstance(fmt, str) else "MISSING_SECTION",
                    f"unsupported spe_format: {fmt!r}",
                )
            artifact = loads_spe_artifact(source)
        else:
            raise TargetCompileError("MALICIOUS_FIELD", "spe source is not text or object")
    except TargetCompileError:
        raise
    except (TypeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        message = str(exc)
        if "spe_format" in message or "unsupported" in message.lower():
            raise TargetCompileError("FUTURE_FORMAT", message) from None
        raise TargetCompileError("TAMPERED_SPE", message) from None

    for section in _REQUIRED_SECTIONS:
        if section not in artifact:
            raise TargetCompileError("MISSING_SECTION", f"missing section: {section}")

    fmt = artifact.get("spe_format")
    if fmt not in _ALLOWED_FORMATS:
        raise TargetCompileError("FUTURE_FORMAT", f"unsupported spe_format: {fmt!r}")

    intent = _as_mapping(
        artifact.get("intent"),
        code="MISSING_SECTION",
        reason="missing ProtectedIntent section",
    )
    for section in _INTENT_SECTIONS:
        if section not in intent:
            raise TargetCompileError(
                "MISSING_SECTION", f"missing ProtectedIntent.{section}"
            )
        if not isinstance(intent.get(section), list):
            raise TargetCompileError(
                "MALICIOUS_FIELD", f"ProtectedIntent.{section} must be a list"
            )

    # Duplicate top-level sections are impossible in a JSON object; detect
    # duplicate ids inside list sections instead.
    _refuse_duplicate_ids(artifact)

    try:
        checked = verify_integrity(artifact)
    except (TypeError, ValueError) as exc:
        raise TargetCompileError("STALE_HASH", str(exc)) from None
    integrity = checked.get("integrity")
    if not isinstance(integrity, Mapping) or integrity.get("state") != "VERIFIED":
        raise TargetCompileError("STALE_HASH", "spe integrity digest does not match")
    digest = integrity.get("content_sha256")
    if not isinstance(digest, str) or len(digest) != 64:
        raise TargetCompileError("STALE_HASH", "spe integrity digest does not match")
    return checked


def _refuse_duplicate_ids(artifact: Mapping[str, Any]) -> None:
    intent = artifact["intent"]
    seen: set[str] = set()
    for section in _INTENT_SECTIONS:
        for index, item in enumerate(_as_list(intent.get(section))):
            item_id = _item_id(item, fallback_prefix=section, index=index)
            key = f"intent.{section}:{item_id}"
            if key in seen:
                raise TargetCompileError("DUPLICATE_SECTION", f"duplicate id: {item_id}")
            seen.add(key)

    envelope = artifact.get("envelope")
    if not isinstance(envelope, Mapping):
        return
    payload = envelope.get("payload")
    if not isinstance(payload, Mapping):
        return
    for field, id_key in (
        ("hard_constraints", "constraint_id"),
        ("facts", "fact_id"),
        ("provenance", "provenance_id"),
    ):
        seen_field: set[str] = set()
        for index, item in enumerate(_as_list(payload.get(field))):
            if isinstance(item, Mapping) and isinstance(item.get(id_key), str):
                item_id = item[id_key]
            else:
                item_id = _item_id(item, fallback_prefix=field, index=index)
            if item_id in seen_field:
                raise TargetCompileError(
                    "DUPLICATE_SECTION", f"duplicate {field} id: {item_id}"
                )
            seen_field.add(item_id)



_EXTRA_FIELDS = ("mustNot", "privacy", "rollback")
_EXTRA_SLOT_TOKENS = {
    "must_not": "mustNot",
    "mustnot": "mustNot",
    "privacy": "privacy",
    "rollback": "rollback",
}
_PAYLOAD_EXTRA_KEYS = (
    ("mustNot", "mustNot"),
    ("must_not", "mustNot"),
    ("privacy", "privacy"),
    ("privacy_constraints", "privacy"),
    ("rollback", "rollback"),
    ("rollback_constraints", "rollback"),
)


def _extra_slot_token(value: str) -> str | None:
    token = value.strip().lower().replace("-", "_").replace(" ", "_")
    return _EXTRA_SLOT_TOKENS.get(token)


def _constraint_extra_slot(item: Mapping[str, Any]) -> str | None:
    for key in ("kind", "slot", "obligation", "semantic_key"):
        raw = item.get(key)
        if isinstance(raw, str):
            slot = _extra_slot_token(raw)
            if slot is not None:
                return slot
    return None


def _append_extra_line(bucket: dict[str, list[str]], field: str, line: str) -> None:
    if line not in bucket[field]:
        bucket[field].append(line)


def _lines_from_extra_value(value: Any, *, field: str) -> list[str]:
    """Normalize a saved extra into compiler string lines. Fail closed on junk."""
    if isinstance(value, str):
        if not value.strip():
            raise TargetCompileError("MALICIOUS_FIELD", f"{field} extra is empty")
        return [value]
    if not isinstance(value, list):
        raise TargetCompileError(
            "MALICIOUS_FIELD", f"{field} extras must be a list of strings"
        )
    lines: list[str] = []
    for item in value:
        if isinstance(item, str):
            if not item.strip():
                raise TargetCompileError("MALICIOUS_FIELD", f"{field} extra is empty")
            lines.append(item)
            continue
        if isinstance(item, Mapping):
            statement = item.get("statement")
            if not isinstance(statement, str) or not statement.strip():
                statement = item.get("text")
            if not isinstance(statement, str) or not statement.strip():
                raise TargetCompileError(
                    "MALICIOUS_FIELD", f"{field} extra is not a constraint string"
                )
            cid = item.get("constraint_id")
            if not isinstance(cid, str) or not cid.strip():
                cid = item.get("id") if isinstance(item.get("id"), str) else ""
            if cid.strip():
                lines.append(f"[{field}:{cid}] {statement}")
            else:
                lines.append(statement)
            continue
        raise TargetCompileError(
            "MALICIOUS_FIELD", f"{field} extra is not a constraint string"
        )
    return lines


def _empty_extras() -> dict[str, list[str]]:
    return {field: [] for field in _EXTRA_FIELDS}


def _absorb_payload_extras(payload: Mapping[str, Any], bucket: dict[str, list[str]]) -> None:
    """Read compiler-shaped extras saved on the package. Do not invent defaults."""
    raw_extras = payload.get("extras")
    if raw_extras is not None:
        if not isinstance(raw_extras, Mapping):
            raise TargetCompileError("MALICIOUS_FIELD", "extras must be an object")
        for key, field in (
            ("mustNot", "mustNot"),
            ("must_not", "mustNot"),
            ("privacy", "privacy"),
            ("rollback", "rollback"),
        ):
            if key not in raw_extras:
                continue
            for line in _lines_from_extra_value(raw_extras[key], field=field):
                _append_extra_line(bucket, field, line)
    for key, field in _PAYLOAD_EXTRA_KEYS:
        if key not in payload:
            continue
        for line in _lines_from_extra_value(payload[key], field=field):
            _append_extra_line(bucket, field, line)


def _compiler_extras(
    original: Mapping[str, Any], working: Mapping[str, Any]
) -> dict[str, list[str]] | None:
    """Pass saved extras through. A deleted field becomes [] so defaults cannot refill it."""
    saved = original.get("extras")
    if not isinstance(saved, Mapping):
        return None
    current = working.get("extras")
    if current is None:
        current = {}
    if not isinstance(current, Mapping):
        raise TargetCompileError("MALICIOUS_FIELD", "extras must be an object")
    out: dict[str, list[str]] = {}
    for field in _EXTRA_FIELDS:
        saved_items = saved.get(field) or []
        if not isinstance(saved_items, list) or not saved_items:
            continue
        if field not in current:
            out[field] = []
            continue
        value = current.get(field)
        if not isinstance(value, list) or not all(isinstance(item, str) for item in value):
            raise TargetCompileError(
                "MALICIOUS_FIELD", f"{field} extras must be a list of strings"
            )
        out[field] = list(value)
    return out or None


def recover_intermediate(artifact: Mapping[str, Any]) -> dict[str, Any]:
    """Recover ProtectedIntent, requirements, evidence, authority into IR."""
    intent = copy.deepcopy(dict(artifact["intent"]))
    envelope = artifact.get("envelope") if isinstance(artifact.get("envelope"), Mapping) else {}
    payload = (
        envelope.get("payload") if isinstance(envelope.get("payload"), Mapping) else {}
    )
    if not isinstance(payload, Mapping):
        payload = {}

    authority = payload.get("authority_state")
    if authority is None:
        authority = {"grants": [], "level": 0, "status": "NONE"}
    authority = _as_mapping(
        authority, code="MALICIOUS_FIELD", reason="authority_state must be an object"
    )
    authority_snapshot = canonicalize(dict(authority))

    hard_constraints = []
    extra_lines = _empty_extras()
    ordinary_constraints = []
    for index, item in enumerate(_as_list(payload.get("hard_constraints"))):
        if not isinstance(item, Mapping):
            raise TargetCompileError("MALICIOUS_FIELD", "constraint must be an object")
        statement = item.get("statement")
        constraint_id = item.get("constraint_id")
        if not isinstance(statement, str) or not isinstance(constraint_id, str):
            raise TargetCompileError("MALICIOUS_FIELD", "constraint fields invalid")
        record = {
            "constraint_id": constraint_id,
            "statement": statement,
            "strength": item.get("strength", "HARD"),
        }
        slot = _constraint_extra_slot(item)
        if slot is not None:
            record["extra_slot"] = slot
            _append_extra_line(extra_lines, slot, f"[{slot}:{constraint_id}] {statement}")
        else:
            ordinary_constraints.append(record)
        hard_constraints.append(record)
    _absorb_payload_extras(payload, extra_lines)

    evidence = []
    for index, item in enumerate(_as_list(payload.get("facts"))):
        if not isinstance(item, Mapping):
            raise TargetCompileError("MALICIOUS_FIELD", "fact must be an object")
        fact_id = item.get("fact_id")
        statement = item.get("statement")
        if not isinstance(fact_id, str) or not isinstance(statement, str):
            raise TargetCompileError("MALICIOUS_FIELD", "fact fields invalid")
        provenance_ids = item.get("provenance_ids") or []
        if not isinstance(provenance_ids, list):
            raise TargetCompileError("MALICIOUS_FIELD", "provenance_ids must be a list")
        evidence.append(
            {
                "fact_id": fact_id,
                "statement": statement,
                "provenance_ids": [str(x) for x in provenance_ids],
            }
        )

    unknowns = []
    for index, item in enumerate(_as_list(intent.get("unknowns"))):
        text = _text_of(item)
        item_id = _item_id(item, fallback_prefix="unknown", index=index)
        if text:
            unknowns.append(f"[UNKNOWN:{item_id}] {text}")
        else:
            unknowns.append(f"[UNKNOWN:{item_id}]")

    for index, item in enumerate(_as_list(payload.get("uncertainties"))):
        text = _text_of(item)
        item_id = _item_id(item, fallback_prefix="uncertainty", index=index)
        unknowns.append(f"[UNKNOWN:{item_id}] {text}".rstrip())

    contradictions = []
    for index, item in enumerate(_as_list(intent.get("conflicts"))):
        text = _text_of(item)
        item_id = _item_id(item, fallback_prefix="conflict", index=index)
        contradictions.append(
            f"[CONTRADICTION:{item_id}] {text}".rstrip()
            if text
            else f"[CONTRADICTION:{item_id}]"
        )

    confirmed_obligations = []
    for index, item in enumerate(_as_list(intent.get("confirmed"))):
        text = _text_of(item)
        item_id = _item_id(item, fallback_prefix="confirmed", index=index)
        if text:
            confirmed_obligations.append(f"[MUST:{item_id}] {text}")

    test_gates = [
        f"[CONSTRAINT:{c['constraint_id']}] {c['statement']}" for c in ordinary_constraints
    ]
    for obligation in confirmed_obligations:
        if obligation not in test_gates:
            test_gates.append(obligation)

    stop_conditions = [
        "Stop immediately if any existing regression test fails (exit code != 0).",
        "Stop if unexpected schema changes or boundary type modifications are required.",
        "Stop and HOLD if external network egress is requested.",
    ]
    network_mode = envelope.get("network_mode") if isinstance(envelope, Mapping) else None
    if network_mode == "NONE":
        stop_conditions.append("Stop if network_mode NONE is violated (artifact forbids egress).")
    auth_status = authority_snapshot.get("status")
    auth_level = authority_snapshot.get("level")
    stop_conditions.append(
        f"Stop if authority escalation is requested "
        f"(bound authority status={auth_status!s} level={auth_level!s})."
    )
    for constraint in hard_constraints:
        stop_conditions.append(
            f"Stop if hard constraint {constraint['constraint_id']} is dropped or weakened."
        )

    integrity = artifact["integrity"]
    baseline_sha = integrity["content_sha256"]
    protected_intent_text = str(artifact["user_request"])
    mission = (
        f"Execute the saved SPE artifact mission without altering ProtectedIntent "
        f"or authority: {protected_intent_text}"
    )
    steps = [
        "1. Verify the SPE integrity digest and ProtectedIntent fingerprint.",
        "2. Preserve every hard constraint, evidence id, unknown, and STOP condition.",
        "3. Produce the target-model prompt without minting authority or inventing evidence.",
    ]

    evidence_lines = [
        f"[EVIDENCE:{item['fact_id']}] {item['statement']} "
        f"(provenance={','.join(item['provenance_ids']) or 'none'})"
        for item in evidence
    ]

    intermediate = {
        "schema": INTERMEDIATE_SCHEMA,
        "protected_intent": canonicalize(intent),
        "protected_intent_text": protected_intent_text,
        "requirements": hard_constraints,
        "confirmed_obligations": confirmed_obligations,
        "evidence": evidence,
        "evidence_lines": evidence_lines,
        "authority": authority_snapshot,
        "unknowns": unknowns,
        "contradictions": contradictions,
        "test_gates": test_gates,
        "stop_conditions": stop_conditions,
        "mission": mission,
        "ordered_steps": steps,
        "baseline_sha": baseline_sha,
        "spe_format": artifact["spe_format"],
        "content_sha256": baseline_sha,
        "extras": extra_lines,
    }
    return intermediate


def verify_preservation(
    intermediate: Mapping[str, Any],
    *,
    prompt: str,
    authority_out: Mapping[str, Any] | None = None,
) -> None:
    """Fail closed if the adapter dropped/changed protected surfaces."""
    if intermediate.get("schema") != INTERMEDIATE_SCHEMA:
        raise TargetCompileError("MALICIOUS_FIELD", "intermediate schema mismatch")

    extras = intermediate.get("extras")
    if not isinstance(extras, Mapping):
        extras = {}
    for field in _EXTRA_FIELDS:
        for line in extras.get(field) or []:
            if not isinstance(line, str) or line not in prompt:
                raise TargetCompileError("EXTRAS_DROPPED", f"dropped field: {field}")

    intent = intermediate.get("protected_intent")
    if not isinstance(intent, Mapping):
        raise TargetCompileError("MISSING_SECTION", "ProtectedIntent missing in IR")
    if intermediate["protected_intent_text"] not in prompt:
        raise TargetCompileError(
            "PROTECTED_INTENT_LOST", "ProtectedIntent text missing from prompt"
        )

    for constraint in intermediate.get("requirements") or []:
        cid = constraint.get("constraint_id")
        statement = constraint.get("statement")
        if not isinstance(cid, str) or cid not in prompt:
            raise TargetCompileError(
                "CONSTRAINT_DROPPED", f"constraint id missing from prompt: {cid!r}"
            )
        if not isinstance(statement, str) or statement not in prompt:
            raise TargetCompileError(
                "CONSTRAINT_DROPPED", f"constraint statement missing: {statement!r}"
            )

    for obligation in intermediate.get("confirmed_obligations") or []:
        # obligation format: [MUST:id] text — require id token and text
        if "]" in obligation:
            body = obligation.split("]", 1)[1].strip()
            oid = obligation[obligation.find(":") + 1 : obligation.find("]")]
            if oid and oid not in prompt:
                raise TargetCompileError(
                    "OBLIGATION_DROPPED", f"obligation id missing: {oid}"
                )
            if body and body not in prompt:
                raise TargetCompileError(
                    "OBLIGATION_DROPPED", f"obligation text missing: {body}"
                )

    for item in intermediate.get("evidence") or []:
        fact_id = item.get("fact_id")
        if not isinstance(fact_id, str) or fact_id not in prompt:
            raise TargetCompileError(
                "EVIDENCE_DROPPED", f"evidence id missing from prompt: {fact_id!r}"
            )
        # Invented evidence check is performed by callers comparing sets.

    for unknown in intermediate.get("unknowns") or []:
        if unknown not in prompt:
            raise TargetCompileError("UNKNOWN_DROPPED", f"unknown missing: {unknown}")

    for stop in intermediate.get("stop_conditions") or []:
        if stop not in prompt:
            raise TargetCompileError("STOP_DROPPED", f"stop condition missing: {stop}")

    authority = intermediate.get("authority")
    if not isinstance(authority, Mapping):
        raise TargetCompileError("MALICIOUS_FIELD", "authority missing in IR")
    if authority_out is not None and not strict_equal(
        canonicalize(dict(authority)), canonicalize(dict(authority_out))
    ):
        raise TargetCompileError("AUTHORITY_CHANGED", "authority was mutated")


def compile_spe_for_target(
    spe_source: Any,
    target: str,
    *,
    mutate_intermediate: Any | None = None,
) -> dict[str, Any]:
    """End-to-end adapter compile for one named target. Fail closed on attacks.

    ``mutate_intermediate`` is test-only: if provided, it receives a deep copy of
    the intermediate form before prompt formatting so adversarial drops can be
    proven to fail closed via verify_preservation.
    """
    canonical_target = resolve_target_model(target)

    artifact = deserialize_spe(spe_source)
    intermediate = recover_intermediate(artifact)
    working = copy.deepcopy(intermediate)
    if mutate_intermediate is not None:
        maybe = mutate_intermediate(working)
        if maybe is not None:
            working = maybe

    prompt = invoke_format_target_model_prompt(
        canonical_target,
        working["mission"],
        working["baseline_sha"],
        working["protected_intent_text"],
        working["ordered_steps"],
        working["evidence_lines"],
        working["contradictions"],
        working["unknowns"],
        working["test_gates"],
        working["stop_conditions"],
        extras=_compiler_extras(intermediate, working),
    )

    # Preservation is always checked against the *original* recovered IR, so an
    # adversarial mutate that drops constraints fails closed.
    verify_preservation(
        intermediate,
        prompt=prompt,
        authority_out=working.get("authority"),
    )

    # Refuse invented evidence: prompt evidence ids must be ⊆ recovered ids.
    recovered_ids = {item["fact_id"] for item in intermediate["evidence"]}
    for token in _evidence_ids_in_prompt(prompt):
        if token not in recovered_ids:
            raise TargetCompileError(
                "EVIDENCE_INVENTED", f"prompt invents evidence id: {token}"
            )

    if not strict_equal(working.get("authority"), intermediate.get("authority")):
        raise TargetCompileError("AUTHORITY_CHANGED", "adapter changed authority")

    return {
        "target": canonical_target,
        "prompt": prompt,
        "intermediate": intermediate,
        "authority": copy.deepcopy(intermediate["authority"]),
        "protected_intent": copy.deepcopy(intermediate["protected_intent"]),
        "content_sha256": intermediate["content_sha256"],
        "compiler": {
            "symbol": CANONICAL_COMPILER_SYMBOL,
            "path": CANONICAL_COMPILER_PATH,
            "defining_sha": CANONICAL_COMPILER_SHA,
            "source_sha": CANONICAL_COMPILER_SOURCE_SHA,
            "source_blob": CANONICAL_COMPILER_BLOB,
        },
        "artifact_export": dumps_spe_artifact(artifact),
    }


def _evidence_ids_in_prompt(prompt: str) -> set[str]:
    found: set[str] = set()
    marker = "[EVIDENCE:"
    start = 0
    while True:
        idx = prompt.find(marker, start)
        if idx < 0:
            break
        end = prompt.find("]", idx)
        if end < 0:
            break
        found.add(prompt[idx + len(marker) : end])
        start = end + 1
    return found


def semantic_compare(
    left: Mapping[str, Any],
    right: Mapping[str, Any],
) -> dict[str, Any]:
    """Compare ProtectedIntent / authority / constraints / evidence ids."""
    left_ir = left["intermediate"] if "intermediate" in left else left
    right_ir = right["intermediate"] if "intermediate" in right else right
    intent_equal = strict_equal(left_ir["protected_intent"], right_ir["protected_intent"])
    authority_equal = strict_equal(left_ir["authority"], right_ir["authority"])
    left_constraints = {
        (c["constraint_id"], c["statement"]) for c in left_ir["requirements"]
    }
    right_constraints = {
        (c["constraint_id"], c["statement"]) for c in right_ir["requirements"]
    }
    left_evidence = {e["fact_id"] for e in left_ir["evidence"]}
    right_evidence = {e["fact_id"] for e in right_ir["evidence"]}
    left_unknowns = set(left_ir["unknowns"])
    right_unknowns = set(right_ir["unknowns"])
    left_stops = set(left_ir["stop_conditions"])
    right_stops = set(right_ir["stop_conditions"])

    def _extra_map(ir: Mapping[str, Any]) -> dict[str, list[str]]:
        raw = ir.get("extras") if isinstance(ir.get("extras"), Mapping) else {}
        return {field: list(raw.get(field) or []) for field in _EXTRA_FIELDS}

    extras_equal = _extra_map(left_ir) == _extra_map(right_ir)
    ok = (
        intent_equal
        and authority_equal
        and left_constraints == right_constraints
        and left_evidence == right_evidence
        and left_unknowns == right_unknowns
        and left_stops == right_stops
        and extras_equal
    )
    if not ok:
        raise TargetCompileError("SEMANTIC_MISMATCH", "semantic compare failed")
    return {
        "equal": True,
        "protected_intent": intent_equal,
        "authority": authority_equal,
        "constraints": left_constraints == right_constraints,
        "evidence_ids": left_evidence == right_evidence,
        "unknowns": left_unknowns == right_unknowns,
        "stop_conditions": left_stops == right_stops,
        "extras": extras_equal,
    }


__all__ = [
    "CANONICAL_COMPILER_BLOB",
    "CANONICAL_COMPILER_PATH",
    "CANONICAL_COMPILER_SHA",
    "CANONICAL_COMPILER_SOURCE_SHA",
    "CANONICAL_COMPILER_SYMBOL",
    "INTERMEDIATE_SCHEMA",
    "TARGET_EXPORT_MODELS",
    "TARGET_SELECT_ALIASES",
    "TargetCompileError",
    "UnknownTargetError",
    "assert_canonical_compiler_bytes",
    "compile_spe_for_target",
    "deserialize_spe",
    "invoke_format_target_model_prompt",
    "recover_intermediate",
    "resolve_target_model",
    "semantic_compare",
    "verify_preservation",
]
