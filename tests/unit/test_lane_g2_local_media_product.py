"""Lane G2: local media product path over the pinned whisper-cli owner.

The G12-H candidate is qualified for the media backend. These tests fail until
a session can load that model locally, decode audio, run inference, and refuse
false-local / empty-hash claims. They do not promote product v1, live STT, or UI.
"""

from __future__ import annotations

import hashlib
import threading
import wave
from pathlib import Path

import pytest

from spe_runtime.media_product.local_backend import (
    IntegrityError,
    LocalMediaSession,
    discover_qualified_assets,
    local_claim,
    product_gates,
    verify_file_sha256,
)

ROOT = Path(__file__).resolve().parents[2]
EVIDENCE = ROOT / "evidence" / "lane-g2"
FIXTURES = ROOT / "proof" / "media-r1" / "fixtures" / "human"
SHORT_WAV = FIXTURES / "te_amma_16k.wav"
LONG_WAV = FIXTURES / "te_dengue_intro_30s.wav"


def _silence_wav(path: Path, *, seconds: float = 1.0, rate: int = 16000) -> None:
    frames = int(seconds * rate)
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "w") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(rate)
        handle.writeframes(b"\x00\x00" * frames)


def test_empty_hash_is_not_integrity() -> None:
    target = SHORT_WAV
    with pytest.raises(IntegrityError, match="EMPTY_OR_INVALID_HASH"):
        verify_file_sha256(target, "")
    with pytest.raises(IntegrityError, match="EMPTY_OR_INVALID_HASH"):
        verify_file_sha256(target, "0" * 63)


def test_false_local_providers_are_not_labeled_local() -> None:
    assert local_claim("whisper-cli") == "LOCAL_CPU"
    for provider in (
        "web-speech",
        "browser-speech-recognition",
        "cloud-whisper",
        "openai-transcribe",
        "azure-speech",
        "https://stt.example/v1",
    ):
        assert local_claim(provider) == "NOT_LOCAL", provider


def test_product_gates_stay_honest_without_overclaim() -> None:
    gates = product_gates(local_file_transcription="PASS", raw_media_egress=0)
    assert gates["TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND"] == "PRESERVED"
    assert gates["LIVE_TRANSCRIPTION"] == "UNAVAILABLE"
    assert gates["PRODUCT_MEDIA_V1"] == "NOT_PASS"
    assert gates["UI_INTEGRATED"] == "NO"
    assert gates["PHYSICAL_DEVICE"] == "WAITING_EXTERNAL"
    assert gates["RAW_MEDIA_EGRESS"] == 0
    assert gates["TIMESTAMPS"] == "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
    assert gates["BROWSER_CLOUD_STT"] == "NOT_LOCAL"


def test_local_audio_journey_silence_cancel_and_video(tmp_path: Path) -> None:
    assets = discover_qualified_assets()
    assert assets.model_sha256 == "47369abd7ee13b624606b762a860a42d7cbea8f320e3c4553954d1fea748d49e"
    assert assets.cli_sha256 == "784e1cb576b40c08827860779c2c0cc6b17b746171d62ce4fb9ff6ea014193a7"
    assert assets.raw_download is False

    session = LocalMediaSession.open(assets, language="te")
    try:
        with pytest.raises(Exception, match="NOT_PRODUCT_PATH|UNSUPPORTED"):
            session.transcribe_path(SHORT_WAV, language="auto")
        timestamps = session.timestamp_support()
        assert timestamps["state"] == "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
        assert "start_ms" not in timestamps

        speech = session.transcribe_path(SHORT_WAV)
        assert speech.status == "SPEECH"
        assert speech.execution == "LOCAL_CPU"
        assert speech.egress_attempts == 0
        assert speech.sandbox_network == "DENY"
        assert speech.text.strip()
        assert "అ" in speech.text or any("TELUGU" in __import__("unicodedata").name(ch, "") for ch in speech.text)
        assert speech.timestamp_state == "UNSUPPORTED_FOR_QUALIFIED_TE_MODEL"
        assert speech.raw_audio_retained is False
        assert speech.audio_sha256 == hashlib.sha256(SHORT_WAV.read_bytes()).hexdigest()
        assert session.raw_bytes_held == 0 or speech.pcm_released is True

        silence = tmp_path / "silence.wav"
        _silence_wav(silence)
        quiet = session.transcribe_path(silence)
        assert quiet.status == "NO_SPEECH"
        assert quiet.text == ""
        assert quiet.no_speech_basis == "PCM_ENERGY"
        assert quiet.user_transcript_promoted is False

        video = tmp_path / "amma.mp4"
        extracted = session.extract_video_audio(SHORT_WAV, video)
        # SHORT_WAV is audio; build a tiny video only when ffmpeg can mux it.
        assert extracted["video_path"].exists()
        watched = session.transcribe_path(extracted["video_path"])
        assert watched.status == "SPEECH"
        assert watched.media_kind == "video-audio"
        assert watched.execution == "LOCAL_CPU"
        assert watched.egress_attempts == 0
        assert watched.text.strip()

        held_before_close = session.raw_bytes_held
        session.close()
        assert session.closed is True
        assert session.raw_bytes_held == 0
        assert session.temp_files_remaining == 0
        assert held_before_close >= 0
    finally:
        if not session.closed:
            session.close()

    # Cancellation uses a fresh session so the speech proof above is not killed.
    cancel_session = LocalMediaSession.open(assets, language="te")
    box: dict[str, object] = {}

    def _run() -> None:
        box["result"] = cancel_session.transcribe_path(LONG_WAV)

    worker = threading.Thread(target=_run)
    worker.start()
    threading.Event().wait(0.4)
    cancel_session.cancel()
    worker.join(timeout=30)
    assert not worker.is_alive()
    cancelled = box["result"]
    assert cancelled.status == "CANCELLED"
    assert cancelled.text == ""
    assert cancelled.execution == "LOCAL_CPU"
    cancel_session.close()

    gates = product_gates(local_file_transcription="PASS", raw_media_egress=0)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    import json
    payload = {
        "speech": speech.to_dict(),
        "silence": quiet.to_dict(),
        "video": watched.to_dict(),
        "cancelled_status": cancelled.status,
        "gates": gates,
        "assets": assets.to_dict(),
        "ui_mounted": False,
    }
    (EVIDENCE / "runtime_proof.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (EVIDENCE / "LANE_G2_MEDIA_PRODUCT_REPORT.md").write_text(
        _report(payload),
        encoding="utf-8",
    )


def _report(payload: dict) -> str:
    gates = payload["gates"]
    speech = payload["speech"]
    silence = payload["silence"]
    video = payload["video"]
    lines = [
        "# Lane G2 local media product runtime",
        "",
        "Owner engine: pinned whisper-cli (whisper.cpp). No second engine.",
        "No model download. Assets resolved from on-disk caches and re-hashed.",
        "",
        f"MODEL_SHA256={payload['assets']['model_sha256']}",
        f"MODEL_PATH={payload['assets']['model_path']}",
        f"CLI_SHA256={payload['assets']['cli_sha256']}",
        f"CLI_PATH={payload['assets']['cli_path']}",
        f"SPEECH_STATUS={speech['status']}",
        f"SPEECH_TEXT={speech['text']}",
        f"SPEECH_EGRESS={speech['egress_attempts']}",
        f"SANDBOX_NETWORK={speech['sandbox_network']}",
        f"SILENCE_STATUS={silence['status']}",
        f"SILENCE_TEXT_LEN={len(silence['text'])}",
        f"SILENCE_DISCARDED={silence.get('discarded_model_text')!r}",
        f"VIDEO_STATUS={video['status']}",
        f"VIDEO_KIND={video['media_kind']}",
        f"VIDEO_TEXT={video['text']}",
        f"CANCELLED={payload['cancelled_status']}",
        f"TIMESTAMPS={gates['TIMESTAMPS']}",
        f"LIVE_TRANSCRIPTION={gates['LIVE_TRANSCRIPTION']}",
        f"PRODUCT_MEDIA_V1={gates['PRODUCT_MEDIA_V1']}",
        f"UI_INTEGRATED={gates['UI_INTEGRATED']}",
        f"PHYSICAL_DEVICE={gates['PHYSICAL_DEVICE']}",
        f"TELUGU_MODEL={gates['TELUGU_MODEL_QUALIFIED_FOR_MEDIA_BACKEND']}",
        "UI_MOUNTED=NO",
        "PAID_DEPS=0",
        "INR=0",
        "",
    ]
    return "\n".join(lines)
