"""Local media product session over the pinned whisper.cpp CLI.

This is not a second recognition engine. Inference is the already-qualified
`whisper-cli` binary and the Telugu ggml candidate already on disk. The session
owns load checks, decode, cancellation, silence truth, and explicit
unsupported states. It does not claim live transcription, product media v1,
or a mounted UI.
"""

from __future__ import annotations

import array
import hashlib
import os
import signal
import subprocess
import threading
import wave
from dataclasses import dataclass
from pathlib import Path

HEX = frozenset("0123456789abcdef")
PINNED_CLI_SHA256 = "784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7"
PINNED_TE_MODEL_SHA256 = "47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e"
SOURCE_PIN = "927cfce34f31707e17f2bff35c349632fb9e2c3a"
SANDBOX_PROFILE = "(version 1)(allow default)(deny network*)"
_NON_LOCAL = (
    "browser",
    "web-speech",
    "webspeech",
    "cloud",
    "remote",
    "openai",
    "azure",
    "google",
    "aws",
    "http://",
    "https://",
)
_VIDEO_SUFFIXES = {".mp4", ".mov", ".mkv", ".webm", ".m4v"}
_CLI_CANDIDATES = (
    Path("/Volumes/4TB-WD/spe-worktrees/spe-g12h-te-indep-qual-20261001/proof/media-r1/whisper-cli"),
    Path("/Volumes/4TB-WD/spe-worktrees/spe-g12c-media-backend-qual-20261001/proof/media-r1/build/whisper-cmake/bin/whisper-cli"),
)
_MODEL_CANDIDATES = (
    Path("/Volumes/4TB-WD/spe-worktrees/spe-g12h-te-indep-qual-20261001/proof/media-r1/models/ggml-te-small.bin"),
    Path("/Volumes/4TB-WD/spe-worktrees/spe-g12g-te-human-bench-20261001/proof/media-r1/models/ggml-te-small.bin"),
)


class IntegrityError(ValueError):
    """Model or binary hash is missing, empty, or not the pinned digest."""


class UnsupportedPath(RuntimeError):
    """Caller asked for a path this qualified local backend will not pretend to serve."""


class FalseLocalError(RuntimeError):
    """A browser or cloud provider was presented as local execution."""


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_file_sha256(path: Path, expected: str) -> str:
    """On-demand integrity. An empty or short hash is never a pass."""
    token = expected if isinstance(expected, str) else ""
    if len(token) != 64 or any(char not in HEX for char in token.lower()):
        raise IntegrityError("EMPTY_OR_INVALID_HASH")
    got = _sha256_file(Path(path))
    if got != token.lower():
        raise IntegrityError(f"HASH_MISMATCH:{got}")
    return got


def local_claim(provider: str) -> str:
    """Return LOCAL_CPU only for the pinned CLI. Browser/cloud stay NOT_LOCAL."""
    name = str(provider).strip().lower().replace("_", "-")
    if any(marker in name for marker in _NON_LOCAL):
        return "NOT_LOCAL"
    if name in {"whisper-cli", "local-cpu", "pinned-whisper-cpp"}:
        return "LOCAL_CPU"
    return "UNSUPPORTED"


def product_gates(*, local_file_transcription: str, raw_media_egress: int) -> dict[str, object]:
    """Honest gates. A proven file journey does not flip v1, live, UI, or device."""
    return {
        "TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND": "PRESERVED",
        "LIVE_TRANSCRIPTION": "UNAVAILABLE",
        "PRODUCT_MEDIA_V1": "NOT_PASS",
        "UI_INTEGRATED": "NO",
        "UI_MOUNTED": "NO",
        "PHYSICAL_DEVICE": "WAITING_EXTERNAL",
        "RAW_MEDIA_EGRESS": raw_media_egress,
        "TIMESTAMPS": "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
        "BROWSER_CLOUD_STT": "NOT_LOCAL",
        "LOCAL_FILE_TRANSCRIPTION": local_file_transcription,
    }


@dataclass(frozen=True)
class QualifiedAssets:
    cli_path: Path
    cli_sha256: str
    model_path: Path
    model_sha256: str
    raw_download: bool = False

    def to_dict(self) -> dict[str, object]:
        return {
            "cli_path": str(self.cli_path),
            "cli_sha256": self.cli_sha256,
            "model_path": str(self.model_path),
            "model_sha256": self.model_sha256,
            "raw_download": self.raw_download,
            "source_pin": SOURCE_PIN,
        }


def _first_verified(candidates: tuple[Path, ...], expected: str) -> tuple[Path, str]:
    errors: list[str] = []
    for candidate in candidates:
        if not candidate.exists():
            errors.append(f"missing:{candidate}")
            continue
        try:
            got = verify_file_sha256(candidate, expected)
        except IntegrityError as exc:
            errors.append(f"{candidate}:{exc}")
            continue
        return candidate.resolve(), got
    raise IntegrityError("PINNED_ASSET_NOT_ON_DISK:" + ";".join(errors))


def discover_qualified_assets() -> QualifiedAssets:
    """Resolve the qualified CLI and Telugu model from local caches. Never downloads."""
    cli_path, cli_sha = _first_verified(_CLI_CANDIDATES, PINNED_CLI_SHA256)
    model_path, model_sha = _first_verified(_MODEL_CANDIDATES, PINNED_TE_MODEL_SHA256)
    return QualifiedAssets(
        cli_path=cli_path,
        cli_sha256=cli_sha,
        model_path=model_path,
        model_sha256=model_sha,
        raw_download=False,
    )


@dataclass(frozen=True)
class LocalTranscript:
    status: str
    text: str
    execution: str
    egress_attempts: int
    sandbox_network: str
    timestamp_state: str
    raw_audio_retained: bool
    audio_sha256: str
    media_kind: str
    pcm_released: bool
    no_speech_basis: str | None = None
    user_transcript_promoted: bool = False
    discarded_model_text: str | None = None
    duration_ms: int = 0

    def to_dict(self) -> dict[str, object]:
        return {
            "status": self.status,
            "text": self.text,
            "execution": self.execution,
            "egress_attempts": self.egress_attempts,
            "sandbox_network": self.sandbox_network,
            "timestamp_state": self.timestamp_state,
            "raw_audio_retained": self.raw_audio_retained,
            "audio_sha256": self.audio_sha256,
            "media_kind": self.media_kind,
            "pcm_released": self.pcm_released,
            "no_speech_basis": self.no_speech_basis,
            "user_transcript_promoted": self.user_transcript_promoted,
            "discarded_model_text": self.discarded_model_text,
            "duration_ms": self.duration_ms,
        }



def _wav_usable(path: Path) -> bool:
    try:
        with wave.open(str(path), "rb") as handle:
            return handle.getnchannels() == 1 and handle.getsampwidth() == 2 and handle.getframerate() == 16000
    except wave.Error:
        return False


def _wav_duration_ms(path: Path) -> int:
    with wave.open(str(path), "rb") as handle:
        rate = handle.getframerate() or 1
        return int(handle.getnframes() * 1000 / rate)


def _ffmpeg() -> str:
    for candidate in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg"):
        if candidate == "ffmpeg":
            return candidate
        if Path(candidate).exists():
            return candidate
    return "ffmpeg"


def _run_ffmpeg(args: list[str]) -> None:
    completed = subprocess.run(args, capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise UnsupportedPath(
            "VIDEO_AUDIO_EXTRACT_FAILED:" + (completed.stderr or "")[-400:]
        )


class LocalMediaSession:
    """One local CPU session. Raw samples are dropped on close. Network is denied."""

    def __init__(self, assets: QualifiedAssets, *, language: str) -> None:
        if local_claim("whisper-cli") != "LOCAL_CPU":
            raise FalseLocalError("pinned CLI must stay local")
        if language != "te":
            raise UnsupportedPath("AUTO_OR_OTHER_NOT_PRODUCT_PATH")
        self.assets = assets
        self.language = language
        verify_file_sha256(assets.cli_path, assets.cli_sha256)
        verify_file_sha256(assets.model_path, assets.model_sha256)
        self._cancel_event = threading.Event()
        self._proc: subprocess.Popen[str] | None = None
        self._temps: list[Path] = []
        self._buffers: list[bytearray] = []
        self.closed = False
        self._pcm_released = False

    @classmethod
    def open(cls, assets: QualifiedAssets, *, language: str = "te") -> LocalMediaSession:
        return cls(assets, language=language)

    @property
    def raw_bytes_held(self) -> int:
        return sum(len(buf) for buf in self._buffers)

    @property
    def temp_files_remaining(self) -> int:
        return sum(1 for path in self._temps if path.exists())

    def timestamp_support(self) -> dict[str, str]:
        """Qualified Telugu decode uses -nt. Do not invent word times."""
        return {
            "state": "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
            "reason": "ggml-te-small product path requires whisper-cli -nt",
        }

    def cancel(self) -> None:
        self._cancel_event.set()
        proc = self._proc
        if proc is not None and proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                return

    def close(self) -> None:
        self.cancel()
        for buf in self._buffers:
            buf.clear()
        self._buffers.clear()
        for path in self._temps:
            path.unlink(missing_ok=True)
        self._pcm_released = True
        self.closed = True

    def extract_video_audio(self, audio_wav: Path, dest_mp4: Path) -> dict[str, Path]:
        """Mux a local video container around already-decoded audio. No download."""
        dest_mp4.parent.mkdir(parents=True, exist_ok=True)
        _run_ffmpeg(
            [
                _ffmpeg(),
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=black:s=160x120:d=3",
                "-i",
                str(audio_wav),
                "-shortest",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                str(dest_mp4),
            ]
        )
        return {"video_path": dest_mp4}

    def transcribe_path(self, path: Path, *, language: str | None = None) -> LocalTranscript:
        if self.closed:
            raise UnsupportedPath("SESSION_CLOSED")
        lang = self.language if language is None else language
        if lang != "te":
            raise UnsupportedPath("AUTO_OR_OTHER_NOT_PRODUCT_PATH")
        source = Path(path)
        media_kind = "video-audio" if source.suffix.lower() in _VIDEO_SUFFIXES else "audio"
        wav_path, duration_ms = self._to_wav(source, media_kind)
        audio_sha = hashlib.sha256(source.read_bytes()).hexdigest()
        peak = self._peak_abs(wav_path)
        if peak <= 8:
            self._release_pcm()
            return LocalTranscript(
                status="NO_SPEECH",
                text="",
                execution="LOCAL_CPU",
                egress_attempts=0,
                sandbox_network="DENY",
                timestamp_state="UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
                raw_audio_retained=False,
                audio_sha256=audio_sha,
                media_kind=media_kind,
                pcm_released=True,
                no_speech_basis="PCM_ENERGY",
                user_transcript_promoted=False,
                discarded_model_text=None,
                duration_ms=duration_ms,
            )
        if self._cancel_event.is_set():
            self._release_pcm()
            return self._cancelled(audio_sha, media_kind, duration_ms)
        stdout, returncode = self._infer(wav_path)
        self._release_pcm()
        if self._cancel_event.is_set() or returncode < 0:
            return self._cancelled(audio_sha, media_kind, duration_ms)
        if returncode != 0:
            raise UnsupportedPath(f"INFERENCE_FAILED:{returncode}")
        text = stdout.strip()
        if not text:
            return LocalTranscript(
                status="NO_SPEECH",
                text="",
                execution="LOCAL_CPU",
                egress_attempts=0,
                sandbox_network="DENY",
                timestamp_state="UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
                raw_audio_retained=False,
                audio_sha256=audio_sha,
                media_kind=media_kind,
                pcm_released=True,
                no_speech_basis="EMPTY_MODEL_TEXT",
                user_transcript_promoted=False,
                duration_ms=duration_ms,
            )
        return LocalTranscript(
            status="SPEECH",
            text=text,
            execution="LOCAL_CPU",
            egress_attempts=0,
            sandbox_network="DENY",
            timestamp_state="UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
            raw_audio_retained=False,
            audio_sha256=audio_sha,
            media_kind=media_kind,
            pcm_released=True,
            user_transcript_promoted=True,
            duration_ms=duration_ms,
        )

    def _cancelled(self, audio_sha: str, media_kind: str, duration_ms: int) -> LocalTranscript:
        return LocalTranscript(
            status="CANCELLED",
            text="",
            execution="LOCAL_CPU",
            egress_attempts=0,
            sandbox_network="DENY",
            timestamp_state="UNSUPPORTED_FOR_QUALIFIED_TE_MODEL",
            raw_audio_retained=False,
            audio_sha256=audio_sha,
            media_kind=media_kind,
            pcm_released=True,
            user_transcript_promoted=False,
            duration_ms=duration_ms,
        )

    def _release_pcm(self) -> None:
        for buf in self._buffers:
            buf.clear()
        self._buffers.clear()
        self._pcm_released = True

    def _to_wav(self, source: Path, media_kind: str) -> tuple[Path, int]:
        if media_kind == "audio" and source.suffix.lower() == ".wav" and _wav_usable(source):
            return source, _wav_duration_ms(source)
        dest = source.with_suffix(".lane-g2.wav")
        if dest.exists():
            dest = source.parent / f"{source.stem}.lane-g2-{os.getpid()}.wav"
        self._temps.append(dest)
        _run_ffmpeg(
            [
                _ffmpeg(),
                "-y",
                "-i",
                str(source),
                "-vn",
                "-ac",
                "1",
                "-ar",
                "16000",
                "-c:a",
                "pcm_s16le",
                str(dest),
            ]
        )
        return dest, _wav_duration_ms(dest)

    def _peak_abs(self, wav_path: Path) -> int:
        with wave.open(str(wav_path), "rb") as handle:
            frames = handle.readframes(handle.getnframes())
        buf = bytearray(frames)
        self._buffers.append(buf)
        if len(buf) < 2:
            return 0
        samples = array.array("h")
        usable = len(buf) - (len(buf) % 2)
        samples.frombytes(bytes(buf[:usable]))
        if not samples:
            return 0
        return max(abs(sample) for sample in samples)

    def _infer(self, wav_path: Path) -> tuple[str, int]:
        if self._cancel_event.is_set():
            return "", -1
        cmd = [
            "/usr/bin/sandbox-exec",
            "-p",
            SANDBOX_PROFILE,
            str(self.assets.cli_path),
            "-m",
            str(self.assets.model_path),
            "-f",
            str(wav_path),
            "-l",
            "te",
            "-nt",
            "-np",
            "-t",
            "2",
            "-p",
            "1",
            "-bo",
            "5",
            "-bs",
            "5",
            "-tp",
            "0",
            "-fa",
            "-ng",
        ]
        if any(token.startswith("http://") or token.startswith("https://") for token in cmd):
            raise FalseLocalError("local command must not carry a remote URL")
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,
        )
        self._proc = proc
        if self._cancel_event.is_set():
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
        stdout, _stderr = proc.communicate()
        return stdout or "", int(proc.returncode or 0)
