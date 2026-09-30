"""Media execution results. A decoded container is not a transcript."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MediaExecutionResult:
    """Immutable outcome. transcript/srt/vtt stay None until a real model exists."""

    status: str
    primary_reason: str
    reason_codes: tuple[str, ...]
    declared_mime: str
    decoded_format: str | None
    duration_sec: float | None
    audio_present: bool | None
    transcript: None
    segments: tuple[()]
    srt: None
    vtt: None
    raw_media_retained: bool
    speaker_identity_enabled: bool
    network_used: bool
    telemetry_used: bool
    implemented_decode_formats: tuple[str, ...]
    backend_disclosure: str
    missing_dependencies: tuple[str, ...]
