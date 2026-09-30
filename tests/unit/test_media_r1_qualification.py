"""Lane C2 qualification of the media observation foundation.

These tests read the donor. They do not change it. A failure here is a hold,
not a license to weaken the assertion or patch spe_runtime/media.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from spe_runtime.media import (
    AlignmentLink,
    AudioInputEnvelope,
    Keyframe,
    LanguageMetadata,
    SceneSegment,
    SceneSegmentationIR,
    SpeakerNeutralCustody,
    TranscriptAlignmentIR,
    TranscriptSegment,
    VideoInputEnvelope,
    audio_envelope_from_mapping,
    compile_media_intent,
    hold_speaker_neutral_transcript,
    transcript_segment_from_mapping,
    video_envelope_from_mapping,
)
from spe_runtime.media.contract import SEMANTIC_AUTHORITY, validate_media_intent_dict
from spe_runtime.media.privacy import (
    NetworkAuthority,
    RawAudioRetentionPolicy,
    RawRetention,
    RawVideoRetentionPolicy,
)

_PROMOTED_IDENTITY = (
    "speaker_name",
    "speaker_id",
    "speaker_identity",
    "person_id",
    "email",
    "phone",
    "phone_number",
    "biometric",
    "biometric_id",
    "voiceprint",
    "diarization_identity",
)
_SCORE_KEYS = ("confidence", "score", "quality_score", "authority_score")
_NETWORK_KEYS = (
    "upload_url",
    "callback_url",
    "stt_endpoint",
    "endpoint",
    "callback",
    "cloud_endpoint",
)


def _digest(label: str) -> str:
    return "sha256:" + hashlib.sha256(label.encode("utf-8")).hexdigest()


def _audio_mapping(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "envelope_id": "audio-1",
        "content_digest": _digest("audio-1"),
        "duration_ms": 2000,
        "media_type": "audio/wav",
    }
    payload.update(overrides)
    return payload


def _video_mapping(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "envelope_id": "video-1",
        "content_digest": _digest("video-1"),
        "duration_ms": 2000,
        "media_type": "video/mp4",
    }
    payload.update(overrides)
    return payload


def _audio() -> AudioInputEnvelope:
    return audio_envelope_from_mapping(_audio_mapping())


def _video() -> VideoInputEnvelope:
    return video_envelope_from_mapping(_video_mapping())


def _segment_mapping(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "segment_id": "seg-1",
        "start_ms": 0,
        "end_ms": 100,
        "text": "hello there",
    }
    payload.update(overrides)
    return payload


def _walk_keys(value: object) -> set[str]:
    found: set[str] = set()
    if isinstance(value, dict):
        for key, item in value.items():
            found.add(str(key))
            found.update(_walk_keys(item))
    elif isinstance(value, list):
        for item in value:
            found.update(_walk_keys(item))
    return found


def malformed_explicit_need_findings() -> list[dict[str, object]]:
    """Non-boolean explicit-need values that retain raw video.

    bool(\"false\") is True, so a mapping that says the need is false is stored
    as explicitly_needed true and the compiled contract schema-validates.
    """
    findings: list[dict[str, object]] = []
    policy_values: tuple[object, ...] = (
        "false",
        "False",
        "no",
        "off",
        "0",
        "yes",
        1,
        " ",
        b"x",
        ["x"],
        {"a": 1},
    )
    for value in policy_values:
        try:
            policy = RawVideoRetentionPolicy(retention="ON", explicitly_needed=value)
        except ValueError:
            continue
        findings.append(
            {
                "channel": "RawVideoRetentionPolicy",
                "input": repr(value),
                "retention": policy.retention.value,
                "explicitly_needed": policy.explicitly_needed,
                "explicitly_needed_type": type(policy.explicitly_needed).__name__,
            }
        )
    for value in ("false", "no", "off", "0", 1, " "):
        try:
            envelope = video_envelope_from_mapping(
                _video_mapping(
                    raw_video_retention="ON",
                    raw_video_retention_explicitly_needed=value,
                )
            )
        except ValueError:
            continue
        contract = compile_media_intent(purpose="probe malformed explicit need", video=envelope)
        payload = contract.to_dict()
        findings.append(
            {
                "channel": "video_envelope_from_mapping",
                "input": repr(value),
                "retention": payload["raw_video_retention"],
                "explicitly_needed": payload["raw_video_retention_explicitly_needed"],
                "schema_errors": validate_media_intent_dict(payload),
                "video_bytes_key_present": "video_bytes" in payload["video"],
            }
        )
    return findings


def test_raw_audio_cannot_be_retained() -> None:
    audio = _audio()
    assert audio.raw_audio_retention.retention is RawRetention.OFF
    assert audio.raw_audio_retention.to_dict() == "OFF"
    rendered = audio.to_dict()
    assert "raw_audio" not in rendered
    assert "audio_bytes" not in rendered
    assert "samples" not in rendered
    with pytest.raises(ValueError):
        RawAudioRetentionPolicy(retention="ON")
    for key in ("raw_audio", "audio_bytes", "audio_b64", "pcm", "samples", "waveform"):
        with pytest.raises(ValueError):
            audio_envelope_from_mapping(_audio_mapping(**{key: b"pcm-bytes"}))


def test_raw_video_default_off_and_boolean_explicit_need_required() -> None:
    policy = RawVideoRetentionPolicy()
    assert policy.retention is RawRetention.OFF
    assert policy.explicitly_needed is False
    video = _video()
    assert video.raw_video_retention.retention is RawRetention.OFF
    assert video.raw_video_retention.explicitly_needed is False
    assert "video_bytes" not in video.to_dict()
    assert "frame_bytes" not in video.to_dict()
    with pytest.raises(ValueError):
        video_envelope_from_mapping(_video_mapping(raw_video_retention="ON"))
    with pytest.raises(ValueError):
        video_envelope_from_mapping(
            _video_mapping(
                raw_video_retention="ON",
                raw_video_retention_explicitly_needed=False,
            )
        )
    kept = video_envelope_from_mapping(
        _video_mapping(
            raw_video_retention="ON",
            raw_video_retention_explicitly_needed=True,
        )
    )
    assert kept.raw_video_retention.retention is RawRetention.ON
    assert kept.raw_video_retention.explicitly_needed is True
    assert "video_bytes" not in kept.to_dict()
    assert "frame_bytes" not in kept.to_dict()
    contract = compile_media_intent(purpose="explicit file need", video=kept)
    privacy = contract.to_dict()["privacy"]
    assert privacy["raw_video_retention"] == "ON"
    assert privacy["raw_video_retention_explicitly_needed"] is True
    assert privacy["raw_audio_retention"] == "OFF"
    assert privacy["network_authority"] == "NONE"


def test_malformed_explicit_need_fails_closed() -> None:
    assert malformed_explicit_need_findings() == []


def test_speaker_identity_is_not_promoted() -> None:
    with pytest.raises(ValueError):
        TranscriptSegment(
            segment_id="seg-1",
            start_ms=0,
            end_ms=100,
            text="hello",
            speaker_slot="Ada Lovelace",
        )
    with pytest.raises(ValueError):
        SpeakerNeutralCustody(identity_retained=True)
    for key in _PROMOTED_IDENTITY:
        with pytest.raises(ValueError):
            transcript_segment_from_mapping(_segment_mapping(**{key: "secret"}))
    segment = TranscriptSegment(
        segment_id="seg-1",
        start_ms=0,
        end_ms=100,
        text="ada@example.com called +1-555-0100",
        speaker_slot="SPEAKER_SLOT_1",
    )
    assert segment.speaker_slot == "SPEAKER_SLOT_1"
    assert _PROMOTED_IDENTITY_SET().isdisjoint(segment.to_dict())
    custody = SpeakerNeutralCustody()
    assert custody.custody_mode.value == "SPEAKER_NEUTRAL"
    assert custody.identity_retained is False


def test_voice_biometric_is_not_promoted() -> None:
    for key in ("voiceprint", "biometric", "biometric_id"):
        with pytest.raises(ValueError):
            transcript_segment_from_mapping(_segment_mapping(**{key: "print-1"}))
        with pytest.raises(ValueError):
            audio_envelope_from_mapping(_audio_mapping(**{key: "print-1"}))
    segment = TranscriptSegment(segment_id="seg-1", start_ms=0, end_ms=40, text="hello")
    assert "voiceprint" not in segment.to_dict()
    assert "biometric" not in segment.to_dict()


def test_network_authority_stays_none() -> None:
    audio = _audio()
    video = _video()
    assert audio.network_authority.authority is NetworkAuthority.NONE
    assert video.network_authority.authority is NetworkAuthority.NONE
    assert audio.network_authority.to_dict() == "NONE"
    contract = compile_media_intent(purpose="local observation", audio=audio, video=video)
    payload = contract.to_dict()
    assert payload["network_authority"] == "NONE"
    assert payload["privacy"]["network_authority"] == "NONE"
    assert _NETWORK_KEYS_SET().isdisjoint(_walk_keys(payload))
    with pytest.raises(ValueError):
        AudioInputEnvelope(
            envelope_id="audio-1",
            content_digest=_digest("audio-1"),
            duration_ms=10,
            media_type="audio/wav",
            network_authority="CLOUD",
        )
    for key, value in (
        ("stt_endpoint", "https://speech.example/v1"),
        ("upload_url", "https://uploads.example/media"),
        ("callback_url", "https://callbacks.example/hook"),
        ("cloud_endpoint", "https://cloud.example/stt"),
    ):
        with pytest.raises(ValueError):
            audio_envelope_from_mapping(_audio_mapping(**{key: value}))
        with pytest.raises(ValueError):
            video_envelope_from_mapping(_video_mapping(**{key: value}))
    with pytest.raises(ValueError):
        compile_media_intent(purpose="observe", audio=audio, network_authority="CLOUD")


def test_negative_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError):
        TranscriptSegment(segment_id="seg-1", start_ms=-1, end_ms=10, text="hello")
    with pytest.raises(ValueError):
        Keyframe(keyframe_id="frame-1", timestamp_ms=-1, content_digest=_digest("frame-1"))
    with pytest.raises(ValueError):
        SceneSegment(scene_id="scene-1", start_ms=-5, end_ms=10, ordinal=0)


def test_reversed_timestamp_is_rejected() -> None:
    with pytest.raises(ValueError):
        TranscriptSegment(segment_id="seg-1", start_ms=40, end_ms=10, text="hello")
    with pytest.raises(ValueError):
        TranscriptSegment(segment_id="seg-1", start_ms=10, end_ms=10, text="hello")
    with pytest.raises(ValueError):
        SceneSegment(scene_id="scene-1", start_ms=80, end_ms=20, ordinal=0)
    with pytest.raises(ValueError):
        AlignmentLink(
            link_id="link-1",
            transcript_segment_id="seg-1",
            video_start_ms=90,
            video_end_ms=10,
        )


def test_scene_overlap_is_rejected() -> None:
    video = _video()
    with pytest.raises(ValueError):
        compile_media_intent(
            purpose="observe",
            video=video,
            scenes=SceneSegmentationIR(
                segmentation_id="scenes-1",
                video_envelope_id="video-1",
                scenes=(
                    SceneSegment(scene_id="scene-1", start_ms=0, end_ms=400, ordinal=0),
                    SceneSegment(scene_id="scene-2", start_ms=200, end_ms=500, ordinal=1),
                ),
            ),
        )


def test_invalid_keyframe_is_rejected() -> None:
    with pytest.raises(ValueError):
        Keyframe(
            keyframe_id="frame-1",
            timestamp_ms=10,
            content_digest="sha256:dead",
        )
    with pytest.raises(ValueError):
        Keyframe(
            keyframe_id="frame-1",
            timestamp_ms=10,
            content_digest=_digest("frame-1"),
            raw_frame_bytes_included=True,
        )
    with pytest.raises(ValueError):
        compile_media_intent(
            purpose="observe",
            video=_video(),
            keyframes=(
                Keyframe(
                    keyframe_id="frame-x",
                    timestamp_ms=9000,
                    content_digest=_digest("frame-x"),
                ),
            ),
        )
    with pytest.raises(ValueError):
        compile_media_intent(
            purpose="observe",
            video=_video(),
            keyframes=(
                Keyframe(
                    keyframe_id="frame-x",
                    timestamp_ms=10,
                    content_digest=_digest("frame-x"),
                    scene_id="missing-scene",
                ),
            ),
        )


def test_unknown_duration_does_not_become_zero() -> None:
    missing = _audio_mapping()
    del missing["duration_ms"]
    with pytest.raises(ValueError):
        audio_envelope_from_mapping(missing)
    for bad in (None, "unknown", "0", 1.5, True):
        with pytest.raises(ValueError):
            audio_envelope_from_mapping(_audio_mapping(duration_ms=bad))
    missing_video = _video_mapping()
    del missing_video["duration_ms"]
    with pytest.raises(ValueError):
        video_envelope_from_mapping(missing_video)
    declared_zero = audio_envelope_from_mapping(_audio_mapping(duration_ms=0))
    assert declared_zero.duration_ms == 0


def test_missing_transcript_is_not_an_empty_proof() -> None:
    contract = compile_media_intent(purpose="audio only", audio=_audio())
    assert contract.transcript is None
    payload = contract.to_dict()
    assert payload["transcript"] is None
    kinds = {node["kind"] for node in payload["evidence_graph"]["nodes"]}
    assert "TRANSCRIPT" not in kinds
    assert "TRANSCRIPT_SEGMENT" not in kinds
    assert payload["semantic_authority"] == "NONE"


def test_unverified_does_not_become_verified() -> None:
    segment = TranscriptSegment(segment_id="seg-1", start_ms=0, end_ms=40, text="hello")
    scene = SceneSegment(scene_id="scene-1", start_ms=0, end_ms=40, ordinal=0)
    frame = Keyframe(keyframe_id="frame-1", timestamp_ms=10, content_digest=_digest("frame-1"))
    link = AlignmentLink(
        link_id="link-1",
        transcript_segment_id="seg-1",
        video_start_ms=0,
        video_end_ms=40,
    )
    for item in (segment, scene, frame, link):
        assert item.observation_status.value == "UNVERIFIED"
        assert item.to_dict()["observation_status"] == "UNVERIFIED"
    for status in ("VERIFIED", "PASS", "PARTIAL", "UNKNOWN"):
        with pytest.raises(ValueError):
            TranscriptSegment(
                segment_id="seg-1",
                start_ms=0,
                end_ms=40,
                text="hello",
                observation_status=status,
            )


def test_confidence_is_not_fabricated() -> None:
    segment = TranscriptSegment(segment_id="seg-1", start_ms=0, end_ms=40, text="hello")
    assert _SCORE_KEYS_SET().isdisjoint(segment.to_dict())
    with pytest.raises(ValueError):
        transcript_segment_from_mapping(_segment_mapping(confidence=0.99))
    contract = compile_media_intent(purpose="observe", audio=_audio())
    assert _SCORE_KEYS_SET().isdisjoint(_walk_keys(contract.to_dict()))


def test_language_is_not_fabricated() -> None:
    unspecified = LanguageMetadata(language_tag="und", language_basis="UNSPECIFIED")
    assert unspecified.to_dict() == {
        "language_basis": "UNSPECIFIED",
        "language_tag": "und",
    }
    with pytest.raises(ValueError):
        LanguageMetadata(language_tag="und", language_basis="DECLARED")
    with pytest.raises(ValueError):
        LanguageMetadata(language_tag="en", language_basis="UNSPECIFIED")
    audio = _audio()
    assert "language_tag" not in audio.to_dict()
    assert "language_basis" not in audio.to_dict()
    contract = compile_media_intent(purpose="audio only", audio=audio)
    assert contract.transcript is None


def test_bad_mime_is_rejected() -> None:
    for mime in (
        "image/png",
        "text/plain",
        "application/octet-stream",
        "audio",
        "audio/",
        "video/mp4",
        "AUDIO/wav",
        "",
    ):
        with pytest.raises(ValueError):
            audio_envelope_from_mapping(_audio_mapping(media_type=mime))
    for mime in ("image/png", "audio/wav", "video", "video/", "VIDEO/mp4", "", "text/plain"):
        with pytest.raises(ValueError):
            video_envelope_from_mapping(_video_mapping(media_type=mime))


def test_scene_label_does_not_become_fact() -> None:
    with pytest.raises(TypeError):
        SceneSegment(
            scene_id="scene-1",
            start_ms=0,
            end_ms=40,
            ordinal=0,
            label="a person enters",
        )
    scene = SceneSegment(scene_id="scene-1", start_ms=0, end_ms=40, ordinal=0)
    rendered = scene.to_dict()
    assert rendered["observation_status"] == "UNVERIFIED"
    assert rendered["boundary_basis"] == "TIME_DECLARED"
    assert "fact" not in rendered
    assert "label" not in rendered
    assert "claim" not in rendered


def test_transcript_does_not_become_identity() -> None:
    transcript = hold_speaker_neutral_transcript(
        transcript_id="transcript-1",
        audio_envelope_id="audio-1",
        language=LanguageMetadata(language_tag="und", language_basis="UNSPECIFIED"),
        segments=(
            TranscriptSegment(
                segment_id="seg-1",
                start_ms=0,
                end_ms=100,
                text="I am Ada, ada@example.com, +1-555-0100",
            ),
        ),
    )
    rendered = transcript.to_dict()
    assert rendered["custody"] == {
        "custody_mode": "SPEAKER_NEUTRAL",
        "identity_retained": False,
    }
    assert rendered["segments"][0]["speaker_slot"] is None
    assert _PROMOTED_IDENTITY_SET().isdisjoint(_walk_keys(rendered))
    contract = compile_media_intent(purpose="words only", audio=_audio(), transcript=transcript)
    assert _PROMOTED_IDENTITY_SET().isdisjoint(_walk_keys(contract.to_dict()))


def test_temporal_gap_is_preserved() -> None:
    transcript = hold_speaker_neutral_transcript(
        transcript_id="transcript-1",
        audio_envelope_id="audio-1",
        language=LanguageMetadata(language_tag="und", language_basis="UNSPECIFIED"),
        segments=(
            TranscriptSegment(segment_id="seg-1", start_ms=0, end_ms=100, text="hello"),
            TranscriptSegment(segment_id="seg-2", start_ms=500, end_ms=600, text="again"),
        ),
    )
    contract = compile_media_intent(purpose="keep the gap", audio=_audio(), transcript=transcript)
    assert contract.transcript is not None
    first, second = contract.transcript.segments
    assert (first.start_ms, first.end_ms) == (0, 100)
    assert (second.start_ms, second.end_ms) == (500, 600)
    assert first.end_ms < second.start_ms
    payload = contract.to_dict()
    assert payload["transcript"]["segments"][0]["end_ms"] == 100
    assert payload["transcript"]["segments"][1]["start_ms"] == 500


def test_alignment_stays_unverified() -> None:
    audio = _audio()
    video = _video()
    transcript = hold_speaker_neutral_transcript(
        transcript_id="transcript-1",
        audio_envelope_id="audio-1",
        language=LanguageMetadata(language_tag="en", language_basis="DECLARED"),
        segments=(TranscriptSegment(segment_id="seg-1", start_ms=0, end_ms=100, text="hello"),),
    )
    alignment = TranscriptAlignmentIR(
        alignment_id="align-1",
        transcript_id="transcript-1",
        video_envelope_id="video-1",
        links=(
            AlignmentLink(
                link_id="link-1",
                transcript_segment_id="seg-1",
                video_start_ms=400,
                video_end_ms=500,
            ),
        ),
    )
    contract = compile_media_intent(
        purpose="declared times",
        audio=audio,
        transcript=transcript,
        video=video,
        alignment=alignment,
    )
    link = contract.to_dict()["alignment"]["links"][0]
    assert link["observation_status"] == "UNVERIFIED"
    assert link["basis"] == "TIME_DECLARED"
    assert link["video_start_ms"] == 400
    assert link["video_end_ms"] == 500
    with pytest.raises(ValueError):
        compile_media_intent(
            purpose="outside",
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
                        transcript_segment_id="seg-1",
                        video_start_ms=0,
                        video_end_ms=9000,
                    ),
                ),
            ),
        )


def test_semantic_authority_is_none() -> None:
    assert SEMANTIC_AUTHORITY == "NONE"
    contract = compile_media_intent(purpose="observe", audio=_audio())
    assert contract.semantic_authority == "NONE"
    assert contract.output_kind == "MediaIntentContract"
    assert contract.protected_intent is None
    assert contract.evidence_graph.semantic_authority == "NONE"
    assert contract.to_dict()["semantic_authority"] == "NONE"
    assert contract.to_dict()["evidence_graph"]["semantic_authority"] == "NONE"
    with pytest.raises(ValueError):
        compile_media_intent(purpose="observe", audio=_audio(), semantic_authority="FULL")


def test_foundation_does_not_implement_stt_or_video_model() -> None:
    banned = (
        "whisper",
        "speech_recognition",
        "openai",
        "torch",
        "transformers",
        "cv2",
        "ffmpeg",
        "httpx",
        "requests",
    )
    root = Path("spe_runtime/media")
    for path in sorted(root.glob("*.py")):
        text = path.read_text(encoding="utf-8").lower()
        for token in banned:
            assert token not in text, f"{path.name} contains {token}"


def _PROMOTED_IDENTITY_SET() -> set[str]:
    return set(_PROMOTED_IDENTITY)


def _SCORE_KEYS_SET() -> set[str]:
    return set(_SCORE_KEYS)


def _NETWORK_KEYS_SET() -> set[str]:
    return set(_NETWORK_KEYS)
