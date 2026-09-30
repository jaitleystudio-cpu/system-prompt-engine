"""Speech and video intelligence foundation.

Lineage: NEW_IMPLEMENTATION

## Scope

`spe_runtime/media` holds observation custody for speech and video:

- `AudioInputEnvelope`
- `TranscriptIR` with timestamps and language metadata
- speaker-neutral transcript custody
- `VideoInputEnvelope`
- scene segmentation IR
- keyframes
- transcript alignment
- temporal events
- `VideoEvidenceGraph`
- `MediaIntentContract`

`compile_media_intent` returns a `MediaIntentContract` only.

## Privacy defaults

- Raw audio retention is OFF. The audio policy type rejects ON.
- Raw video retention is OFF unless retention is ON and `explicitly_needed` is the boolean True. Strings, numbers, bytes, and blank values are refused.
- Network authority is NONE.
- The evidence graph `semantic_authority` is NONE.
- `protected_intent` is null. This package does not write a ProtectedIntent.

Digests are caller-supplied `sha256:` strings. The IR does not store raw audio, raw video, or frame bytes. Observation status stays UNVERIFIED. There is no confidence score.

## Out of scope

ProtectedIntent integration, category engines, provider adapters, and every other SPE lane.
"""
