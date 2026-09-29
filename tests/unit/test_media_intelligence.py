"""Media intelligence foundation: privacy defaults and structural custody."""

from __future__ import annotations

import hashlib
from dataclasses import FrozenInstanceError
from pathlib import Path

import jsonschema
import pytest

from spe_runtime.media import (
    AlignmentLink,
    AudioInputEnvelope,
    Keyframe,
    LanguageMetadata,
    MediaIntentContract,
    SceneSegment,
    SceneSegmentationIR,
    SpeakerNeutralCustody,
    TemporalEvent,
    TemporalEventKind,
    TranscriptAlignmentIR,
    TranscriptSegment,
    VideoEvidenceGraph,
    VideoInputEnvelope,
    audio_envelope_from_mapping,
    compile_media_intent,
    hold_speaker_neutral_transcript,
    transcript_segment_from_mapping,
    video_envelope_from_mapping,
)
from spe_runtime.media.contract import load_media_intent_schema, validate_media_intent_dict
from spe_runtime.media.privacy import (
    NetworkAuthority,
    RawAudioRetentionPolicy,
    RawRetention,
    RawVideoRetentionPolicy,
)


def _digest(label: str) -> str:
    return "sha256:" + hashlib.sha256(label.encode("utf-8")).hexdigest()


def _audio() -> AudioInputEnvelope:
    return AudioInputEnvelope(
        envelope_id="audio-1",
        content_digest=_digest("audio-1"),
        duration_ms=2000,
        media_type="audio/wav",
        sample_rate_hz=16000,
        channel_count=1,
    )


def _transcript() -> tuple[TranscriptSegment, object]:
    segments = (
        TranscriptSegment(
            segment_id="seg-1",
            start_ms=0,
            end_ms=800,
            text="hello there",
            speaker_slot="SPEAKER_SLOT_1",
        ),
        TranscriptSegment(
            segment_id="seg-2",
            start_ms=800,
            end_ms=1600,
            text="the second line",
            speaker_slot="SPEAKER_SLOT_2",
        ),
    )
    transcript = hold_speaker_neutral_transcript(
        transcript_id="transcript-1",
        audio_envelope_id="audio-1",
        language=LanguageMetadata(language_tag="en", language_basis="DECLARED"),
        segments=segments,
    )
    return segments, transcript


def _video(*, retention: str = "OFF", explicitly_needed: bool = False) -> VideoInputEnvelope:
    return VideoInputEnvelope(
        envelope_id="video-1",
        content_digest=_digest("video-1"),
        duration_ms=2000,
        media_type="video/mp4",
        raw_video_retention=RawVideoRetentionPolicy(
            retention=retention,
            explicitly_needed=explicitly_needed,
        ),
        width_px=1280,
        height_px=720,
    )


def _scenes() -> SceneSegmentationIR:
    return SceneSegmentationIR(
        segmentation_id="scenes-1",
        video_envelope_id="video-1",
        scenes=(
            SceneSegment(scene_id="scene-1", start_ms=0, end_ms=1000, ordinal=0),
            SceneSegment(scene_id="scene-2", start_ms=1000, end_ms=2000, ordinal=1),
        ),
    )


def _keyframes() -> tuple[Keyframe, Keyframe]:
    return (
        Keyframe(
            keyframe_id="frame-1",
            timestamp_ms=100,
            content_digest=_digest("frame-1"),
            scene_id="scene-1",
        ),
        Keyframe(
            keyframe_id="frame-2",
            timestamp_ms=1500,
            content_digest=_digest("frame-2"),
            scene_id="scene-2",
        ),
    )


def _alignment() -> TranscriptAlignmentIR:
    return TranscriptAlignmentIR(
        alignment_id="align-1",
        transcript_id="transcript-1",
        video_envelope_id="video-1",
        links=(
            AlignmentLink(
                link_id="link-1",
                transcript_segment_id="seg-1",
                video_start_ms=0,
                video_end_ms=800,
                scene_id="scene-1",
                keyframe_id="frame-1",
            ),
            AlignmentLink(
                link_id="link-2",
                transcript_segment_id="seg-2",
                video_start_ms=800,
                video_end_ms=1600,
                scene_id="scene-2",
                keyframe_id="frame-2",
            ),
        ),
    )


def _events() -> tuple[TemporalEvent, ...]:
    return (
        TemporalEvent(
            event_id="event-speech",
            kind=TemporalEventKind.SPEECH_SPAN,
            start_ms=0,
            end_ms=800,
            ref_id="seg-1",
        ),
        TemporalEvent(
            event_id="event-scene",
            kind=TemporalEventKind.SCENE_SPAN,
            start_ms=0,
            end_ms=1000,
            ref_id="scene-1",
        ),
        TemporalEvent(
            event_id="event-frame",
            kind=TemporalEventKind.KEYFRAME_MARK,
            start_ms=100,
            ref_id="frame-1",
        ),
        TemporalEvent(
            event_id="event-silence",
            kind=TemporalEventKind.SILENCE,
            start_ms=1600,
            end_ms=1800,
        ),
        TemporalEvent(
            event_id="event-declared",
            kind=TemporalEventKind.DECLARED,
            start_ms=1800,
            end_ms=1900,
        ),
    )


def _full_contract(**overrides: object) -> MediaIntentContract:
    _segments, transcript = _transcript()
    payload = {
        "purpose": "observe the clip",
        "audio": _audio(),
        "transcript": transcript,
        "video": _video(),
        "scenes": _scenes(),
        "keyframes": _keyframes(),
        "alignment": _alignment(),
        "temporal_events": _events(),
    }
    payload.update(overrides)
    return compile_media_intent(**payload)  # type: ignore[arg-type]


def _walk_keys(value: object) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, item in value.items():
            found.append(str(key))
            found.extend(_walk_keys(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_walk_keys(item))
    return found


def test_privacy_defaults_are_off_and_network_is_none() -> None:
    audio = _audio()
    video = _video()
    contract = _full_contract()
    assert audio.raw_audio_retention.retention is RawRetention.OFF
    assert audio.network_authority.authority is NetworkAuthority.NONE
    assert video.raw_video_retention.retention is RawRetention.OFF
    assert video.raw_video_retention.explicitly_needed is False
    assert video.network_authority.authority is NetworkAuthority.NONE
    privacy = contract.to_dict()["privacy"]
    assert privacy == {
        "network_authority": "NONE",
        "raw_audio_retention": "OFF",
        "raw_video_retention": "OFF",
        "raw_video_retention_explicitly_needed": False,
    }
    assert contract.semantic_authority == "NONE"
    assert contract.protected_intent is None
    assert contract.evidence_graph.semantic_authority == "NONE"
    assert contract.evidence_graph.network_authority.authority is NetworkAuthority.NONE
    assert isinstance(contract, MediaIntentContract)
    assert isinstance(contract.evidence_graph, VideoEvidenceGraph)


def test_raw_audio_retention_on_is_rejected() -> None:
    with pytest.raises(ValueError, match="raw audio retention is OFF"):
        AudioInputEnvelope(
            envelope_id="audio-1",
            content_digest=_digest("audio-1"),
            duration_ms=10,
            media_type="audio/wav",
            raw_audio_retention=RawAudioRetentionPolicy(retention="ON"),
        )
    with pytest.raises(ValueError, match="raw audio retention is OFF"):
        audio_envelope_from_mapping(
            {
                "envelope_id": "audio-1",
                "content_digest": _digest("audio-1"),
                "duration_ms": 10,
                "media_type": "audio/wav",
                "raw_audio_retention": "ON",
            }
        )


def test_raw_audio_bytes_and_scores_are_rejected() -> None:
    with pytest.raises(ValueError, match="raw_audio"):
        audio_envelope_from_mapping(
            {
                "envelope_id": "audio-1",
                "content_digest": _digest("audio-1"),
                "duration_ms": 10,
                "media_type": "audio/wav",
                "raw_audio": b"pcm",
            }
        )
    with pytest.raises(ValueError, match="confidence"):
        transcript_segment_from_mapping(
            {
                "segment_id": "seg-1",
                "start_ms": 0,
                "end_ms": 10,
                "text": "hello",
                "confidence": 0.99,
            }
        )


def test_raw_video_stays_off_unless_explicitly_needed() -> None:
    with pytest.raises(ValueError, match="unless explicitly needed"):
        _video(retention="ON", explicitly_needed=False)
    with pytest.raises(ValueError, match="unless explicitly needed"):
        video_envelope_from_mapping(
            {
                "envelope_id": "video-1",
                "content_digest": _digest("video-1"),
                "duration_ms": 10,
                "media_type": "video/mp4",
                "raw_video_retention": "ON",
            }
        )
    kept = _video(retention="ON", explicitly_needed=True)
    assert kept.raw_video_retention.retention is RawRetention.ON
    assert kept.raw_video_retention.explicitly_needed is True
    assert "video_bytes" not in kept.to_dict()
    permitted = compile_media_intent(purpose="keep the file", video=kept)
    permitted_payload = permitted.to_dict()
    assert permitted_payload["privacy"]["raw_video_retention"] == "ON"
    assert permitted_payload["privacy"]["raw_video_retention_explicitly_needed"] is True
    assert permitted_payload["privacy"]["raw_audio_retention"] == "OFF"
    assert permitted_payload["privacy"]["network_authority"] == "NONE"
    assert validate_media_intent_dict(permitted_payload) == []
    permitted_payload["privacy"]["raw_video_retention_explicitly_needed"] = False
    assert validate_media_intent_dict(permitted_payload)


def test_network_authority_other_than_none_is_rejected() -> None:
    with pytest.raises(ValueError):
        AudioInputEnvelope(
            envelope_id="audio-1",
            content_digest=_digest("audio-1"),
            duration_ms=10,
            media_type="audio/wav",
            network_authority="EGRESS",
        )
    with pytest.raises(ValueError, match="does not accept"):
        compile_media_intent(purpose="observe", audio=_audio(), network_authority="EGRESS")
    with pytest.raises(ValueError, match="does not accept"):
        compile_media_intent(purpose="observe", audio=_audio(), protected_intent={"intent": "x"})


def test_speaker_neutral_custody_rejects_identity() -> None:
    with pytest.raises(ValueError, match="SPEAKER_SLOT"):
        TranscriptSegment(
            segment_id="seg-1",
            start_ms=0,
            end_ms=10,
            text="hello",
            speaker_slot="Ada Lovelace",
        )
    with pytest.raises(ValueError, match="speaker_name"):
        transcript_segment_from_mapping(
            {
                "segment_id": "seg-1",
                "start_ms": 0,
                "end_ms": 10,
                "text": "hello",
                "speaker_name": "Ada",
            }
        )
    with pytest.raises(ValueError, match="does not retain identity"):
        SpeakerNeutralCustody(identity_retained=True)
    _segments, transcript = _transcript()
    assert transcript.custody.custody_mode.value == "SPEAKER_NEUTRAL"
    assert transcript.custody.identity_retained is False
    assert transcript.language.to_dict() == {
        "language_basis": "DECLARED",
        "language_tag": "en",
    }
    assert transcript.segments[0].start_ms == 0
    assert transcript.segments[0].end_ms == 800


def test_language_unspecified_uses_und_tag() -> None:
    with pytest.raises(ValueError, match="und"):
        LanguageMetadata(language_tag="und", language_basis="DECLARED")
    metadata = LanguageMetadata(language_tag="und", language_basis="UNSPECIFIED")
    assert metadata.language_basis.value == "UNSPECIFIED"


def test_contract_compiles_graph_alignment_and_schema() -> None:
    contract = _full_contract()
    again = _full_contract()
    assert contract.contract_id == again.contract_id
    assert contract.to_dict() == again.to_dict()
    payload = contract.to_dict()
    assert validate_media_intent_dict(payload) == []
    kinds = {edge["kind"] for edge in payload["evidence_graph"]["edges"]}
    assert "AUDIO_HAS_TRANSCRIPT" in kinds
    assert "SEGMENT_TEMPORAL_NEXT" in kinds
    assert "VIDEO_HAS_SCENE" in kinds
    assert "SCENE_TEMPORAL_NEXT" in kinds
    assert "SCENE_HAS_KEYFRAME" in kinds
    assert "LINK_CITES_SEGMENT" in kinds
    assert "EVENT_CITES" in kinds
    assert payload["transcript"]["segments"][0]["observation_status"] == "UNVERIFIED"
    assert payload["scenes"]["scenes"][0]["boundary_basis"] == "TIME_DECLARED"
    forbidden = {
        "audio_bytes",
        "confidence",
        "raw_audio",
        "raw_video",
        "score",
        "speaker_name",
        "video_bytes",
        "voiceprint",
    }
    assert forbidden.isdisjoint(_walk_keys(payload))
    for value in _iter_values(payload):
        assert not isinstance(value, (bytes, bytearray))


def test_schema_rejects_audio_retention_on() -> None:
    payload = _full_contract().to_dict()
    payload["privacy"]["raw_audio_retention"] = "ON"
    payload["raw_audio_retention"] = "ON"
    errors = validate_media_intent_dict(payload)
    assert errors
    with pytest.raises(jsonschema.ValidationError):
        jsonschema.validate(payload, load_media_intent_schema())


def test_structural_refusals() -> None:
    audio = _audio()
    _segments, transcript = _transcript()
    video = _video()
    with pytest.raises(ValueError, match="overlap"):
        compile_media_intent(
            purpose="observe",
            audio=audio,
            transcript=hold_speaker_neutral_transcript(
                transcript_id="transcript-1",
                audio_envelope_id="audio-1",
                language=LanguageMetadata(language_tag="en", language_basis="DECLARED"),
                segments=(
                    TranscriptSegment(segment_id="seg-a", start_ms=0, end_ms=100, text="a"),
                    TranscriptSegment(segment_id="seg-b", start_ms=50, end_ms=120, text="b"),
                ),
            ),
        )
    with pytest.raises(ValueError, match="outside"):
        compile_media_intent(
            purpose="observe",
            video=video,
            scenes=SceneSegmentationIR(
                segmentation_id="scenes-1",
                video_envelope_id="video-1",
                scenes=(SceneSegment(scene_id="scene-1", start_ms=0, end_ms=5000, ordinal=0),),
            ),
        )
    with pytest.raises(ValueError, match="ordinal"):
        compile_media_intent(
            purpose="observe",
            video=video,
            scenes=SceneSegmentationIR(
                segmentation_id="scenes-1",
                video_envelope_id="video-1",
                scenes=(
                    SceneSegment(scene_id="scene-late", start_ms=0, end_ms=100, ordinal=1),
                    SceneSegment(scene_id="scene-early", start_ms=100, end_ms=200, ordinal=0),
                ),
            ),
        )
    with pytest.raises(ValueError, match="outside"):
        compile_media_intent(
            purpose="observe",
            video=video,
            keyframes=(
                Keyframe(
                    keyframe_id="frame-x",
                    timestamp_ms=9000,
                    content_digest=_digest("frame-x"),
                ),
            ),
        )
    with pytest.raises(ValueError, match="unknown segment"):
        compile_media_intent(
            purpose="observe",
            audio=audio,
            transcript=transcript,
            video=video,
            alignment=TranscriptAlignmentIR(
                alignment_id="align-1",
                transcript_id="transcript-1",
                video_envelope_id="video-1",
                links=(
                    AlignmentLink(
                        link_id="link-x",
                        transcript_segment_id="missing",
                        video_start_ms=0,
                        video_end_ms=10,
                    ),
                ),
            ),
        )
    with pytest.raises(ValueError, match="requires an audio"):
        compile_media_intent(purpose="observe", transcript=transcript)
    with pytest.raises(ValueError, match="non-empty"):
        compile_media_intent(purpose="  ")
    with pytest.raises(ValueError, match="raw frame bytes"):
        Keyframe(
            keyframe_id="frame-1",
            timestamp_ms=1,
            content_digest=_digest("frame-1"),
            raw_frame_bytes_included=True,
        )


def test_audio_only_and_video_only_contracts() -> None:
    audio_only = compile_media_intent(purpose="transcribe later", audio=_audio())
    assert audio_only.video is None
    assert audio_only.to_dict()["privacy"]["raw_audio_retention"] == "OFF"
    assert validate_media_intent_dict(audio_only.to_dict()) == []
    video_only = compile_media_intent(purpose="segment later", video=_video(), scenes=_scenes())
    assert video_only.audio is None
    assert video_only.evidence_graph.semantic_authority == "NONE"
    assert validate_media_intent_dict(video_only.to_dict()) == []


def test_contracts_are_immutable() -> None:
    contract = _full_contract()
    with pytest.raises(FrozenInstanceError):
        contract.purpose = "changed"  # type: ignore[misc]
    with pytest.raises(FrozenInstanceError):
        contract.evidence_graph.semantic_authority = "GRANTED"  # type: ignore[misc]


def test_package_does_not_import_other_lanes() -> None:
    root = Path("spe_runtime/media")
    banned = (
        "spe_runtime.xcat",
        "spe_runtime.k3",
        "spe_runtime.quality",
        "spe_runtime.providers",
        "spe_runtime.authority",
        "spe_runtime.protocols",
        "spe_runtime.categories",
    )
    for path in root.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        for token in banned:
            assert token not in text
        assert "import ProtectedIntent" not in text
        assert "ProtectedIntent(" not in text


def _iter_values(value: object) -> list[object]:
    found = [value]
    if isinstance(value, dict):
        for item in value.values():
            found.extend(_iter_values(item))
    elif isinstance(value, list):
        for item in value:
            found.extend(_iter_values(item))
    return found
