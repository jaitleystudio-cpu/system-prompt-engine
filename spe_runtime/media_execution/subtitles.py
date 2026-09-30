"""SRT/VTT rendering for caller-supplied cues. Not a transcription engine."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Cue:
    start_ms: int
    end_ms: int
    text: str


def render_srt(cues: tuple[Cue, ...]) -> str:
    """Render SubRip cues. Rejects inverted or overlapping timestamps."""
    _validate_cue_order(cues)
    blocks: list[str] = []
    for index, cue in enumerate(cues, start=1):
        blocks.append(
            f"{index}\n{_format_timestamp(cue.start_ms, ',')}"
            f" --> {_format_timestamp(cue.end_ms, ',')}\n{cue.text}"
        )
    return "\n\n".join(blocks)


def render_vtt(cues: tuple[Cue, ...]) -> str:
    """Render WebVTT cues. Rejects inverted or overlapping timestamps."""
    _validate_cue_order(cues)
    body = "\n\n".join(
        f"{_format_timestamp(cue.start_ms, '.')} --> {_format_timestamp(cue.end_ms, '.')}\n{cue.text}"
        for cue in cues
    )
    if not body:
        return "WEBVTT\n"
    return f"WEBVTT\n\n{body}\n"


def _validate_cue_order(cues: tuple[Cue, ...]) -> None:
    previous_end = 0
    for index, cue in enumerate(cues):
        if not isinstance(cue.text, str) or "\n" in cue.text or "\r" in cue.text:
            raise ValueError("cue text must be a single line")
        if cue.start_ms < 0 or cue.end_ms <= cue.start_ms:
            raise ValueError("timestamp order")
        if index > 0 and cue.start_ms < previous_end:
            raise ValueError("timestamp order")
        previous_end = cue.end_ms


def _format_timestamp(total_ms: int, millis_sep: str) -> str:
    hours, remainder = divmod(total_ms, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    seconds, millis = divmod(remainder, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}{millis_sep}{millis:03d}"
