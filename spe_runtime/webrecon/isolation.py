"""Untrusted-document isolation.

Captured HTML, CSS, and sidecars are data. This module strips active-content
carriers from the observation path and refuses structural keys that would
smuggle authority, proof, or semantic status into the reconstruction contract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.webrecon.digest import digest_text

# Keys that must not survive a capture sidecar. Matched at every object level.
FORBIDDEN_SIDECAR_KEYS = frozenset(
    {
        "permit",
        "permits",
        "verified_outcome",
        "verified_success",
        "execution_grant",
        "authority",
        "receipt",
        "receipts",
        "EXECUTED",
        "VERIFIED_SUCCESS",
        "PROMOTE",
        "k3",
        "quality_score",
        "semantic_category",
        "semantic_authority",
        "mint_authority",
    }
)

SIDECAR_ALLOWLIST = frozenset({"computed_typography", "camera", "webgl"})

_TYPO_KEYS = frozenset(
    {
        "font_family",
        "font_size",
        "font_weight",
        "line_height",
        "letter_spacing",
        "font_shorthand",
        "source",
    }
)
_CAMERA_KEYS = frozenset({"kind", "position", "target", "fov", "near", "far", "notes"})
_WEBGL_KEYS = frozenset(
    {
        "library_declared",
        "renderer",
        "camera_count",
        "light_count",
        "object_count",
        "notes",
        "executed",
    }
)

_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_CSS_JS = re.compile(r"javascript\s*:", re.IGNORECASE)
_CSS_VBS = re.compile(r"vbscript\s*:", re.IGNORECASE)
# Property name is exactly `behavior`, so `scroll-behavior` stays.
_CSS_BEHAVIOR = re.compile(r"(?<![\w-])behavior\s*:[^;}{]*", re.IGNORECASE)
_CSS_MOZ = re.compile(r"-moz-binding\s*:[^;}{]*", re.IGNORECASE)


class IsolationError(ValueError):
    """Raised when a sidecar tries to carry a forbidden or unknown structure."""

    def __init__(self, code: str, detail: str) -> None:
        super().__init__(detail)
        self.code = code


@dataclass(frozen=True)
class QuarantineEvent:
    """A record that active content was seen and withheld. The payload is not stored."""

    kind: str
    node_hint: str | None
    digest: str | None
    byte_length: int | None
    detail: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "node_hint": self.node_hint,
            "digest": self.digest,
            "byte_length": self.byte_length,
            "detail": self.detail,
        }


@dataclass(frozen=True)
class IsolationReport:
    """How the capture was held. Executable content stays quarantined."""

    taint_labels: tuple[str, ...]
    events: tuple[QuarantineEvent, ...]
    executable_content: str
    parser: str
    sanitized_css_digest: str

    def __post_init__(self) -> None:
        labels = tuple(dict.fromkeys((*self.taint_labels, "UNTRUSTED_DOCUMENT")))
        object.__setattr__(self, "taint_labels", labels)
        object.__setattr__(self, "executable_content", "QUARANTINED")
        object.__setattr__(self, "parser", "HTML_PARSER_DATA_ONLY")

    def to_dict(self) -> dict[str, Any]:
        return {
            "taint_labels": list(self.taint_labels),
            "events": [event.to_dict() for event in self.events],
            "executable_content": "QUARANTINED",
            "parser": "HTML_PARSER_DATA_ONLY",
            "sanitized_css_digest": self.sanitized_css_digest,
        }


def _walk_forbidden(value: object, path: str = "") -> None:
    if isinstance(value, Mapping):
        bad = FORBIDDEN_SIDECAR_KEYS & {str(key) for key in value.keys()}
        if bad:
            loc = f" at {path}" if path else ""
            raise IsolationError(
                "WR_FORBIDDEN_PAYLOAD",
                f"sidecar contains forbidden keys{loc}: {sorted(bad)}",
            )
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else str(key)
            _walk_forbidden(child, child_path)
    elif isinstance(value, (list, tuple)):
        for index, child in enumerate(value):
            _walk_forbidden(child, f"{path}[{index}]")


def _clean_text(value: str, *, limit: int = 200) -> str:
    cleaned = _CONTROL_RE.sub("", value).strip()
    if len(cleaned) > limit:
        return cleaned[:limit]
    return cleaned


def _as_number_list(value: object, *, field: str) -> tuple[str, ...]:
    if not isinstance(value, (list, tuple)):
        raise IsolationError("WR_SIDECAR_INVALID", f"{field} must be a list")
    if len(value) > 8:
        raise IsolationError("WR_SIDECAR_INVALID", f"{field} is too long")
    out: list[str] = []
    for item in value:
        if isinstance(item, bool) or not isinstance(item, (int, float, str)):
            raise IsolationError("WR_SIDECAR_INVALID", f"{field} has a non-scalar")
        if isinstance(item, float):
            if item != item or item in (float("inf"), float("-inf")):
                raise IsolationError("WR_SIDECAR_INVALID", f"{field} is non-finite")
            out.append(str(item))
        else:
            out.append(_clean_text(str(item), limit=64))
    return tuple(out)


def _optional_text(value: object, *, field: str, limit: int = 200) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        raise IsolationError("WR_SIDECAR_INVALID", f"{field} must be a string")
    text = _clean_text(value, limit=limit)
    return text or None


def _optional_count(value: object, *, field: str) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, int):
        raise IsolationError("WR_SIDECAR_INVALID", f"{field} must be an integer")
    if value < 0:
        raise IsolationError("WR_SIDECAR_INVALID", f"{field} must be >= 0")
    return value


@dataclass(frozen=True)
class TypographyHint:
    font_family: str | None
    font_size: str | None
    font_weight: str | None
    line_height: str | None
    letter_spacing: str | None
    font_shorthand: str | None
    source: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "font_family": self.font_family,
            "font_size": self.font_size,
            "font_weight": self.font_weight,
            "line_height": self.line_height,
            "letter_spacing": self.letter_spacing,
            "font_shorthand": self.font_shorthand,
            "source": self.source,
        }


@dataclass(frozen=True)
class CameraHint:
    kind: str | None
    position: tuple[str, ...]
    target: tuple[str, ...]
    fov: str | None
    near: str | None
    far: str | None
    notes: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "position": list(self.position),
            "target": list(self.target),
            "fov": self.fov,
            "near": self.near,
            "far": self.far,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class WebGlHint:
    library_declared: tuple[str, ...]
    renderer: str | None
    camera_count: int | None
    light_count: int | None
    object_count: int | None
    notes: str | None
    execution_claim_dropped: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "library_declared": list(self.library_declared),
            "renderer": self.renderer,
            "camera_count": self.camera_count,
            "light_count": self.light_count,
            "object_count": self.object_count,
            "notes": self.notes,
            "execution_claim_dropped": self.execution_claim_dropped,
        }


@dataclass(frozen=True)
class IsolatedSidecar:
    typography: tuple[TypographyHint, ...]
    camera: CameraHint | None
    webgl: WebGlHint | None
    events: tuple[QuarantineEvent, ...]


def _cut_balanced_call(text: str, function_name: str) -> tuple[str, str | None]:
    """Remove `name(...)` calls, including nested parentheses. Returns removed text."""

    needle = function_name.lower() + "("
    lowered = text.lower()
    pieces: list[str] = []
    removed: list[str] = []
    cursor = 0
    while True:
        start = lowered.find(needle, cursor)
        if start < 0:
            pieces.append(text[cursor:])
            break
        open_paren = start + len(function_name)
        depth = 0
        end = None
        for index in range(open_paren, len(text)):
            char = text[index]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    end = index + 1
                    break
        if end is None:
            pieces.append(text[cursor:])
            break
        removed.append(text[start:end])
        pieces.append(text[cursor:start])
        cursor = end
        lowered = text.lower()
    payload = "\n".join(removed) if removed else None
    return "".join(pieces), payload


def _cut_pattern(text: str, pattern: re.Pattern[str]) -> tuple[str, str | None]:
    matches = list(pattern.finditer(text))
    if not matches:
        return text, None
    payload = "\n".join(match.group(0) for match in matches)
    return pattern.sub("", text), payload


def _record_cut(
    events: list[QuarantineEvent],
    *,
    kind: str,
    source: str,
    payload: str | None,
) -> None:
    if not payload:
        return
    events.append(
        QuarantineEvent(
            kind=kind,
            node_hint=source,
            digest=digest_text(payload),
            byte_length=len(payload.encode("utf-8")),
            detail=kind,
        )
    )


def _cut_data_urls(text: str) -> tuple[str, str | None]:
    """Remove url(data:...) calls. Other url() references stay as observations."""

    lowered = text.lower()
    pieces: list[str] = []
    removed: list[str] = []
    cursor = 0
    while True:
        start = lowered.find("url(", cursor)
        if start < 0:
            pieces.append(text[cursor:])
            break
        depth = 0
        end = None
        for index in range(start + 3, len(text)):
            char = text[index]
            if char == "(":
                depth += 1
            elif char == ")":
                depth -= 1
                if depth == 0:
                    end = index + 1
                    break
        if end is None:
            pieces.append(text[cursor:])
            break
        body = text[start + 4 : end - 1].strip().strip("\"'").lstrip()
        if body.lower().startswith("data:"):
            removed.append(text[start:end])
            pieces.append(text[cursor:start])
        else:
            pieces.append(text[cursor:end])
        cursor = end
    payload = "\n".join(removed) if removed else None
    return "".join(pieces), payload


def sanitize_css(css: str, *, source: str) -> tuple[str, tuple[QuarantineEvent, ...]]:
    """Remove active CSS carriers. The removed text is digested, not returned."""

    events: list[QuarantineEvent] = []
    text = _CONTROL_RE.sub("", css)
    text, payload = _cut_balanced_call(text, "expression")
    _record_cut(events, kind="CSS_EXPRESSION", source=source, payload=payload)
    text, payload = _cut_pattern(text, _CSS_JS)
    _record_cut(events, kind="CSS_JAVASCRIPT_URL", source=source, payload=payload)
    text, payload = _cut_pattern(text, _CSS_VBS)
    _record_cut(events, kind="CSS_VBSCRIPT_URL", source=source, payload=payload)
    text, payload = _cut_pattern(text, _CSS_BEHAVIOR)
    _record_cut(events, kind="CSS_BEHAVIOR", source=source, payload=payload)
    text, payload = _cut_pattern(text, _CSS_MOZ)
    _record_cut(events, kind="CSS_MOZ_BINDING", source=source, payload=payload)
    text, payload = _cut_data_urls(text)
    _record_cut(events, kind="CSS_DATA_URL", source=source, payload=payload)
    return text, tuple(events)


def isolate_sidecar(sidecar: Mapping[str, Any] | None) -> IsolatedSidecar:
    """Validate a capturer sidecar. Unknown top-level keys are refused."""

    if sidecar is None:
        return IsolatedSidecar(typography=(), camera=None, webgl=None, events=())
    if not isinstance(sidecar, Mapping):
        raise IsolationError("WR_SIDECAR_INVALID", "sidecar must be an object")
    _walk_forbidden(sidecar)
    unknown = [str(key) for key in sidecar.keys() if str(key) not in SIDECAR_ALLOWLIST]
    if unknown:
        raise IsolationError(
            "WR_SIDECAR_KEY_REFUSED",
            f"sidecar keys are not in the v1 allowlist: {sorted(unknown)}",
        )

    events: list[QuarantineEvent] = []
    hints: list[TypographyHint] = []
    raw_type = sidecar.get("computed_typography", [])
    if raw_type is None:
        raw_type = []
    if not isinstance(raw_type, list):
        raise IsolationError("WR_SIDECAR_INVALID", "computed_typography must be a list")
    for index, item in enumerate(raw_type):
        if not isinstance(item, Mapping):
            raise IsolationError("WR_SIDECAR_INVALID", "typography hint must be an object")
        extra = [str(key) for key in item.keys() if str(key) not in _TYPO_KEYS]
        if extra:
            raise IsolationError(
                "WR_SIDECAR_KEY_REFUSED",
                f"typography hint keys refused: {sorted(extra)}",
            )
        hints.append(
            TypographyHint(
                font_family=_optional_text(item.get("font_family"), field="font_family"),
                font_size=_optional_text(item.get("font_size"), field="font_size", limit=64),
                font_weight=_optional_text(item.get("font_weight"), field="font_weight", limit=32),
                line_height=_optional_text(item.get("line_height"), field="line_height", limit=32),
                letter_spacing=_optional_text(
                    item.get("letter_spacing"), field="letter_spacing", limit=32
                ),
                font_shorthand=_optional_text(
                    item.get("font_shorthand"), field="font_shorthand"
                ),
                source=_optional_text(item.get("source"), field="source", limit=80)
                or f"sidecar:{index}",
            )
        )

    camera: CameraHint | None = None
    if "camera" in sidecar and sidecar["camera"] is not None:
        raw_camera = sidecar["camera"]
        if not isinstance(raw_camera, Mapping):
            raise IsolationError("WR_SIDECAR_INVALID", "camera must be an object")
        extra = [str(key) for key in raw_camera.keys() if str(key) not in _CAMERA_KEYS]
        if extra:
            raise IsolationError(
                "WR_SIDECAR_KEY_REFUSED",
                f"camera keys refused: {sorted(extra)}",
            )
        camera = CameraHint(
            kind=_optional_text(raw_camera.get("kind"), field="camera.kind", limit=64),
            position=_as_number_list(raw_camera.get("position", ()), field="camera.position")
            if "position" in raw_camera
            else (),
            target=_as_number_list(raw_camera.get("target", ()), field="camera.target")
            if "target" in raw_camera
            else (),
            fov=_optional_text(raw_camera.get("fov"), field="camera.fov", limit=32),
            near=_optional_text(raw_camera.get("near"), field="camera.near", limit=32),
            far=_optional_text(raw_camera.get("far"), field="camera.far", limit=32),
            notes=_optional_text(raw_camera.get("notes"), field="camera.notes"),
        )

    webgl: WebGlHint | None = None
    if "webgl" in sidecar and sidecar["webgl"] is not None:
        raw_webgl = sidecar["webgl"]
        if not isinstance(raw_webgl, Mapping):
            raise IsolationError("WR_SIDECAR_INVALID", "webgl must be an object")
        extra = [str(key) for key in raw_webgl.keys() if str(key) not in _WEBGL_KEYS]
        if extra:
            raise IsolationError(
                "WR_SIDECAR_KEY_REFUSED",
                f"webgl keys refused: {sorted(extra)}",
            )
        dropped = raw_webgl.get("executed") is True
        if dropped:
            events.append(
                QuarantineEvent(
                    kind="SIDECAR_EXECUTION_CLAIM",
                    node_hint="sidecar.webgl",
                    digest=None,
                    byte_length=None,
                    detail="SIDECAR_EXECUTION_CLAIM_DROPPED",
                )
            )
        libraries: list[str] = []
        declared = raw_webgl.get("library_declared", [])
        if isinstance(declared, str):
            declared = [declared]
        if not isinstance(declared, list):
            raise IsolationError("WR_SIDECAR_INVALID", "library_declared must be a list or string")
        for entry in declared:
            if not isinstance(entry, str):
                raise IsolationError("WR_SIDECAR_INVALID", "library_declared entries must be strings")
            text = _clean_text(entry, limit=80)
            if text and text not in libraries:
                libraries.append(text)
        webgl = WebGlHint(
            library_declared=tuple(libraries),
            renderer=_optional_text(raw_webgl.get("renderer"), field="renderer"),
            camera_count=_optional_count(raw_webgl.get("camera_count"), field="camera_count"),
            light_count=_optional_count(raw_webgl.get("light_count"), field="light_count"),
            object_count=_optional_count(raw_webgl.get("object_count"), field="object_count"),
            notes=_optional_text(raw_webgl.get("notes"), field="webgl.notes"),
            execution_claim_dropped=dropped,
        )

    return IsolatedSidecar(
        typography=tuple(hints),
        camera=camera,
        webgl=webgl,
        events=tuple(events),
    )
