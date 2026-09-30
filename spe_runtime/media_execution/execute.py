"""Local media execution gate.

Decodes PCM WAV with the Python stdlib. Does not transcribe, retain raw
media, identify speakers, open the network, or call host ffmpeg.
"""

from __future__ import annotations

import io
import wave

from spe_runtime.media_execution.models import MediaExecutionResult

DEFAULT_MAX_BYTES = 8 * 1024 * 1024
IMPLEMENTED_DECODE_FORMATS = ("audio/wav",)
_WAV_MIMES = frozenset({"audio/wav", "audio/x-wav", "audio/wave"})
_VIDEO_MIMES = frozenset({"video/mp4", "video/webm", "video/quicktime"})

BACKEND_DISCLOSURE = (
    "Local fail-closed media gate. The only implemented decode format is "
    "audio/wav PCM, read with the declared Python stdlib wave module. "
    "No transcription model is in repository custody, and the transcription "
    "runtime is not a project dependency. Host ffmpeg is not in repository "
    "custody and is not invoked. Raw media retention is off. Speaker identity "
    "is off. This gate makes no network call and emits no telemetry. SRT and "
    "VTT renderers format caller-supplied cues; they are not transcription output."
)

MISSING_DEPENDENCIES = (
    "transcription-model: none vendored in the repository",
    "transcription-runtime: whisper, faster-whisper, and vosk are absent from pyproject.toml",
    "video-decoder: no project dependency; host ffmpeg is not in repository custody",
    "speaker-diarization: not in repository custody",
)


def execute_media(
    *,
    media_bytes: bytes,
    declared_mime: str,
    retain_raw: bool = False,
    speaker_identity_authorized: bool = False,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> MediaExecutionResult:
    """Validate one envelope and stop before speech recognition."""
    mime = declared_mime.strip().lower() if isinstance(declared_mime, str) else ""
    if not isinstance(retain_raw, bool) or retain_raw:
        return _rejected(mime, "MALFORMED_RETENTION")
    if not isinstance(speaker_identity_authorized, bool):
        return _rejected(mime, "MALFORMED_SPEAKER_REQUEST")
    if not isinstance(media_bytes, (bytes, bytearray)) or not isinstance(max_bytes, int):
        return _rejected(mime, "CORRUPT_MEDIA")
    if max_bytes < 1 or len(media_bytes) > max_bytes:
        return _rejected(mime, "OVERSIZE")

    payload = bytes(media_bytes)
    identity_codes = ("SPEAKER_IDENTITY_OFF",) if speaker_identity_authorized else ()

    if mime in _WAV_MIMES:
        return _decode_wav(mime, payload, identity_codes)
    if mime in _VIDEO_MIMES:
        return _hold_video(mime, payload, identity_codes)
    return _rejected(mime, "UNSUPPORTED_FORMAT")


def _decode_wav(
    mime: str,
    payload: bytes,
    identity_codes: tuple[str, ...],
) -> MediaExecutionResult:
    try:
        with wave.open(io.BytesIO(payload), "rb") as handle:
            frames = handle.getnframes()
            rate = handle.getframerate()
            if rate <= 0 or frames < 0:
                return _rejected(mime, "CORRUPT_MEDIA")
            duration = frames / float(rate)
    except (wave.Error, EOFError, OSError):
        return _rejected(mime, "CORRUPT_MEDIA")
    return _hold(
        mime,
        "HOLD_TRANSCRIPTION_BACKEND_MISSING",
        identity_codes,
        decoded_format="audio/wav",
        duration_sec=duration,
        audio_present=frames > 0,
    )


def _hold_video(
    mime: str,
    payload: bytes,
    identity_codes: tuple[str, ...],
) -> MediaExecutionResult:
    if not _has_container_signature(payload):
        return _rejected(mime, "CORRUPT_MEDIA")
    return _hold(
        mime,
        "HOLD_VIDEO_DECODER_NOT_IN_CUSTODY",
        identity_codes,
        decoded_format=None,
        duration_sec=None,
        audio_present=None,
    )


def _has_container_signature(payload: bytes) -> bool:
    if len(payload) >= 8 and payload[4:8] == b"ftyp":
        return True
    return payload.startswith(b"\x1a\x45\xdf\xa3")


def _hold(
    mime: str,
    primary: str,
    identity_codes: tuple[str, ...],
    *,
    decoded_format: str | None,
    duration_sec: float | None,
    audio_present: bool | None,
) -> MediaExecutionResult:
    return _result(
        mime,
        "HOLD",
        primary,
        identity_codes,
        decoded_format=decoded_format,
        duration_sec=duration_sec,
        audio_present=audio_present,
    )


def _rejected(mime: str, primary: str) -> MediaExecutionResult:
    return _result(
        mime,
        "REJECTED",
        primary,
        (),
        decoded_format=None,
        duration_sec=None,
        audio_present=None,
    )


def _result(
    mime: str,
    status: str,
    primary: str,
    identity_codes: tuple[str, ...],
    *,
    decoded_format: str | None,
    duration_sec: float | None,
    audio_present: bool | None,
) -> MediaExecutionResult:
    return MediaExecutionResult(
        status=status,
        primary_reason=primary,
        reason_codes=(primary, *identity_codes),
        declared_mime=mime,
        decoded_format=decoded_format,
        duration_sec=duration_sec,
        audio_present=audio_present,
        transcript=None,
        segments=(),
        srt=None,
        vtt=None,
        raw_media_retained=False,
        speaker_identity_enabled=False,
        network_used=False,
        telemetry_used=False,
        implemented_decode_formats=IMPLEMENTED_DECODE_FORMATS,
        backend_disclosure=BACKEND_DISCLOSURE,
        missing_dependencies=MISSING_DEPENDENCIES,
    )
