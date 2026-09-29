"""Audio input envelope, transcript IR, and speaker-neutral custody.

Spoken words stay in the transcript. Speaker identity, voiceprints, and raw
audio bytes do not. Custody does not decide who was speaking.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping, Sequence

from spe_runtime.media._validate import (
    IDENTITY_KEYS,
    RAW_AUDIO_KEYS,
    SCORE_KEYS,
    require_digest,
    require_id,
    require_language_tag,
    require_mapping_fields,
    require_non_negative_int,
    require_positive_int,
    require_span,
    require_speaker_slot,
)
from spe_runtime.media.privacy import (
    NetworkAuthorityPolicy,
    RawAudioRetentionPolicy,
    coerce_audio_retention,
    coerce_network_authority,
)


class LanguageBasis(str, Enum):
    DECLARED = "DECLARED"
    UNSPECIFIED = "UNSPECIFIED"


class ObservationStatus(str, Enum):
    """Declared observation. This foundation cannot upgrade it."""

    UNVERIFIED = "UNVERIFIED"


class CustodyMode(str, Enum):
    SPEAKER_NEUTRAL = "SPEAKER_NEUTRAL"


def _as_language_basis(value: LanguageBasis | str) -> LanguageBasis:
    if isinstance(value, LanguageBasis):
        return value
    return LanguageBasis(str(value))


def _as_observation_status(value: ObservationStatus | str) -> ObservationStatus:
    if isinstance(value, ObservationStatus):
        status = value
    else:
        status = ObservationStatus(str(value))
    if status is not ObservationStatus.UNVERIFIED:
        raise ValueError("observation_status is UNVERIFIED")
    return status


@dataclass(frozen=True)
class LanguageMetadata:
    """Language tag plus how it was obtained. Not a confidence score."""

    language_tag: str
    language_basis: LanguageBasis

    def __post_init__(self) -> None:
        tag = require_language_tag(self.language_tag)
        basis = _as_language_basis(self.language_basis)
        if tag == "und" and basis is not LanguageBasis.UNSPECIFIED:
            raise ValueError("language tag 'und' requires language_basis UNSPECIFIED")
        if basis is LanguageBasis.UNSPECIFIED and tag != "und":
            raise ValueError("UNSPECIFIED language_basis requires language_tag 'und'")
        object.__setattr__(self, "language_tag", tag)
        object.__setattr__(self, "language_basis", basis)

    def to_dict(self) -> dict[str, str]:
        return {
            "language_basis": self.language_basis.value,
            "language_tag": self.language_tag,
        }


@dataclass(frozen=True)
class SpeakerNeutralCustody:
    """Transcript custody that keeps no speaker identity."""

    custody_mode: CustodyMode = CustodyMode.SPEAKER_NEUTRAL
    identity_retained: bool = False

    def __post_init__(self) -> None:
        mode = (
            self.custody_mode
            if isinstance(self.custody_mode, CustodyMode)
            else CustodyMode(str(self.custody_mode))
        )
        if mode is not CustodyMode.SPEAKER_NEUTRAL:
            raise ValueError("transcript custody is SPEAKER_NEUTRAL")
        if bool(self.identity_retained):
            raise ValueError("speaker-neutral custody does not retain identity")
        object.__setattr__(self, "custody_mode", mode)
        object.__setattr__(self, "identity_retained", False)

    def to_dict(self) -> dict[str, object]:
        return {
            "custody_mode": self.custody_mode.value,
            "identity_retained": self.identity_retained,
        }


@dataclass(frozen=True)
class TranscriptSegment:
    """Timed words. speaker_slot is an anonymous label, not a person."""

    segment_id: str
    start_ms: int
    end_ms: int
    text: str
    speaker_slot: str | None = None
    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED

    def __post_init__(self) -> None:
        segment_id = require_id(self.segment_id, "segment_id")
        start_ms, end_ms = require_span(self.start_ms, self.end_ms)
        text = str(self.text)
        if not text.strip():
            raise ValueError("transcript text must be non-empty")
        object.__setattr__(self, "segment_id", segment_id)
        object.__setattr__(self, "start_ms", start_ms)
        object.__setattr__(self, "end_ms", end_ms)
        object.__setattr__(self, "text", text)
        object.__setattr__(self, "speaker_slot", require_speaker_slot(self.speaker_slot))
        object.__setattr__(
            self, "observation_status", _as_observation_status(self.observation_status)
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "end_ms": self.end_ms,
            "observation_status": self.observation_status.value,
            "segment_id": self.segment_id,
            "speaker_slot": self.speaker_slot,
            "start_ms": self.start_ms,
            "text": self.text,
        }


@dataclass(frozen=True)
class AudioInputEnvelope:
    """Custody envelope for an audio input. Raw samples are not stored."""

    envelope_id: str
    content_digest: str
    duration_ms: int
    media_type: str
    raw_audio_retention: RawAudioRetentionPolicy = field(
        default_factory=RawAudioRetentionPolicy
    )
    network_authority: NetworkAuthorityPolicy = field(
        default_factory=NetworkAuthorityPolicy
    )
    sample_rate_hz: int | None = None
    channel_count: int | None = None
    declared_byte_length: int | None = None

    def __post_init__(self) -> None:
        envelope_id = require_id(self.envelope_id, "envelope_id")
        content_digest = require_digest(self.content_digest, "content_digest")
        duration_ms = require_non_negative_int(self.duration_ms, "duration_ms")
        media_type = str(self.media_type).strip()
        if not media_type.startswith("audio/") or len(media_type) <= len("audio/"):
            raise ValueError("media_type must be an audio type")
        sample_rate_hz = self.sample_rate_hz
        if sample_rate_hz is not None:
            sample_rate_hz = require_positive_int(sample_rate_hz, "sample_rate_hz")
        channel_count = self.channel_count
        if channel_count is not None:
            channel_count = require_positive_int(channel_count, "channel_count")
        declared_byte_length = self.declared_byte_length
        if declared_byte_length is not None:
            declared_byte_length = require_non_negative_int(
                declared_byte_length, "declared_byte_length"
            )
        object.__setattr__(self, "envelope_id", envelope_id)
        object.__setattr__(self, "content_digest", content_digest)
        object.__setattr__(self, "duration_ms", duration_ms)
        object.__setattr__(self, "media_type", media_type)
        object.__setattr__(
            self, "raw_audio_retention", coerce_audio_retention(self.raw_audio_retention)
        )
        object.__setattr__(
            self, "network_authority", coerce_network_authority(self.network_authority)
        )
        object.__setattr__(self, "sample_rate_hz", sample_rate_hz)
        object.__setattr__(self, "channel_count", channel_count)
        object.__setattr__(self, "declared_byte_length", declared_byte_length)

    def to_dict(self) -> dict[str, object]:
        return {
            "channel_count": self.channel_count,
            "content_digest": self.content_digest,
            "declared_byte_length": self.declared_byte_length,
            "duration_ms": self.duration_ms,
            "envelope_id": self.envelope_id,
            "media_type": self.media_type,
            "network_authority": self.network_authority.to_dict(),
            "raw_audio_retention": self.raw_audio_retention.to_dict(),
            "sample_rate_hz": self.sample_rate_hz,
        }


@dataclass(frozen=True)
class TranscriptIR:
    """Timestamped transcript held under speaker-neutral custody."""

    transcript_id: str
    audio_envelope_id: str
    language: LanguageMetadata
    segments: tuple[TranscriptSegment, ...]
    custody: SpeakerNeutralCustody = field(default_factory=SpeakerNeutralCustody)
    raw_audio_retention: RawAudioRetentionPolicy = field(
        default_factory=RawAudioRetentionPolicy
    )
    network_authority: NetworkAuthorityPolicy = field(
        default_factory=NetworkAuthorityPolicy
    )

    def __post_init__(self) -> None:
        transcript_id = require_id(self.transcript_id, "transcript_id")
        audio_envelope_id = require_id(self.audio_envelope_id, "audio_envelope_id")
        if not isinstance(self.language, LanguageMetadata):
            raise ValueError("language must be LanguageMetadata")
        segments = tuple(self.segments)
        seen: set[str] = set()
        for segment in segments:
            if not isinstance(segment, TranscriptSegment):
                raise ValueError("segments must be TranscriptSegment values")
            if segment.segment_id in seen:
                raise ValueError(f"duplicate segment_id {segment.segment_id}")
            seen.add(segment.segment_id)
        ordered = tuple(sorted(segments, key=lambda item: (item.start_ms, item.end_ms, item.segment_id)))
        if not isinstance(self.custody, SpeakerNeutralCustody):
            raise ValueError("custody must be SpeakerNeutralCustody")
        custody = self.custody
        object.__setattr__(self, "transcript_id", transcript_id)
        object.__setattr__(self, "audio_envelope_id", audio_envelope_id)
        object.__setattr__(self, "segments", ordered)
        object.__setattr__(self, "custody", custody)
        object.__setattr__(
            self, "raw_audio_retention", coerce_audio_retention(self.raw_audio_retention)
        )
        object.__setattr__(
            self, "network_authority", coerce_network_authority(self.network_authority)
        )

    def to_dict(self) -> dict[str, object]:
        return {
            "audio_envelope_id": self.audio_envelope_id,
            "custody": self.custody.to_dict(),
            "language": self.language.to_dict(),
            "network_authority": self.network_authority.to_dict(),
            "raw_audio_retention": self.raw_audio_retention.to_dict(),
            "segments": [segment.to_dict() for segment in self.segments],
            "transcript_id": self.transcript_id,
        }


def hold_speaker_neutral_transcript(
    *,
    transcript_id: str,
    audio_envelope_id: str,
    language: LanguageMetadata,
    segments: Sequence[TranscriptSegment],
) -> TranscriptIR:
    """Hold a transcript in speaker-neutral custody.

    Spoken text is kept. Identity fields are not accepted by the segment type.
    """
    return TranscriptIR(
        transcript_id=transcript_id,
        audio_envelope_id=audio_envelope_id,
        language=language,
        segments=tuple(segments),
        custody=SpeakerNeutralCustody(),
    )


_AUDIO_FIELDS = frozenset(
    {
        "channel_count",
        "content_digest",
        "declared_byte_length",
        "duration_ms",
        "envelope_id",
        "media_type",
        "network_authority",
        "raw_audio_retention",
        "sample_rate_hz",
    }
)
_SEGMENT_FIELDS = frozenset(
    {
        "end_ms",
        "observation_status",
        "segment_id",
        "speaker_slot",
        "start_ms",
        "text",
    }
)


def audio_envelope_from_mapping(mapping: Mapping[str, Any]) -> AudioInputEnvelope:
    require_mapping_fields(
        mapping,
        allowed=_AUDIO_FIELDS,
        required=frozenset({"content_digest", "duration_ms", "envelope_id", "media_type"}),
        forbidden=RAW_AUDIO_KEYS | IDENTITY_KEYS | SCORE_KEYS,
    )
    return AudioInputEnvelope(
        envelope_id=mapping["envelope_id"],
        content_digest=mapping["content_digest"],
        duration_ms=mapping["duration_ms"],
        media_type=mapping["media_type"],
        raw_audio_retention=mapping.get("raw_audio_retention", RawAudioRetentionPolicy()),
        network_authority=mapping.get("network_authority", NetworkAuthorityPolicy()),
        sample_rate_hz=mapping.get("sample_rate_hz"),
        channel_count=mapping.get("channel_count"),
        declared_byte_length=mapping.get("declared_byte_length"),
    )


def transcript_segment_from_mapping(mapping: Mapping[str, Any]) -> TranscriptSegment:
    require_mapping_fields(
        mapping,
        allowed=_SEGMENT_FIELDS,
        required=frozenset({"end_ms", "segment_id", "start_ms", "text"}),
        forbidden=IDENTITY_KEYS | SCORE_KEYS | RAW_AUDIO_KEYS,
    )
    return TranscriptSegment(
        segment_id=mapping["segment_id"],
        start_ms=mapping["start_ms"],
        end_ms=mapping["end_ms"],
        text=mapping["text"],
        speaker_slot=mapping.get("speaker_slot"),
        observation_status=mapping.get("observation_status", ObservationStatus.UNVERIFIED),
    )


__all__ = [
    "AudioInputEnvelope",
    "CustodyMode",
    "LanguageBasis",
    "LanguageMetadata",
    "ObservationStatus",
    "SpeakerNeutralCustody",
    "TranscriptIR",
    "TranscriptSegment",
    "audio_envelope_from_mapping",
    "hold_speaker_neutral_transcript",
    "transcript_segment_from_mapping",
]
