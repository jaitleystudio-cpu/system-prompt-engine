"""MediaIntentContract — the only output of the media foundation.

compile_media_intent returns this contract. It does not write a
ProtectedIntent, mint semantic authority, or call a provider.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Sequence

from jsonschema import Draft202012Validator

from spe_runtime.media._validate import (
    assert_non_overlapping,
    require_id,
    require_within_duration,
)
from spe_runtime.media.audio import (
    AudioInputEnvelope,
    TranscriptIR,
    TranscriptSegment,
)
from spe_runtime.media.evidence import VideoEvidenceGraph, build_video_evidence_graph
from spe_runtime.media.privacy import (
    NetworkAuthorityPolicy,
    RawAudioRetentionPolicy,
    RawRetention,
    RawVideoRetentionPolicy,
)
from spe_runtime.media.video import (
    Keyframe,
    SceneSegmentationIR,
    TemporalEvent,
    TemporalEventKind,
    TranscriptAlignmentIR,
    VideoInputEnvelope,
)
from spe_runtime.portability.canonical import canonical_dumps

SCHEMA_VERSION = "spe.media-intent.v1"
OUTPUT_KIND = "MediaIntentContract"
SEMANTIC_AUTHORITY = "NONE"
_SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "media_intent_contract.schema.json"


def _content_id(prefix: str, payload: dict[str, Any]) -> str:
    digest = hashlib.sha256(canonical_dumps(payload).encode("utf-8")).hexdigest()
    return f"{prefix}-{digest[:32]}"


@dataclass(frozen=True)
class MediaIntentContract:
    """Observation contract. semantic_authority is NONE. protected_intent is unset."""

    contract_id: str
    purpose: str
    audio: AudioInputEnvelope | None
    transcript: TranscriptIR | None
    video: VideoInputEnvelope | None
    scenes: SceneSegmentationIR | None
    keyframes: tuple[Keyframe, ...]
    alignment: TranscriptAlignmentIR | None
    temporal_events: tuple[TemporalEvent, ...]
    evidence_graph: VideoEvidenceGraph
    raw_audio_retention: RawAudioRetentionPolicy
    raw_video_retention: RawVideoRetentionPolicy
    network_authority: NetworkAuthorityPolicy
    schema_version: str = SCHEMA_VERSION
    output_kind: str = OUTPUT_KIND
    semantic_authority: str = SEMANTIC_AUTHORITY
    protected_intent: None = None

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(f"schema_version is {SCHEMA_VERSION}")
        if self.output_kind != OUTPUT_KIND:
            raise ValueError("output_kind is MediaIntentContract")
        if self.semantic_authority != SEMANTIC_AUTHORITY:
            raise ValueError("semantic_authority is NONE")
        if self.protected_intent is not None:
            raise ValueError("MediaIntentContract does not carry ProtectedIntent")
        if self.raw_audio_retention.retention is not RawRetention.OFF:
            raise ValueError("raw audio retention is OFF")
        if self.network_authority.to_dict() != "NONE":
            raise ValueError("network authority is NONE")
        if not isinstance(self.evidence_graph, VideoEvidenceGraph):
            raise ValueError("evidence_graph must be a VideoEvidenceGraph")
        if self.evidence_graph.semantic_authority != SEMANTIC_AUTHORITY:
            raise ValueError("semantic_authority is NONE")
        if self.evidence_graph.raw_audio_retention != self.raw_audio_retention:
            raise ValueError("evidence graph audio retention does not match the contract")
        if self.evidence_graph.raw_video_retention != self.raw_video_retention:
            raise ValueError("evidence graph video retention does not match the contract")
        if self.evidence_graph.network_authority != self.network_authority:
            raise ValueError("evidence graph network authority does not match the contract")
        object.__setattr__(self, "purpose", str(self.purpose).strip())
        if not self.purpose:
            raise ValueError("purpose must be non-empty")
        object.__setattr__(self, "contract_id", require_id(self.contract_id, "contract_id"))

    def to_dict(self) -> dict[str, Any]:
        video_policy = self.raw_video_retention.to_dict()
        return {
            "alignment": None if self.alignment is None else self.alignment.to_dict(),
            "audio": None if self.audio is None else self.audio.to_dict(),
            "contract_id": self.contract_id,
            "evidence_graph": self.evidence_graph.to_dict(),
            "keyframes": [keyframe.to_dict() for keyframe in self.keyframes],
            "network_authority": self.network_authority.to_dict(),
            "output_kind": self.output_kind,
            "privacy": {
                "network_authority": self.network_authority.to_dict(),
                "raw_audio_retention": self.raw_audio_retention.to_dict(),
                "raw_video_retention": video_policy["retention"],
                "raw_video_retention_explicitly_needed": video_policy["explicitly_needed"],
            },
            "protected_intent": None,
            "purpose": self.purpose,
            "raw_audio_retention": self.raw_audio_retention.to_dict(),
            "raw_video_retention": video_policy["retention"],
            "raw_video_retention_explicitly_needed": video_policy["explicitly_needed"],
            "scenes": None if self.scenes is None else self.scenes.to_dict(),
            "schema_version": self.schema_version,
            "semantic_authority": self.semantic_authority,
            "temporal_events": [event.to_dict() for event in self.temporal_events],
            "transcript": None if self.transcript is None else self.transcript.to_dict(),
            "video": None if self.video is None else self.video.to_dict(),
        }


def compile_media_intent(
    *,
    purpose: str,
    audio: AudioInputEnvelope | None = None,
    transcript: TranscriptIR | None = None,
    video: VideoInputEnvelope | None = None,
    scenes: SceneSegmentationIR | None = None,
    keyframes: Sequence[Keyframe] = (),
    alignment: TranscriptAlignmentIR | None = None,
    temporal_events: Sequence[TemporalEvent] = (),
    **kwargs: Any,
) -> MediaIntentContract:
    """Compile observations into a MediaIntentContract and nothing else."""
    if kwargs:
        raise ValueError(
            "media intent does not accept "
            + ", ".join(sorted(str(key) for key in kwargs))
        )
    purpose_text = str(purpose).strip()
    if not purpose_text:
        raise ValueError("purpose must be non-empty")
    if audio is None and video is None:
        raise ValueError("media intent requires an audio or video envelope")

    keyframe_list = tuple(keyframes)
    event_list = tuple(temporal_events)
    _validate_relations(
        audio=audio,
        transcript=transcript,
        video=video,
        scenes=scenes,
        keyframes=keyframe_list,
        alignment=alignment,
        temporal_events=event_list,
    )

    raw_audio = audio.raw_audio_retention if audio is not None else RawAudioRetentionPolicy()
    if transcript is not None:
        raw_audio = transcript.raw_audio_retention
    raw_video = video.raw_video_retention if video is not None else RawVideoRetentionPolicy()
    network = NetworkAuthorityPolicy()

    graph_body = _graph_body(
        audio=audio,
        transcript=transcript,
        video=video,
        scenes=scenes,
        keyframes=keyframe_list,
        alignment=alignment,
        temporal_events=event_list,
        raw_audio_retention=raw_audio,
        raw_video_retention=raw_video,
        network_authority=network,
    )
    graph_id = _content_id("veg", graph_body)
    graph = build_video_evidence_graph(
        graph_id=graph_id,
        audio=audio,
        transcript=transcript,
        video=video,
        scenes=scenes,
        keyframes=keyframe_list,
        alignment=alignment,
        temporal_events=event_list,
        raw_audio_retention=raw_audio,
        raw_video_retention=raw_video,
        network_authority=network,
    )
    ordered_keyframes = tuple(
        sorted(keyframe_list, key=lambda item: (item.timestamp_ms, item.keyframe_id))
    )
    ordered_events = tuple(
        sorted(event_list, key=lambda item: (item.start_ms, item.end_ms or -1, item.event_id))
    )
    contract_without_id = {
        "alignment": None if alignment is None else alignment.to_dict(),
        "audio": None if audio is None else audio.to_dict(),
        "evidence_graph": graph.to_dict(),
        "keyframes": [item.to_dict() for item in ordered_keyframes],
        "purpose": purpose_text,
        "scenes": None if scenes is None else scenes.to_dict(),
        "schema_version": SCHEMA_VERSION,
        "temporal_events": [item.to_dict() for item in ordered_events],
        "transcript": None if transcript is None else transcript.to_dict(),
        "video": None if video is None else video.to_dict(),
    }
    contract_id = _content_id("mic", contract_without_id)
    return MediaIntentContract(
        contract_id=contract_id,
        purpose=purpose_text,
        audio=audio,
        transcript=transcript,
        video=video,
        scenes=scenes,
        keyframes=ordered_keyframes,
        alignment=alignment,
        temporal_events=ordered_events,
        evidence_graph=graph,
        raw_audio_retention=raw_audio,
        raw_video_retention=raw_video,
        network_authority=network,
    )


def load_media_intent_schema() -> dict[str, Any]:
    with _SCHEMA_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError("media intent schema must be an object")
    return payload


def validate_media_intent_dict(data: dict[str, Any]) -> list[str]:
    validator = Draft202012Validator(load_media_intent_schema())
    return sorted(error.message for error in validator.iter_errors(data))


def _validate_relations(
    *,
    audio: AudioInputEnvelope | None,
    transcript: TranscriptIR | None,
    video: VideoInputEnvelope | None,
    scenes: SceneSegmentationIR | None,
    keyframes: tuple[Keyframe, ...],
    alignment: TranscriptAlignmentIR | None,
    temporal_events: tuple[TemporalEvent, ...],
) -> None:
    if transcript is not None:
        if audio is None:
            raise ValueError("transcript requires an audio envelope")
        if transcript.audio_envelope_id != audio.envelope_id:
            raise ValueError("transcript audio_envelope_id does not match the audio envelope")
        _validate_segments(transcript.segments, audio.duration_ms)
    if scenes is not None:
        if video is None:
            raise ValueError("scene segmentation requires a video envelope")
        if scenes.video_envelope_id != video.envelope_id:
            raise ValueError("scene segmentation video_envelope_id does not match the video")
        _validate_scenes(scenes, video.duration_ms)
    scene_ids = set() if scenes is None else {scene.scene_id for scene in scenes.scenes}
    if keyframes:
        if video is None:
            raise ValueError("keyframes require a video envelope")
        seen: set[str] = set()
        for keyframe in keyframes:
            if keyframe.keyframe_id in seen:
                raise ValueError(f"duplicate keyframe_id {keyframe.keyframe_id}")
            seen.add(keyframe.keyframe_id)
            if keyframe.timestamp_ms > video.duration_ms:
                raise ValueError("keyframe falls outside the video duration")
            if keyframe.scene_id is not None and keyframe.scene_id not in scene_ids:
                raise ValueError(f"keyframe cites unknown scene {keyframe.scene_id}")
            if keyframe.raw_frame_bytes_included:
                raise ValueError("keyframe IR does not include raw frame bytes")
    segment_ids = set() if transcript is None else {item.segment_id for item in transcript.segments}
    keyframe_ids = {item.keyframe_id for item in keyframes}
    if alignment is not None:
        if transcript is None or video is None:
            raise ValueError("alignment requires a transcript and a video envelope")
        if alignment.transcript_id != transcript.transcript_id:
            raise ValueError("alignment transcript_id does not match the transcript")
        if alignment.video_envelope_id != video.envelope_id:
            raise ValueError("alignment video_envelope_id does not match the video")
        for link in alignment.links:
            if link.transcript_segment_id not in segment_ids:
                raise ValueError(
                    f"alignment cites unknown segment {link.transcript_segment_id}"
                )
            if link.scene_id is not None and link.scene_id not in scene_ids:
                raise ValueError(f"alignment cites unknown scene {link.scene_id}")
            if link.keyframe_id is not None and link.keyframe_id not in keyframe_ids:
                raise ValueError(f"alignment cites unknown keyframe {link.keyframe_id}")
            require_within_duration(
                link.video_start_ms,
                link.video_end_ms,
                video.duration_ms,
                f"alignment {link.link_id}",
            )
    _validate_events(
        temporal_events,
        audio=audio,
        video=video,
        transcript=transcript,
        scenes=scenes,
        keyframes=keyframes,
    )


def _validate_segments(segments: tuple[TranscriptSegment, ...], duration_ms: int) -> None:
    assert_non_overlapping(
        [(item.start_ms, item.end_ms, item.segment_id) for item in segments],
        "transcript segment",
    )
    for segment in segments:
        require_within_duration(
            segment.start_ms, segment.end_ms, duration_ms, f"segment {segment.segment_id}"
        )


def _validate_scenes(scenes: SceneSegmentationIR, duration_ms: int) -> None:
    ordered = scenes.scenes
    assert_non_overlapping(
        [(item.start_ms, item.end_ms, item.scene_id) for item in ordered],
        "scene",
    )
    for index, scene in enumerate(ordered):
        if scene.ordinal != index:
            raise ValueError(
                f"scene {scene.scene_id} ordinal {scene.ordinal} does not match time order {index}"
            )
        require_within_duration(
            scene.start_ms, scene.end_ms, duration_ms, f"scene {scene.scene_id}"
        )


def _validate_events(
    events: tuple[TemporalEvent, ...],
    *,
    audio: AudioInputEnvelope | None,
    video: VideoInputEnvelope | None,
    transcript: TranscriptIR | None,
    scenes: SceneSegmentationIR | None,
    keyframes: tuple[Keyframe, ...],
) -> None:
    seen: set[str] = set()
    segments = {} if transcript is None else {item.segment_id: item for item in transcript.segments}
    scene_map = {} if scenes is None else {item.scene_id: item for item in scenes.scenes}
    keyframe_map = {item.keyframe_id: item for item in keyframes}
    for event in events:
        if event.event_id in seen:
            raise ValueError(f"duplicate event_id {event.event_id}")
        seen.add(event.event_id)
        if event.kind is TemporalEventKind.SPEECH_SPAN:
            _require_matching_span(event, segments, "segment", audio.duration_ms if audio else None)
        elif event.kind is TemporalEventKind.SCENE_SPAN:
            _require_matching_span(event, scene_map, "scene", video.duration_ms if video else None)
        elif event.kind is TemporalEventKind.KEYFRAME_MARK:
            if video is None:
                raise ValueError("KEYFRAME_MARK requires a video envelope")
            if event.ref_id not in keyframe_map:
                raise ValueError("KEYFRAME_MARK must cite a known keyframe")
            keyframe = keyframe_map[event.ref_id]
            if event.start_ms != keyframe.timestamp_ms:
                raise ValueError("KEYFRAME_MARK time does not match the keyframe")
            if event.start_ms > video.duration_ms:
                raise ValueError("KEYFRAME_MARK falls outside the video duration")
        elif event.kind is TemporalEventKind.SILENCE:
            clock = _clock_duration(audio, video)
            if event.end_ms is None:
                raise ValueError("SILENCE requires end_ms")
            require_within_duration(event.start_ms, event.end_ms, clock, f"event {event.event_id}")
        else:
            clock = _clock_duration(audio, video)
            if event.end_ms is None:
                raise ValueError("DECLARED requires end_ms")
            require_within_duration(event.start_ms, event.end_ms, clock, f"event {event.event_id}")


def _require_matching_span(
    event: TemporalEvent,
    objects: dict[str, Any],
    label: str,
    duration_ms: int | None,
) -> None:
    if duration_ms is None:
        raise ValueError(f"{event.kind.value} requires its media envelope")
    if event.ref_id is None or event.ref_id not in objects:
        raise ValueError(f"{event.kind.value} must cite a known {label}")
    target = objects[event.ref_id]
    if event.start_ms != target.start_ms or event.end_ms != target.end_ms:
        raise ValueError(f"{event.kind.value} time does not match the cited {label}")
    if event.end_ms is None:
        raise ValueError(f"{event.kind.value} requires end_ms")
    require_within_duration(event.start_ms, event.end_ms, duration_ms, f"event {event.event_id}")


def _clock_duration(audio: AudioInputEnvelope | None, video: VideoInputEnvelope | None) -> int:
    if video is not None:
        return video.duration_ms
    if audio is not None:
        return audio.duration_ms
    raise ValueError("temporal event requires an audio or video envelope")


def _graph_body(
    *,
    audio: AudioInputEnvelope | None,
    transcript: TranscriptIR | None,
    video: VideoInputEnvelope | None,
    scenes: SceneSegmentationIR | None,
    keyframes: tuple[Keyframe, ...],
    alignment: TranscriptAlignmentIR | None,
    temporal_events: tuple[TemporalEvent, ...],
    raw_audio_retention: RawAudioRetentionPolicy,
    raw_video_retention: RawVideoRetentionPolicy,
    network_authority: NetworkAuthorityPolicy,
) -> dict[str, Any]:
    """Identity material for the evidence graph, excluding graph_id."""
    placeholder = build_video_evidence_graph(
        graph_id="veg-placeholder",
        audio=audio,
        transcript=transcript,
        video=video,
        scenes=scenes,
        keyframes=keyframes,
        alignment=alignment,
        temporal_events=temporal_events,
        raw_audio_retention=raw_audio_retention,
        raw_video_retention=raw_video_retention,
        network_authority=network_authority,
    )
    body = placeholder.to_dict()
    body.pop("graph_id", None)
    return body


__all__ = [
    "OUTPUT_KIND",
    "SCHEMA_VERSION",
    "SEMANTIC_AUTHORITY",
    "MediaIntentContract",
    "compile_media_intent",
    "load_media_intent_schema",
    "validate_media_intent_dict",
]
