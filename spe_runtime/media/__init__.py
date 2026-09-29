"""Speech and video intelligence foundation.

The public compiler returns a MediaIntentContract. ProtectedIntent integration
is intentionally absent.
"""

from spe_runtime.media.audio import (
    AudioInputEnvelope,
    LanguageBasis,
    LanguageMetadata,
    SpeakerNeutralCustody,
    TranscriptIR,
    TranscriptSegment,
    audio_envelope_from_mapping,
    hold_speaker_neutral_transcript,
    transcript_segment_from_mapping,
)
from spe_runtime.media.contract import (
    OUTPUT_KIND,
    SCHEMA_VERSION,
    MediaIntentContract,
    compile_media_intent,
)
from spe_runtime.media.evidence import VideoEvidenceGraph
from spe_runtime.media.privacy import (
    NetworkAuthority,
    RawAudioRetentionPolicy,
    RawRetention,
    RawVideoRetentionPolicy,
)
from spe_runtime.media.video import (
    AlignmentLink,
    Keyframe,
    SceneSegment,
    SceneSegmentationIR,
    TemporalEvent,
    TemporalEventKind,
    TranscriptAlignmentIR,
    VideoInputEnvelope,
    video_envelope_from_mapping,
)

__all__ = [
    "OUTPUT_KIND",
    "SCHEMA_VERSION",
    "AlignmentLink",
    "AudioInputEnvelope",
    "Keyframe",
    "LanguageBasis",
    "LanguageMetadata",
    "MediaIntentContract",
    "NetworkAuthority",
    "RawAudioRetentionPolicy",
    "RawRetention",
    "RawVideoRetentionPolicy",
    "SceneSegment",
    "SceneSegmentationIR",
    "SpeakerNeutralCustody",
    "TemporalEvent",
    "TemporalEventKind",
    "TranscriptAlignmentIR",
    "TranscriptIR",
    "TranscriptSegment",
    "VideoEvidenceGraph",
    "VideoInputEnvelope",
    "audio_envelope_from_mapping",
    "compile_media_intent",
    "hold_speaker_neutral_transcript",
    "transcript_segment_from_mapping",
    "video_envelope_from_mapping",
]
