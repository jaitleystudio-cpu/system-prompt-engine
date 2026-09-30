"""Fail-closed local media gate. Transcription is not implemented."""

from spe_runtime.media_execution.execute import execute_media
from spe_runtime.media_execution.models import MediaExecutionResult
from spe_runtime.media_execution.subtitles import Cue, render_srt, render_vtt

__all__ = [
    "Cue",
    "MediaExecutionResult",
    "execute_media",
    "render_srt",
    "render_vtt",
]
