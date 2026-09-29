"""Video input envelope, scene segmentation, keyframes, alignment, events.

Times and digests are declared observations. They are not visual claims and
they do not retain raw frames unless the video retention policy already allows
the policy flag. Frame bytes are still absent from this IR.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Mapping

from spe_runtime.media._validate import (
    IDENTITY_KEYS,
    RAW_VIDEO_KEYS,
    SCORE_KEYS,
    require_digest,
    require_id,
    require_mapping_fields,
    require_non_negative_int,
    require_positive_int,
    require_span,
)
from spe_runtime.media.audio import ObservationStatus
from spe_runtime.media.privacy import (
    NetworkAuthorityPolicy,
    RawVideoRetentionPolicy,
    coerce_network_authority,
    coerce_video_retention,
)


class BoundaryBasis(str, Enum):
    TIME_DECLARED = "TIME_DECLARED"


class KeyframeRole(str, Enum):
    DECLARED = "DECLARED"


class AlignmentBasis(str, Enum):
    TIME_DECLARED = "TIME_DECLARED"


class TemporalEventKind(str, Enum):
    SPEECH_SPAN = "SPEECH_SPAN"
    SCENE_SPAN = "SCENE_SPAN"
    KEYFRAME_MARK = "KEYFRAME_MARK"
    SILENCE = "SILENCE"
    DECLARED = "DECLARED"


def _as_observation(value: ObservationStatus | str) -> ObservationStatus:
    status = value if isinstance(value, ObservationStatus) else ObservationStatus(str(value))
    if status is not ObservationStatus.UNVERIFIED:
        raise ValueError("observation_status is UNVERIFIED")
    return status


def _enum_value(value: Enum | str, enum_type: type[Enum], field_name: str) -> Enum:
    if isinstance(value, enum_type):
        return value
    try:
        return enum_type(str(value))
    except ValueError as exc:
        raise ValueError(f"{field_name} is not a {enum_type.__name__}") from exc


@dataclass(frozen=True)
class VideoInputEnvelope:
    """Custody envelope for a video input. Raw frames are not stored here."""

    envelope_id: str
    content_digest: str
    duration_ms: int
    media_type: str
    raw_video_retention: RawVideoRetentionPolicy = field(
        default_factory=RawVideoRetentionPolicy
    )
    network_authority: NetworkAuthorityPolicy = field(
        default_factory=NetworkAuthorityPolicy
    )
    width_px: int | None = None
    height_px: int | None = None
    declared_byte_length: int | None = None

    def __post_init__(self) -> None:
        media_type = str(self.media_type).strip()
        if not media_type.startswith("video/") or len(media_type) <= len("video/"):
            raise ValueError("media_type must be a video type")
        width_px = self.width_px
        height_px = self.height_px
        if width_px is not None:
            width_px = require_positive_int(width_px, "width_px")
        if height_px is not None:
            height_px = require_positive_int(height_px, "height_px")
        declared_byte_length = self.declared_byte_length
        if declared_byte_length is not None:
            declared_byte_length = require_non_negative_int(
                declared_byte_length, "declared_byte_length"
            )
        object.__setattr__(self, "envelope_id", require_id(self.envelope_id, "envelope_id"))
        object.__setattr__(
            self, "content_digest", require_digest(self.content_digest, "content_digest")
        )
        object.__setattr__(
            self, "duration_ms", require_non_negative_int(self.duration_ms, "duration_ms")
        )
        object.__setattr__(self, "media_type", media_type)
        object.__setattr__(
            self, "raw_video_retention", coerce_video_retention(self.raw_video_retention)
        )
        object.__setattr__(
            self, "network_authority", coerce_network_authority(self.network_authority)
        )
        object.__setattr__(self, "width_px", width_px)
        object.__setattr__(self, "height_px", height_px)
        object.__setattr__(self, "declared_byte_length", declared_byte_length)

    def to_dict(self) -> dict[str, object]:
        policy = self.raw_video_retention.to_dict()
        return {
            "content_digest": self.content_digest,
            "declared_byte_length": self.declared_byte_length,
            "duration_ms": self.duration_ms,
            "envelope_id": self.envelope_id,
            "height_px": self.height_px,
            "media_type": self.media_type,
            "network_authority": self.network_authority.to_dict(),
            "raw_video_retention": policy["retention"],
            "raw_video_retention_explicitly_needed": policy["explicitly_needed"],
            "width_px": self.width_px,
        }


@dataclass(frozen=True)
class SceneSegment:
    """A time span. boundary_basis records a declared cut, not a meaning."""

    scene_id: str
    start_ms: int
    end_ms: int
    ordinal: int
    boundary_basis: BoundaryBasis = BoundaryBasis.TIME_DECLARED
    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED

    def __post_init__(self) -> None:
        start_ms, end_ms = require_span(self.start_ms, self.end_ms)
        ordinal = self.ordinal
        if isinstance(ordinal, bool) or not isinstance(ordinal, int) or ordinal < 0:
            raise ValueError("ordinal must be an integer >= 0")
        basis = _enum_value(self.boundary_basis, BoundaryBasis, "boundary_basis")
        if basis is not BoundaryBasis.TIME_DECLARED:
            raise ValueError("boundary_basis is TIME_DECLARED")
        object.__setattr__(self, "scene_id", require_id(self.scene_id, "scene_id"))
        object.__setattr__(self, "start_ms", start_ms)
        object.__setattr__(self, "end_ms", end_ms)
        object.__setattr__(self, "ordinal", ordinal)
        object.__setattr__(self, "boundary_basis", basis)
        object.__setattr__(self, "observation_status", _as_observation(self.observation_status))

    def to_dict(self) -> dict[str, object]:
        return {
            "boundary_basis": self.boundary_basis.value,
            "end_ms": self.end_ms,
            "observation_status": self.observation_status.value,
            "ordinal": self.ordinal,
            "scene_id": self.scene_id,
            "start_ms": self.start_ms,
        }


@dataclass(frozen=True)
class SceneSegmentationIR:
    segmentation_id: str
    video_envelope_id: str
    scenes: tuple[SceneSegment, ...]

    def __post_init__(self) -> None:
        scenes = tuple(self.scenes)
        seen: set[str] = set()
        for scene in scenes:
            if not isinstance(scene, SceneSegment):
                raise ValueError("scenes must be SceneSegment values")
            if scene.scene_id in seen:
                raise ValueError(f"duplicate scene_id {scene.scene_id}")
            seen.add(scene.scene_id)
        ordered = tuple(sorted(scenes, key=lambda item: (item.start_ms, item.end_ms, item.scene_id)))
        object.__setattr__(
            self, "segmentation_id", require_id(self.segmentation_id, "segmentation_id")
        )
        object.__setattr__(
            self, "video_envelope_id", require_id(self.video_envelope_id, "video_envelope_id")
        )
        object.__setattr__(self, "scenes", ordered)

    def to_dict(self) -> dict[str, object]:
        return {
            "scenes": [scene.to_dict() for scene in self.scenes],
            "segmentation_id": self.segmentation_id,
            "video_envelope_id": self.video_envelope_id,
        }


@dataclass(frozen=True)
class Keyframe:
    """A timestamped frame digest. Pixel bytes are not part of the IR."""

    keyframe_id: str
    timestamp_ms: int
    content_digest: str
    scene_id: str | None = None
    role: KeyframeRole = KeyframeRole.DECLARED
    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED
    raw_frame_bytes_included: bool = False

    def __post_init__(self) -> None:
        if bool(self.raw_frame_bytes_included):
            raise ValueError("keyframe IR does not include raw frame bytes")
        role = _enum_value(self.role, KeyframeRole, "role")
        if role is not KeyframeRole.DECLARED:
            raise ValueError("keyframe role is DECLARED")
        scene_id = None if self.scene_id is None else require_id(self.scene_id, "scene_id")
        object.__setattr__(self, "keyframe_id", require_id(self.keyframe_id, "keyframe_id"))
        object.__setattr__(
            self, "timestamp_ms", require_non_negative_int(self.timestamp_ms, "timestamp_ms")
        )
        object.__setattr__(
            self, "content_digest", require_digest(self.content_digest, "content_digest")
        )
        object.__setattr__(self, "scene_id", scene_id)
        object.__setattr__(self, "role", role)
        object.__setattr__(self, "observation_status", _as_observation(self.observation_status))
        object.__setattr__(self, "raw_frame_bytes_included", False)

    def to_dict(self) -> dict[str, object]:
        return {
            "content_digest": self.content_digest,
            "keyframe_id": self.keyframe_id,
            "observation_status": self.observation_status.value,
            "raw_frame_bytes_included": self.raw_frame_bytes_included,
            "role": self.role.value,
            "scene_id": self.scene_id,
            "timestamp_ms": self.timestamp_ms,
        }


@dataclass(frozen=True)
class AlignmentLink:
    link_id: str
    transcript_segment_id: str
    video_start_ms: int
    video_end_ms: int
    scene_id: str | None = None
    keyframe_id: str | None = None
    basis: AlignmentBasis = AlignmentBasis.TIME_DECLARED
    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED

    def __post_init__(self) -> None:
        start_ms, end_ms = require_span(self.video_start_ms, self.video_end_ms)
        basis = _enum_value(self.basis, AlignmentBasis, "basis")
        if basis is not AlignmentBasis.TIME_DECLARED:
            raise ValueError("alignment basis is TIME_DECLARED")
        object.__setattr__(self, "link_id", require_id(self.link_id, "link_id"))
        object.__setattr__(
            self,
            "transcript_segment_id",
            require_id(self.transcript_segment_id, "transcript_segment_id"),
        )
        object.__setattr__(self, "video_start_ms", start_ms)
        object.__setattr__(self, "video_end_ms", end_ms)
        object.__setattr__(
            self,
            "scene_id",
            None if self.scene_id is None else require_id(self.scene_id, "scene_id"),
        )
        object.__setattr__(
            self,
            "keyframe_id",
            None if self.keyframe_id is None else require_id(self.keyframe_id, "keyframe_id"),
        )
        object.__setattr__(self, "basis", basis)
        object.__setattr__(self, "observation_status", _as_observation(self.observation_status))

    def to_dict(self) -> dict[str, object]:
        return {
            "basis": self.basis.value,
            "keyframe_id": self.keyframe_id,
            "link_id": self.link_id,
            "observation_status": self.observation_status.value,
            "scene_id": self.scene_id,
            "transcript_segment_id": self.transcript_segment_id,
            "video_end_ms": self.video_end_ms,
            "video_start_ms": self.video_start_ms,
        }


@dataclass(frozen=True)
class TranscriptAlignmentIR:
    alignment_id: str
    transcript_id: str
    video_envelope_id: str
    links: tuple[AlignmentLink, ...]

    def __post_init__(self) -> None:
        links = tuple(self.links)
        seen: set[str] = set()
        for link in links:
            if not isinstance(link, AlignmentLink):
                raise ValueError("links must be AlignmentLink values")
            if link.link_id in seen:
                raise ValueError(f"duplicate link_id {link.link_id}")
            seen.add(link.link_id)
        ordered = tuple(
            sorted(links, key=lambda item: (item.video_start_ms, item.video_end_ms, item.link_id))
        )
        object.__setattr__(self, "alignment_id", require_id(self.alignment_id, "alignment_id"))
        object.__setattr__(self, "transcript_id", require_id(self.transcript_id, "transcript_id"))
        object.__setattr__(
            self, "video_envelope_id", require_id(self.video_envelope_id, "video_envelope_id")
        )
        object.__setattr__(self, "links", ordered)

    def to_dict(self) -> dict[str, object]:
        return {
            "alignment_id": self.alignment_id,
            "links": [link.to_dict() for link in self.links],
            "transcript_id": self.transcript_id,
            "video_envelope_id": self.video_envelope_id,
        }


@dataclass(frozen=True)
class TemporalEvent:
    """A time mark that cites structure. It does not assert what the mark means."""

    event_id: str
    kind: TemporalEventKind
    start_ms: int
    end_ms: int | None = None
    ref_id: str | None = None
    observation_status: ObservationStatus = ObservationStatus.UNVERIFIED

    def __post_init__(self) -> None:
        kind = _enum_value(self.kind, TemporalEventKind, "kind")
        start_ms = require_non_negative_int(self.start_ms, "start_ms")
        if kind is TemporalEventKind.KEYFRAME_MARK:
            if self.end_ms is not None:
                raise ValueError("KEYFRAME_MARK is a point and has no end_ms")
            end_ms: int | None = None
        else:
            if self.end_ms is None:
                raise ValueError(f"{kind.value} requires end_ms")
            start_ms, end_value = require_span(start_ms, self.end_ms)
            end_ms = end_value
        ref_id = None if self.ref_id is None else require_id(self.ref_id, "ref_id")
        if kind in (TemporalEventKind.SILENCE, TemporalEventKind.DECLARED) and ref_id is not None:
            raise ValueError(f"{kind.value} does not cite an object")
        if (
            kind
            in (
                TemporalEventKind.SPEECH_SPAN,
                TemporalEventKind.SCENE_SPAN,
                TemporalEventKind.KEYFRAME_MARK,
            )
            and ref_id is None
        ):
            raise ValueError(f"{kind.value} must cite its object")
        object.__setattr__(self, "event_id", require_id(self.event_id, "event_id"))
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "start_ms", start_ms)
        object.__setattr__(self, "end_ms", end_ms)
        object.__setattr__(self, "ref_id", ref_id)
        object.__setattr__(self, "observation_status", _as_observation(self.observation_status))

    def to_dict(self) -> dict[str, object]:
        return {
            "end_ms": self.end_ms,
            "event_id": self.event_id,
            "kind": self.kind.value,
            "observation_status": self.observation_status.value,
            "ref_id": self.ref_id,
            "start_ms": self.start_ms,
        }


_VIDEO_FIELDS = frozenset(
    {
        "content_digest",
        "declared_byte_length",
        "duration_ms",
        "envelope_id",
        "height_px",
        "media_type",
        "network_authority",
        "raw_video_retention",
        "raw_video_retention_explicitly_needed",
        "width_px",
    }
)


def video_envelope_from_mapping(mapping: Mapping[str, Any]) -> VideoInputEnvelope:
    require_mapping_fields(
        mapping,
        allowed=_VIDEO_FIELDS,
        required=frozenset({"content_digest", "duration_ms", "envelope_id", "media_type"}),
        forbidden=RAW_VIDEO_KEYS | IDENTITY_KEYS | SCORE_KEYS,
    )
    retention = mapping.get("raw_video_retention", "OFF")
    explicitly_needed = mapping.get("raw_video_retention_explicitly_needed", False)
    return VideoInputEnvelope(
        envelope_id=mapping["envelope_id"],
        content_digest=mapping["content_digest"],
        duration_ms=mapping["duration_ms"],
        media_type=mapping["media_type"],
        raw_video_retention=RawVideoRetentionPolicy(
            retention=retention,
            explicitly_needed=explicitly_needed,
        ),
        network_authority=mapping.get("network_authority", NetworkAuthorityPolicy()),
        width_px=mapping.get("width_px"),
        height_px=mapping.get("height_px"),
        declared_byte_length=mapping.get("declared_byte_length"),
    )


__all__ = [
    "AlignmentBasis",
    "AlignmentLink",
    "BoundaryBasis",
    "Keyframe",
    "KeyframeRole",
    "SceneSegment",
    "SceneSegmentationIR",
    "TemporalEvent",
    "TemporalEventKind",
    "TranscriptAlignmentIR",
    "VideoInputEnvelope",
    "video_envelope_from_mapping",
]
