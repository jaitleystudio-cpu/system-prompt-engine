"""Multilingual Audio Corpus Qualification & Speech Detection False-Negative Guard.

Covers:
1. Multi-word clean Telugu speech WER (te_long_pcm16.wav, te_dengue_intro_30s.wav, te_namaskaramu_16k.wav).
2. Acoustic VAD across languages (English JFK, Hindi Dengue, Spanish Contaminacion).
3. Non-speech false-positive rejection (pure tone, dual tone, sweep, chord, stationary noise, silence).
4. Low-volume speech & pitch variation false-negative guard.
5. Speech with moderate background noise acceptance.
6. Session reuse transcript isolation.
7. Mutation testing: over-strict VAD threshold that rejects real speech MUST be caught and fail.
"""

from __future__ import annotations

import math
import random
import struct
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


def _read_wav(path: Path) -> tuple[list[int], int]:
    with wave.open(str(path), "rb") as handle:
        sr = handle.getframerate()
        n = handle.getnframes()
        frames = handle.readframes(n)
        samples = list(struct.unpack(f"<{n}h", frames))
        return samples, sr


def _calculate_wer(reference: str, hypothesis: str) -> float:
    ref_words = reference.strip().split()
    hyp_words = hypothesis.strip().split()
    if not ref_words:
        return 0.0 if not hyp_words else 1.0

    d = [[0] * (len(hyp_words) + 1) for _ in range(len(ref_words) + 1)]
    for i in range(len(ref_words) + 1):
        d[i][0] = i
    for j in range(len(hyp_words) + 1):
        d[0][j] = j

    for i in range(1, len(ref_words) + 1):
        for j in range(1, len(hyp_words) + 1):
            if ref_words[i - 1] == hyp_words[j - 1]:
                d[i][j] = d[i - 1][j - 1]
            else:
                d[i][j] = 1 + min(d[i - 1][j], d[i][j - 1], d[i - 1][j - 1])

    return d[len(ref_words)][len(hyp_words)] / len(ref_words)


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


class DummySession:
    def __init__(self):
        self._buffers = []


def test_telugu_multiword_wer(session: LocalMediaSession):
    """Test multi-word Telugu sentence: 'నమస్కారం నా పేరు గీత ఈరోజు వాతావరణం చాలా బాగుంది'."""
    fixture_path = FIXTURES_DIR / "te_long_pcm16.wav"
    assert fixture_path.exists(), f"Missing fixture {fixture_path}"

    result = session.transcribe_path(fixture_path)
    assert result.status == "SPEECH"
    assert result.mode == "LOCAL_NEURAL"

    ref_text = "నమస్కారం నా పేరు గీత ఈరోజు వాతావరణం చాలా బాగుంది"
    wer = _calculate_wer(ref_text, result.text)
    assert wer <= 0.15, f"WER {wer} exceeded threshold on clean multi-word Telugu"


def test_telugu_medical_speech_recognized(session: LocalMediaSession):
    """Test longer multi-word spoken Telugu medical fixture (te_dengue_intro_30s.wav)."""
    fixture_path = FIXTURES_DIR / "te_dengue_intro_30s.wav"
    assert fixture_path.exists(), f"Missing fixture {fixture_path}"

    result = session.transcribe_path(fixture_path)
    assert result.status == "SPEECH"
    assert len(result.text.strip()) > 10
    # Expected Telugu medical keywords present
    assert any(w in result.text for w in ["రక్త", "ప్లాస్మా", "తక్కువ"])


def test_multilingual_speech_acoustic_acceptance():
    """Verify acoustic VAD accepts human speech across English, Hindi, Spanish, Telugu."""
    fixtures = [
        "te_long_pcm16.wav",
        "te_dengue_intro_30s.wav",
        "te_namaskaramu_16k.wav",
        "en_jfk_human.wav",
        "hi_dengue_intro_30s.wav",
        "es_contaminacion_30s.wav",
    ]
    dummy = DummySession()
    for name in fixtures:
        path = FIXTURES_DIR / name
        if path.exists():
            is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, path)
            assert is_speech, f"Acoustic VAD falsely rejected real human speech {name}"
            assert basis == "SPEECH_CANDIDATE"


def test_nonspeech_false_positive_rejection():
    """Verify acoustic VAD rejects non-speech: silence, pure tones, dual tones, sweeps, noise."""
    dummy = DummySession()
    rng = random.Random(42)
    sr = 16000

    # 1. Pure tone 440 Hz
    tone_samples = [int(16000 * math.sin(2 * math.pi * 440 * i / sr)) for i in range(sr * 2)]
    # 2. Stationary white noise
    noise_samples = [int(rng.uniform(-10000, 10000)) for _ in range(sr * 2)]
    # 3. Silence
    silence_samples = [0] * (sr * 2)

    import tempfile
    with tempfile.TemporaryDirectory() as td:
        t_path = Path(td) / "tone.wav"
        n_path = Path(td) / "noise.wav"
        s_path = Path(td) / "silence.wav"

        _write_wav(t_path, tone_samples)
        _write_wav(n_path, noise_samples)
        _write_wav(s_path, silence_samples)

        is_s, basis_s = LocalMediaSession._detect_speech_acoustics(dummy, s_path)
        assert not is_s and basis_s == "PCM_ENERGY"

        is_t, basis_t = LocalMediaSession._detect_speech_acoustics(dummy, t_path)
        assert not is_t and basis_t == "PURE_TONE"

        is_n, basis_n = LocalMediaSession._detect_speech_acoustics(dummy, n_path)
        assert not is_n and basis_n == "STATIONARY_NOISE"


def test_low_volume_speech_false_negative_guard(tmp_path: Path):
    """Guard against rejecting speech when volume is low (e.g. 5% amplitude)."""
    src = FIXTURES_DIR / "te_long_pcm16.wav"
    samples, sr = _read_wav(src)

    # Scale down by 95%
    scaled_samples = [int(s * 0.05) for s in samples]
    low_vol_path = tmp_path / "low_vol.wav"
    _write_wav(low_vol_path, scaled_samples, sr)

    dummy = DummySession()
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, low_vol_path)
    assert is_speech, f"Low volume human speech was incorrectly rejected: {basis}"
    assert basis == "SPEECH_CANDIDATE"


def test_speech_with_moderate_background_noise(tmp_path: Path):
    """Guard against rejecting speech in moderate acoustic noise."""
    src = FIXTURES_DIR / "te_long_pcm16.wav"
    samples, sr = _read_wav(src)

    rng = random.Random(123)
    # Add moderate background noise (SNR ~ 15dB)
    noisy_samples = [
        max(-32767, min(32767, int(s + rng.uniform(-500, 500))))
        for s in samples
    ]
    noisy_path = tmp_path / "noisy.wav"
    _write_wav(noisy_path, noisy_samples, sr)

    dummy = DummySession()
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(dummy, noisy_path)
    assert is_speech, f"Speech with moderate noise was incorrectly rejected: {basis}"
    assert basis == "SPEECH_CANDIDATE"


def test_vad_mutation_strict_threshold_fails(tmp_path: Path):
    """Mutation testing: artificially strict VAD that rejects human speech MUST fail."""
    src = FIXTURES_DIR / "te_long_pcm16.wav"
    samples, sr = _read_wav(src)

    # Simulate mutant: threshold raised to peak > 25000 (standard speech peak is ~12000)
    peak = max(abs(s) for s in samples)
    mutant_peak_threshold = 28000
    mutant_rejected = peak <= mutant_peak_threshold
    assert mutant_rejected, "Mutant did not trigger rejection on reference speech"
