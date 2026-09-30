"""G12 media execution — real WAV decode, no simulated transcription.

Transcription stays HOLD until a local model and runtime exist in repository
custody. Subtitle renderers format caller-supplied cues only; execute() never
emits them.
"""

from __future__ import annotations

import io
import math
import socket
import struct
import wave

import pytest

from spe_runtime.media_execution import (
    MediaExecutionResult,
    execute_media,
    render_srt,
    render_vtt,
)
from spe_runtime.media_execution.subtitles import Cue


def _wav_bytes(*, frames: int = 1600, rate: int = 8000, tone: bool = False) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        if frames <= 0:
            handle.writeframes(b"")
        elif tone:
            pcm = b"".join(
                struct.pack("<h", int(8000 * math.sin(2 * math.pi * 440 * i / rate)))
                for i in range(frames)
            )
            handle.writeframes(pcm)
        else:
            handle.writeframes(b"\x00\x00" * frames)
    return buf.getvalue()


def _mp4_signature() -> bytes:
    # ISO BMFF file-type box. Signature only — not a playable file.
    body = b"isom" + b"\x00" * 8
    return (8 + len(body)).to_bytes(4, "big") + b"ftyp" + body


def test_valid_wav_decodes_duration_and_holds_transcription():
    payload = _wav_bytes(frames=8000, rate=8000, tone=True)
    result = execute_media(media_bytes=payload, declared_mime="audio/wav")
    assert isinstance(result, MediaExecutionResult)
    assert result.status == "HOLD"
    assert result.primary_reason == "HOLD_TRANSCRIPTION_BACKEND_MISSING"
    assert result.decoded_format == "audio/wav"
    assert result.duration_sec == pytest.approx(1.0)
    assert result.transcript is None
    assert result.segments == ()
    assert result.srt is None
    assert result.vtt is None
    assert result.raw_media_retained is False
    assert result.network_used is False
    assert result.telemetry_used is False
    assert result.speaker_identity_enabled is False
    assert "audio/wav" in result.implemented_decode_formats
    assert "video/mp4" not in result.implemented_decode_formats
    assert "media_bytes" not in result.__dataclass_fields__
    assert payload.hex() not in repr(result)


def test_valid_video_signature_is_not_decoded():
    result = execute_media(media_bytes=_mp4_signature(), declared_mime="video/mp4")
    assert result.status == "HOLD"
    assert result.primary_reason == "HOLD_VIDEO_DECODER_NOT_IN_CUSTODY"
    assert result.decoded_format is None
    assert result.transcript is None
    assert result.audio_present is None
    assert result.duration_sec is None
    assert "ffmpeg" in result.backend_disclosure.lower()


def test_no_audio_video_does_not_claim_silence():
    # EBML header marks a WebM container. Track layout is unknown without a demuxer.
    result = execute_media(
        media_bytes=b"\x1a\x45\xdf\xa3" + b"\x00" * 16,
        declared_mime="video/webm",
    )
    assert result.status == "HOLD"
    assert result.primary_reason == "HOLD_VIDEO_DECODER_NOT_IN_CUSTODY"
    assert result.audio_present is None
    assert result.transcript is None
    assert result.segments == ()


def test_corrupt_wav_rejected():
    result = execute_media(media_bytes=b"not-a-wav", declared_mime="audio/wav")
    assert result.status == "REJECTED"
    assert result.primary_reason == "CORRUPT_MEDIA"
    assert result.transcript is None
    assert result.decoded_format is None
    assert result.raw_media_retained is False


def test_corrupt_video_rejected():
    result = execute_media(media_bytes=b"\x00\x01garbage", declared_mime="video/mp4")
    assert result.status == "REJECTED"
    assert result.primary_reason == "CORRUPT_MEDIA"
    assert result.audio_present is None


def test_oversize_rejected_before_decode():
    payload = _wav_bytes()
    result = execute_media(
        media_bytes=payload,
        declared_mime="audio/wav",
        max_bytes=len(payload) - 1,
    )
    assert result.status == "REJECTED"
    assert result.primary_reason == "OVERSIZE"
    assert result.decoded_format is None
    assert result.duration_sec is None


def test_timestamp_ordering_rejects_inverted_cues():
    cues = (
        Cue(start_ms=1500, end_ms=2000, text="later"),
        Cue(start_ms=100, end_ms=400, text="earlier"),
    )
    with pytest.raises(ValueError, match="timestamp order"):
        render_srt(cues)


def test_silence_wav_is_not_an_empty_speech_success():
    result = execute_media(
        media_bytes=_wav_bytes(frames=800, rate=8000, tone=False),
        declared_mime="audio/wav",
    )
    assert result.status == "HOLD"
    assert result.primary_reason == "HOLD_TRANSCRIPTION_BACKEND_MISSING"
    assert result.transcript is None
    assert result.segments == ()
    assert result.decoded_format == "audio/wav"
    assert result.duration_sec == pytest.approx(0.1)


def test_zero_frame_wav_holds_without_empty_transcript():
    result = execute_media(
        media_bytes=_wav_bytes(frames=0),
        declared_mime="audio/wav",
    )
    assert result.status == "HOLD"
    assert result.transcript is None
    assert result.duration_sec == pytest.approx(0.0)
    assert result.audio_present is False


def test_formatter_multiple_segments_and_unicode():
    cues = (
        Cue(start_ms=0, end_ms=1000, text="hello"),
        Cue(start_ms=1000, end_ms=2500, text="こんにちは — café"),
    )
    srt = render_srt(cues)
    vtt = render_vtt(cues)
    assert srt.count("\n\n") >= 1
    assert "こんにちは — café" in srt
    assert "こんにちは — café" in vtt
    assert "00:00:00,000 --> 00:00:01,000" in srt
    assert "00:00:01.000 --> 00:00:02.500" in vtt
    assert vtt.startswith("WEBVTT\n")


def test_execute_never_emits_srt_or_vtt():
    result = execute_media(
        media_bytes=_wav_bytes(tone=True),
        declared_mime="audio/x-wav",
    )
    assert result.srt is None
    assert result.vtt is None
    assert result.segments == ()


def test_retention_defaults_false_and_bytes_are_not_stored():
    payload = _wav_bytes(tone=True)
    result = execute_media(media_bytes=payload, declared_mime="audio/wav")
    assert result.raw_media_retained is False
    assert not hasattr(result, "media_bytes")
    assert result.speaker_identity_enabled is False


def test_speaker_identity_request_does_not_enable_identity():
    result = execute_media(
        media_bytes=_wav_bytes(),
        declared_mime="audio/wav",
        speaker_identity_authorized=True,
    )
    assert result.speaker_identity_enabled is False
    assert "SPEAKER_IDENTITY_OFF" in result.reason_codes
    assert result.transcript is None


def test_malformed_retention_request():
    payload = _wav_bytes()
    retained = execute_media(
        media_bytes=payload,
        declared_mime="audio/wav",
        retain_raw=True,
    )
    assert retained.status == "REJECTED"
    assert retained.primary_reason == "MALFORMED_RETENTION"
    assert retained.raw_media_retained is False
    assert retained.decoded_format is None

    typed = execute_media(
        media_bytes=payload,
        declared_mime="audio/wav",
        retain_raw="yes",  # type: ignore[arg-type]
    )
    assert typed.status == "REJECTED"
    assert typed.primary_reason == "MALFORMED_RETENTION"
    assert typed.raw_media_retained is False


def test_backend_unavailable_names_missing_runtime():
    result = execute_media(media_bytes=_wav_bytes(tone=True), declared_mime="audio/wav")
    missing = " ".join(result.missing_dependencies).lower()
    assert result.primary_reason == "HOLD_TRANSCRIPTION_BACKEND_MISSING"
    assert "whisper" in missing or "transcription-runtime" in missing
    assert "transcription-model" in missing
    assert "not repository custody" in result.backend_disclosure.lower() or (
        "not in repository custody" in result.backend_disclosure.lower()
    )
    assert result.network_used is False


def test_network_is_not_used_when_connect_is_blocked(monkeypatch: pytest.MonkeyPatch):
    def _blocked(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("media execution opened a network connection")

    monkeypatch.setattr(socket, "create_connection", _blocked)
    monkeypatch.setattr(socket, "socket", _blocked)
    result = execute_media(media_bytes=_wav_bytes(), declared_mime="audio/wav")
    assert result.network_used is False
    assert result.telemetry_used is False
    assert result.status == "HOLD"


def test_unsupported_mime_is_not_a_universal_decoder():
    result = execute_media(media_bytes=b"ID3" + b"\x00" * 8, declared_mime="audio/mpeg")
    assert result.status == "REJECTED"
    assert result.primary_reason == "UNSUPPORTED_FORMAT"
    assert result.implemented_decode_formats == ("audio/wav",)
    assert "audio/mpeg" not in result.implemented_decode_formats
