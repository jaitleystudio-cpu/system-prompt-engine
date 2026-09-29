"""Structural checks shared by media envelopes. No semantic scoring."""

from __future__ import annotations

import re
from typing import Any, Mapping

_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
_LANGUAGE = re.compile(r"^(und|[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,3})$")
_SPEAKER_SLOT = re.compile(r"^SPEAKER_SLOT_[1-9][0-9]{0,3}$")

IDENTITY_KEYS = frozenset(
    {
        "biometric",
        "biometric_id",
        "diarization_identity",
        "email",
        "person_id",
        "speaker_id",
        "speaker_identity",
        "speaker_name",
        "voiceprint",
    }
)
SCORE_KEYS = frozenset(
    {
        "authority_score",
        "confidence",
        "quality_score",
        "score",
    }
)
RAW_AUDIO_KEYS = frozenset(
    {
        "audio_b64",
        "audio_bytes",
        "pcm",
        "raw_audio",
        "samples",
        "waveform",
    }
)
RAW_VIDEO_KEYS = frozenset(
    {
        "frame_bytes",
        "frames",
        "pixels",
        "raw_video",
        "video_b64",
        "video_bytes",
    }
)


def require_id(value: object, field_name: str) -> str:
    text = str(value).strip()
    if not _ID.fullmatch(text):
        raise ValueError(f"{field_name} must be a stable id, got {value!r}")
    return text


def require_digest(value: object, field_name: str) -> str:
    text = str(value).strip()
    if not _DIGEST.fullmatch(text):
        raise ValueError(f"{field_name} must be a sha256 digest, got {value!r}")
    return text


def require_language_tag(value: object) -> str:
    text = str(value).strip()
    if not _LANGUAGE.fullmatch(text):
        raise ValueError(f"language_tag must be a BCP 47 tag or 'und', got {value!r}")
    return text


def require_speaker_slot(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not _SPEAKER_SLOT.fullmatch(text):
        raise ValueError(
            "speaker_slot must be an anonymous SPEAKER_SLOT_N label or omitted, "
            f"got {value!r}"
        )
    return text


def require_non_negative_int(value: object, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{field_name} must be an integer")
    if value < 0:
        raise ValueError(f"{field_name} must be >= 0")
    return value


def require_positive_int(value: object, field_name: str) -> int:
    number = require_non_negative_int(value, field_name)
    if number < 1:
        raise ValueError(f"{field_name} must be >= 1")
    return number


def require_span(start_ms: object, end_ms: object) -> tuple[int, int]:
    start = require_non_negative_int(start_ms, "start_ms")
    end = require_non_negative_int(end_ms, "end_ms")
    if end <= start:
        raise ValueError("end_ms must be greater than start_ms")
    return start, end


def require_within_duration(start_ms: int, end_ms: int, duration_ms: int, label: str) -> None:
    if start_ms < 0 or end_ms > duration_ms:
        raise ValueError(f"{label} falls outside the media duration")


def assert_non_overlapping(spans: list[tuple[int, int, str]], label: str) -> None:
    ordered = sorted(spans, key=lambda item: (item[0], item[1], item[2]))
    previous_end: int | None = None
    previous_id: str | None = None
    for start, end, item_id in ordered:
        if previous_end is not None and start < previous_end:
            raise ValueError(f"{label} overlap between {previous_id} and {item_id}")
        previous_end = end
        previous_id = item_id


def reject_unknown_fields(mapping: Mapping[str, Any], allowed: frozenset[str]) -> None:
    unknown = sorted(set(mapping) - allowed)
    if unknown:
        raise ValueError(f"unknown fields {unknown}")


def reject_forbidden_fields(mapping: Mapping[str, Any], forbidden: frozenset[str]) -> None:
    present = sorted(set(mapping) & forbidden)
    if present:
        raise ValueError(f"forbidden fields {present}")


def reject_raw_bytes(value: Any, path: str = "$") -> None:
    if isinstance(value, (bytes, bytearray, memoryview)):
        raise ValueError(f"raw bytes are not retained at {path}")
    if isinstance(value, Mapping):
        for key, item in value.items():
            reject_raw_bytes(item, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            reject_raw_bytes(item, f"{path}[{index}]")


def require_mapping_fields(
    mapping: Mapping[str, Any],
    *,
    allowed: frozenset[str],
    required: frozenset[str],
    forbidden: frozenset[str] = frozenset(),
) -> None:
    if not isinstance(mapping, Mapping):
        raise ValueError("expected an object")
    reject_raw_bytes(mapping)
    reject_unknown_fields(mapping, allowed)
    reject_forbidden_fields(mapping, forbidden)
    missing = sorted(required - set(mapping))
    if missing:
        raise ValueError(f"missing fields {missing}")


__all__ = [
    "IDENTITY_KEYS",
    "RAW_AUDIO_KEYS",
    "RAW_VIDEO_KEYS",
    "SCORE_KEYS",
    "assert_non_overlapping",
    "reject_forbidden_fields",
    "reject_raw_bytes",
    "reject_unknown_fields",
    "require_digest",
    "require_id",
    "require_language_tag",
    "require_mapping_fields",
    "require_non_negative_int",
    "require_positive_int",
    "require_span",
    "require_speaker_slot",
    "require_within_duration",
]
