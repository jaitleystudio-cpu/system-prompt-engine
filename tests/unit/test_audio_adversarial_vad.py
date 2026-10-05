"""Adversarial VAD & Non-Speech Hallucination Suppression Qualification.

Tests:
1. Silence -> NO_SPEECH (basis: PCM_ENERGY)
2. 440 Hz pure tone -> NO_SPEECH (basis: PURE_TONE or EMPTY_MODEL_TEXT, text="")
3. Dual 440+880 Hz tone -> NO_SPEECH (text="")
4. Stationary white noise -> NO_SPEECH (text="")
5. Real Human Telugu speech (te_amma_16k.wav) -> SPEECH (text contains Telugu, e.g. 'అమ్మా')
6. Session reuse / stale transcript defense: Speech followed by pure tone in same session
   verifies that pure tone does NOT leak prior speech text.
"""

from __future__ import annotations

import math
import random
import struct
import tempfile
import wave
from pathlib import Path

import pytest

from spe_runtime.media_product.local_backend import (
    IntegrityError,
    LocalMediaSession,
    discover_qualified_assets,
)

FIXTURES_DIR = (
    Path(__file__).resolve().parents[2] / "apps" / "web" / "scripts" / "fixtures" / "media"
)


def _write_wav(path: Path, samples: list[int], sample_rate: int = 16000) -> None:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        raw = struct.pack(f"<{len(samples)}h", *samples)
        handle.writeframes(raw)


@pytest.fixture(scope="module")
def session():
    try:
        assets = discover_qualified_assets()
    except IntegrityError as exc:
        if "UNSUPPORTED_ARCHITECTURE" in str(exc) or "PINNED_ASSET_NOT_ON_DISK" in str(exc):
            pytest.skip(f"Local media backend requires macOS arm64: {exc}")
        raise
    sess = LocalMediaSession.open(assets, language="te")
    yield sess
    sess.close()


def test_acoustic_gating_silence_cross_platform(tmp_path: Path):
    silence_wav = tmp_path / "silence_direct.wav"
    samples = [0] * (16000 * 2)
    _write_wav(silence_wav, samples)
    class DummySession:
        def __init__(self):
            self._buffers = []
    dummy = DummySession()
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, silence_wav)
    assert not is_speech
    assert basis == "PCM_ENERGY"


def test_acoustic_gating_pure_tone_cross_platform(tmp_path: Path):
    tone_wav = tmp_path / "tone_direct.wav"
    samples = [int(16000 * math.sin(2 * math.pi * 440.0 * i / 16000)) for i in range(16000 * 2)]
    _write_wav(tone_wav, samples)
    class DummySession:
        def __init__(self):
            self._buffers = []
    dummy = DummySession()
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, tone_wav)
    assert not is_speech
    assert basis == "PURE_TONE"


def test_acoustic_gating_white_noise_cross_platform(tmp_path: Path):
    noise_wav = tmp_path / "noise_direct.wav"
    rng = random.Random(42)
    samples = [int(rng.uniform(-10000, 10000)) for _ in range(16000 * 2)]
    _write_wav(noise_wav, samples)
    class DummySession:
        def __init__(self):
            self._buffers = []
    dummy = DummySession()
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, noise_wav)
    assert not is_speech
    assert basis == "STATIONARY_NOISE"


def test_silence_produces_no_speech(session: LocalMediaSession, tmp_path: Path):
    silence_wav = tmp_path / "silence.wav"
    samples = [0] * (16000 * 2)  # 2 seconds of zeros
    _write_wav(silence_wav, samples)

    result = session.transcribe_path(silence_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""
    assert result.no_speech_basis == "PCM_ENERGY"


def test_pure_tone_440hz_suppressed_no_hallucination(session: LocalMediaSession, tmp_path: Path):
    tone_wav = tmp_path / "tone_440.wav"
    duration = 2.0
    sr = 16000
    freq = 440.0
    samples = [
        int(16000 * math.sin(2 * math.pi * freq * i / sr))
        for i in range(int(sr * duration))
    ]
    _write_wav(tone_wav, samples)

    result = session.transcribe_path(tone_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""
    assert result.no_speech_basis in {"PURE_TONE", "EMPTY_MODEL_TEXT"}


def test_dual_tone_suppressed(session: LocalMediaSession, tmp_path: Path):
    dual_wav = tmp_path / "dual_tone.wav"
    duration = 2.0
    sr = 16000
    samples = [
        int(8000 * (math.sin(2 * math.pi * 440 * i / sr) + math.sin(2 * math.pi * 880 * i / sr)))
        for i in range(int(sr * duration))
    ]
    _write_wav(dual_wav, samples)

    result = session.transcribe_path(dual_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""


def test_chord_suppressed(session: LocalMediaSession, tmp_path: Path):
    chord_wav = tmp_path / "chord.wav"
    duration = 2.0
    sr = 16000
    samples = [
        int(5000 * (math.sin(2 * math.pi * 440 * i / sr) + math.sin(2 * math.pi * 554.37 * i / sr) + math.sin(2 * math.pi * 659.25 * i / sr)))
        for i in range(int(sr * duration))
    ]
    _write_wav(chord_wav, samples)

    result = session.transcribe_path(chord_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""


def test_frequency_sweep_suppressed(session: LocalMediaSession, tmp_path: Path):
    sweep_wav = tmp_path / "sweep.wav"
    duration = 2.0
    sr = 16000
    N = int(sr * duration)
    samples = [int(16000 * math.sin(2 * math.pi * (200 + 1800 * i / N / 2) * i / sr)) for i in range(N)]
    _write_wav(sweep_wav, samples)

    result = session.transcribe_path(sweep_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""


def test_white_noise_suppressed(session: LocalMediaSession, tmp_path: Path):
    noise_wav = tmp_path / "white_noise.wav"
    duration = 2.0
    sr = 16000
    rng = random.Random(42)
    samples = [int(rng.uniform(-10000, 10000)) for _ in range(int(sr * duration))]
    _write_wav(noise_wav, samples)

    result = session.transcribe_path(noise_wav)
    assert result.status == "NO_SPEECH"
    assert result.text == ""
    assert result.no_speech_basis in {"STATIONARY_NOISE", "EMPTY_MODEL_TEXT"}


def test_human_telugu_speech_transcribes_accurately(session: LocalMediaSession):
    speech_path = FIXTURES_DIR / "te_amma_16k.wav"
    assert speech_path.exists(), f"Missing fixture {speech_path}"

    result = session.transcribe_path(speech_path)
    assert result.status == "SPEECH"
    assert result.mode == "LOCAL_NEURAL"
    assert "అమ్మా" in result.text or "అమ్మ" in result.text


def test_stale_transcript_defense_across_invocations(session: LocalMediaSession, tmp_path: Path):
    """Ensure subsequent calls in same session do not leak prior transcript."""
    speech_path = FIXTURES_DIR / "te_amma_16k.wav"
    res1 = session.transcribe_path(speech_path)
    assert res1.status == "SPEECH"
    assert res1.text != ""

    # Next call: pure tone
    tone_wav = tmp_path / "post_speech_tone.wav"
    samples = [
        int(16000 * math.sin(2 * math.pi * 440 * i / 16000))
        for i in range(16000 * 2)
    ]
    _write_wav(tone_wav, samples)
    res2 = session.transcribe_path(tone_wav)
    assert res2.status == "NO_SPEECH"
    assert res2.text == ""
    assert "అమ్మ" not in res2.text
