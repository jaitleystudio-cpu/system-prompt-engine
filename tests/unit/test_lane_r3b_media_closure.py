"""R3-B media closure over the pinned whisper-cli. No second engine.

PRODUCT_MEDIA_V1 stays NOT_PASS: the shell has not mounted the journey.
"""

from __future__ import annotations

import hashlib
import json
import socket
import subprocess
import threading
import wave
from pathlib import Path

import pytest

from spe_runtime.media_product.local_backend import (
    LocalMediaSession,
    discover_qualified_assets,
    parse_segment_timestamps,
    product_gates,
    resolve_media_mode,
    sandbox_blocks_network,
    segments_fit_duration,
    trace_raw_media_egress,
    accepted_progress,
)

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "evidence" / "lane-r3b"
FIXTURES = ROOT / "proof" / "media-r1" / "fixtures" / "human"
SHORT_WAV = FIXTURES / "te_amma_16k.wav"
LONG_WAV = FIXTURES / "te_dengue_intro_30s.wav"
FFMPEG = "/opt/homebrew/bin/ffmpeg"
WASM_PIN = "b707f5eb480adc166f8b5b0df733e742a08a476c89c3f99b90ad63a61c11199b"


def _silence_wav(path: Path, *, seconds: float = 1.0, rate: int = 16000) -> None:
    frames = int(seconds * rate)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(b"\x00\x00" * frames)


def _ffmpeg(args: list[str]) -> None:
    completed = subprocess.run([FFMPEG, *args], capture_output=True, text=True, check=False)
    if completed.returncode != 0:
        raise AssertionError(completed.stderr[-500:])


def test_modes_reject_false_neural_and_unusable_progress() -> None:
    assert resolve_media_mode(provider="whisper-cli", assets_ready=True, neural_session_ran=True) == "LOCAL_NEURAL"
    assert resolve_media_mode(provider="whisper-cli", assets_ready=True, neural_session_ran=False) == "LOCAL_FALLBACK"
    assert resolve_media_mode(provider="web-speech", assets_ready=True, neural_session_ran=True) == "BROWSER_SERVICE"
    assert resolve_media_mode(provider="browser-speech-recognition", assets_ready=False, neural_session_ran=False) == "BROWSER_SERVICE"
    assert resolve_media_mode(provider="whisper-cli", assets_ready=False, neural_session_ran=False) == "UNAVAILABLE"
    assert resolve_media_mode(provider="https://stt.example/v1", assets_ready=True, neural_session_ran=True) == "UNAVAILABLE"
    assert accepted_progress("whisper_print_progress_callback: progress = 1421%") == (None, "UNUSABLE_CALLBACK")
    fitted = parse_segment_timestamps("[00:00:00.000 --> 00:00:02.000] అమ్మా")
    assert segments_fit_duration(fitted, 2113) is True
    bogus = parse_segment_timestamps("[00:00:00.000 --> 00:00:30.000] అమ్మా")
    assert segments_fit_duration(bogus, 2113) is False
    gates = product_gates(local_file_transcription="PASS", raw_media_egress=0)
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert gates["UI_MOUNTED"] == "NO"
    assert gates["SHELL_MOUNT"] == "REQUIRED"
    assert gates["LIVE_TRANSCRIPTION"] == "UNAVAILABLE"


def test_corrupt_silence_no_audio_retry_and_command_shape(tmp_path: Path) -> None:
    assets = discover_qualified_assets()
    session = LocalMediaSession.open(assets, language="te")
    try:
        corrupt = tmp_path / "corrupt.bin"
        corrupt.write_bytes(b"this is not media")
        bad = session.transcribe_path(corrupt)
        assert bad.status == "ERROR"
        assert bad.error_code == "CORRUPT"
        assert bad.mode == "LOCAL_FALLBACK"
        assert bad.neural_session_ran is False
        assert bad.text == ""
        assert bad.egress_attempts == 0

        retried_silence = tmp_path / "silence.wav"
        _silence_wav(retried_silence)
        quiet = session.retry(retried_silence)
        assert quiet.status == "NO_SPEECH"
        assert quiet.text == ""
        assert quiet.no_speech_basis == "PCM_ENERGY"
        assert quiet.mode == "LOCAL_FALLBACK"
        assert quiet.neural_session_ran is False
        assert quiet.attempts == 2

        silent_video = tmp_path / "silent.mp4"
        _ffmpeg(["-y", "-f", "lavfi", "-i", "color=c=black:s=160x120:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(silent_video)])
        empty = session.transcribe_path(silent_video)
        assert empty.status == "ERROR"
        assert empty.error_code == "NO_AUDIO_TRACK"
        assert empty.mode == "LOCAL_FALLBACK"
        assert empty.neural_session_ran is False
        assert empty.text == ""

        command = session.infer_command(SHORT_WAV, no_timestamps=True)
        assert command[0] == "/usr/bin/sandbox-exec"
        assert "-nt" in command
        assert "https://" not in " ".join(command)
        assert str(assets.model_path) in command
    finally:
        session.close()


def test_local_journey_unicode_video_long_cancel_offline_and_egress(tmp_path: Path) -> None:
    assets = discover_qualified_assets()
    notes: list[dict[str, object]] = []
    session = LocalMediaSession.open(assets, language="te", on_progress=notes.append)
    wasm_before = (ROOT / "apps/web/public/spe_wasm.wasm").read_bytes()
    assert WASM_PIN not in wasm_before.decode("latin1")
    try:
        with trace_raw_media_egress() as attempts:
            speech = session.transcribe_path(SHORT_WAV)
        assert attempts == []
        assert speech.status == "SPEECH"
        assert speech.mode == "LOCAL_NEURAL"
        assert speech.neural_session_ran is True
        assert "అమ్మా" in speech.text
        assert any("\u0c00" <= ch <= "\u0c7f" for ch in speech.text)
        assert speech.timestamps_proven is False
        assert speech.segments == ()
        assert speech.timestamp_state == "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
        assert speech.egress_attempts == 0
        assert speech.sandbox_network == "DENY"
        assert speech.execution == "LOCAL_CPU"
        assert speech.progress_state in {"NOT_REPORTED", "UNUSABLE_CALLBACK", "MODEL_PERCENT"}
        if speech.progress_percent is not None:
            assert 0 <= speech.progress_percent <= 100
        assert any(note.get("phase") == "transcribing" for note in notes)

        probe = session.probe_segment_timestamps(SHORT_WAV)
        assert probe["timestamps_proven"] is False
        assert probe["timestamp_state"] == "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
        assert probe["segments"] == []

        video = tmp_path / "amma.mp4"
        session.extract_video_audio(SHORT_WAV, video)
        watched = session.transcribe_path(video)
        assert watched.status == "SPEECH"
        assert watched.media_kind == "video-audio"
        assert watched.mode == "LOCAL_NEURAL"
        assert watched.neural_session_ran is True
        assert "అమ్మా" in watched.text
        assert watched.egress_attempts == 0
        assert watched.timestamps_proven is False

        long_result = session.transcribe_path(LONG_WAV)
        assert long_result.status == "SPEECH"
        assert long_result.mode == "LOCAL_NEURAL"
        assert long_result.duration_ms >= 25000
        assert any("\u0c00" <= ch <= "\u0c7f" for ch in long_result.text)
        assert long_result.timestamps_proven is False
        assert long_result.egress_attempts == 0

        offline = sandbox_blocks_network()
        assert offline["denied"] is True
        assert offline["returncode"] != 0
    finally:
        session.close()

    cancel_session = LocalMediaSession.open(assets, language="te")
    box: dict[str, object] = {}

    def _run() -> None:
        with trace_raw_media_egress() as cancel_attempts:
            box["attempts"] = cancel_attempts
            box["result"] = cancel_session.transcribe_path(LONG_WAV)

    worker = threading.Thread(target=_run)
    worker.start()
    threading.Event().wait(0.4)
    cancel_session.cancel()
    worker.join(timeout=40)
    assert not worker.is_alive()
    cancelled = box["result"]
    assert cancelled.status == "CANCELLED"
    assert cancelled.text == ""
    assert cancelled.error_code == "CANCELLED"
    if cancelled.neural_session_ran:
        assert cancelled.mode == "LOCAL_NEURAL"
    else:
        assert cancelled.mode == "LOCAL_FALLBACK"
    assert box["attempts"] == []
    cancel_session.close()

    wasm_after = (ROOT / "apps/web/public/spe_wasm.wasm").read_bytes()
    assert hashlib.sha256(wasm_after).hexdigest() == hashlib.sha256(wasm_before).hexdigest()

    gates = product_gates(local_file_transcription="PASS", raw_media_egress=0, browser_journey="NOT_RUN")
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    payload = {
        "speech": speech.to_dict(),
        "video": watched.to_dict(),
        "long": long_result.to_dict(),
        "timestamp_probe": probe,
        "cancelled_status": cancelled.status,
        "cancelled_mode": cancelled.mode,
        "offline": offline,
        "raw_media_egress": 0,
        "gates": gates,
        "assets": assets.to_dict(),
        "mode_executed_for_speech": speech.mode,
        "timestamps_proven": False,
        "product_media_v1": "NOT_PASS",
        "shell_mount": "REQUIRED",
        "wasm_pin_unchanged": WASM_PIN,
        "device_mic": "NONE",
        "live_stt": "UNAVAILABLE",
        "inr": 0,
    }
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    (EVIDENCE / "runtime_proof.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def test_socket_guard_counts_an_attempt_without_being_the_product_path() -> None:
    with trace_raw_media_egress() as attempts:
        try:
            socket.create_connection(("127.0.0.1", 9), timeout=0.2)
        except OSError:
            pass
    assert attempts
    assert attempts[0]["kind"] == "socket.create_connection"
    assert attempts[0]["host"] == "127.0.0.1"
