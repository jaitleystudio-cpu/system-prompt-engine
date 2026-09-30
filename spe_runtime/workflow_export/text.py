"""Length-prefixed generic text export. Any prompt byte sequence round-trips."""

from __future__ import annotations

from typing import Any

from spe_runtime.workflow_export.model import TEXT_FORMAT


def _put(chunks: list[bytes], payload: str) -> None:
    raw = payload.encode("utf-8")
    chunks.append(f"{len(raw)}\n".encode("ascii"))
    chunks.append(raw)
    chunks.append(b"\n")


def render_generic_text(canonical: dict[str, Any]) -> str:
    chunks: list[bytes] = [f"{TEXT_FORMAT}\n".encode("ascii")]
    _put(chunks, canonical["prompt_body_disposition"])
    _put(chunks, canonical["prompt_body_sha256"])
    _put(chunks, canonical["provider_target"])
    _put(chunks, canonical["prompt_body"])
    variables = canonical["variables"]
    chunks.append(f"variables {len(variables)}\n".encode("ascii"))
    for variable in variables:
        _put(chunks, variable["name"])
        _put(chunks, variable["value"])
        _put(chunks, variable["disposition"])
    for field in ("required_inputs", "expected_outputs", "constraints"):
        values = canonical[field]
        chunks.append(f"{field} {len(values)}\n".encode("ascii"))
        for value in values:
            _put(chunks, value)
    return b"".join(chunks).decode("utf-8")


def _line(buf: bytes, index: int) -> tuple[str, int]:
    end = buf.find(b"\n", index)
    if end < 0:
        raise ValueError("truncated workflow text")
    return buf[index:end].decode("ascii"), end + 1


def _blob(buf: bytes, index: int) -> tuple[str, int]:
    header, index = _line(buf, index)
    if not header.isdigit():
        raise ValueError("workflow text blob length is missing")
    length = int(header)
    raw = buf[index : index + length]
    if len(raw) != length or buf[index + length : index + length + 1] != b"\n":
        raise ValueError("truncated workflow text blob")
    return raw.decode("utf-8"), index + length + 1


def parse_generic_text(text: str) -> dict[str, Any]:
    if not isinstance(text, str):
        raise ValueError("workflow text must be a string")
    buf = text.encode("utf-8")
    header, index = _line(buf, 0)
    if header != TEXT_FORMAT:
        raise ValueError("workflow text header is not SPE_WORKFLOW_TEXT v1")
    disposition, index = _blob(buf, index)
    digest, index = _blob(buf, index)
    provider_target, index = _blob(buf, index)
    prompt_body, index = _blob(buf, index)
    var_header, index = _line(buf, index)
    label, _, count_text = var_header.partition(" ")
    if label != "variables" or not count_text.isdigit():
        raise ValueError("workflow text variables header is missing")
    variables = []
    for _ in range(int(count_text)):
        name, index = _blob(buf, index)
        value, index = _blob(buf, index)
        variable_disposition, index = _blob(buf, index)
        variables.append(
            {"name": name, "value": value, "disposition": variable_disposition}
        )
    lists: dict[str, list[str]] = {}
    for field in ("required_inputs", "expected_outputs", "constraints"):
        field_header, index = _line(buf, index)
        field_label, _, field_count = field_header.partition(" ")
        if field_label != field or not field_count.isdigit():
            raise ValueError(f"workflow text {field} header is missing")
        values = []
        for _ in range(int(field_count)):
            item, index = _blob(buf, index)
            values.append(item)
        lists[field] = values
    if index != len(buf):
        raise ValueError("workflow text has trailing bytes")
    return {
        "prompt_body": prompt_body,
        "prompt_body_disposition": disposition,
        "prompt_body_sha256": digest,
        "variables": variables,
        "required_inputs": lists["required_inputs"],
        "expected_outputs": lists["expected_outputs"],
        "constraints": lists["constraints"],
        "provider_target": provider_target,
    }
