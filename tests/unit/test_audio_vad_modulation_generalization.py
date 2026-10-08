"""SPE-R9S Task 1 — VAD modulation gate generalization + decode-window planner.

The canonical acoustic gate (LocalMediaSession._detect_speech_acoustics) must
reject stationary or rhythmically-gated tonal signals at frequencies, durations,
levels and modulation rates that do NOT appear in the original adversarial
tests (440/880 dual tone, 440/554.37/659.25 chord), while still accepting every
real speech fixture and degraded variants of them.

The decode-window planner must cover long audio contiguously in windows that
fit the pinned decoder's per-window token budget, cut at quiet points, so a
dense 30 s Telugu clip is not silently truncated after ~10 s.

Model-free tests run everywhere; real-inference tests skip without the pack.
"""

from __future__ import annotations

import array
import math
import random
import struct
import wave
from pathlib import Path

import pytest

from spe_runtime.media_product.local_backend import (
    DECODE_WINDOW_MAX_MS,
    DECODE_WINDOW_MIN_MS,
    VAD_MIN_SPECTRAL_VARIATION,
    VAD_MIN_SYLLABIC_MODULATION_DB,
    IntegrityError,
    LocalMediaSession,
    discover_qualified_assets,
    plan_decode_windows,
    speech_modulation_features,
)

SR = 16000
FIXTURES_DIR = Path(__file__).resolve().parents[2] / "apps" / "web" / "scripts" / "fixtures" / "media"
SPEECH_FIXTURES = sorted(p.name for p in FIXTURES_DIR.glob("*.wav"))
ORIGINAL_TEST_FREQS = {440.0, 880.0, 554.37, 659.25}


class _Gate:
    """Minimal stand-in: the canonical gate only needs a PCM buffer list."""

    def __init__(self) -> None:
        self._buffers: list[bytearray] = []


def _write(path: Path, samples: list[int]) -> Path:
    clipped = [max(-32768, min(32767, int(round(s)))) for s in samples]
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(SR)
        handle.writeframes(struct.pack(f"<{len(clipped)}h", *clipped))
    return path


def _read(path: Path) -> list[int]:
    with wave.open(str(path), "rb") as handle:
        raw = handle.readframes(handle.getnframes())
    data = array.array("h")
    data.frombytes(raw)
    return list(data)


def _tones(freqs, seconds, amp, *, phases=None, am_hz=None, am_depth=1.0, gate_hz=None):
    n = int(SR * seconds)
    phases = phases or [0.0] * len(freqs)
    out = []
    for i in range(n):
        t = i / SR
        v = sum(math.sin(2 * math.pi * f * t + p) for f, p in zip(freqs, phases)) / len(freqs)
        if am_hz is not None:
            v *= 1.0 - am_depth * 0.5 * (1.0 - math.cos(2 * math.pi * am_hz * t))
        if gate_hz is not None and (t * gate_hz) % 1.0 >= 0.5:
            v = 0.0
        out.append(amp * v)
    return out


def _sawtooth(f0, seconds, amp):
    return [amp * (2.0 * ((i * f0 / SR) % 1.0) - 1.0) for i in range(int(SR * seconds))]


def _sweep(f_lo, f_hi, seconds, amp):
    n = int(SR * seconds)
    out, phase = [], 0.0
    for i in range(n):
        f = f_lo + (f_hi - f_lo) * i / n
        phase += 2 * math.pi * f / SR
        out.append(amp * math.sin(phase))
    return out


# Stationary / rhythmic non-speech at frequencies, durations and levels absent
# from the original adversarial tests.
GENERALIZATION_NON_SPEECH = {
    "dual_300_1200_3.5s": lambda: _tones([300, 1200], 3.5, 9000),
    "dual_150_3000_4s": lambda: _tones([150, 3000], 4.0, 7000),
    "dtmf_697_1209_1.5s": lambda: _tones([697, 1209], 1.5, 12000),
    "eb_major_triad_1s": lambda: _tones([311.13, 392.0, 466.16], 1.0, 6000),
    "seven_note_cluster_2.5s": lambda: _tones([262, 294, 330, 349, 392, 523, 587], 2.5, 9000),
    "random_phase_chord_5s": lambda: _tones([233.08, 349.23, 523.25, 1046.5], 5.0, 8000,
                                            phases=[0.3, 1.9, 4.1, 2.6]),
    "quiet_chord_2s": lambda: _tones([200, 250, 300], 2.0, 400),
    "sawtooth_buzz_120hz_2s": lambda: _sawtooth(120, 2.0, 6000),
    "am_tone_4hz_3s": lambda: _tones([700], 3.0, 9000, am_hz=4.0, am_depth=0.9),
    "am_chord_5hz_3s": lambda: _tones([350, 525, 700], 3.0, 9000, am_hz=5.0, am_depth=0.9),
    "gated_dtmf_beeps_4hz_3s": lambda: _tones([852, 1477], 3.0, 10000, gate_hz=4.0),
    "sweep_200_2400_3s": lambda: _sweep(200, 2400, 3.0, 9000),
}

ORIGINAL_SHAPES = {
    "dual_440_880_original": lambda: _tones([440, 880], 3.0, 8000),
    "chord_a_major_original": lambda: _tones([440, 554.37, 659.25], 3.0, 5000),
}


def test_generalization_cases_avoid_original_fixture_frequencies():
    # Guard the guard: the generalization set must not reuse the frequencies the
    # original tests used, otherwise frequency hard-coding could pass it.
    sources = Path(__file__).read_text(encoding="utf-8")
    block = sources.split("GENERALIZATION_NON_SPEECH = {", 1)[1].split("\n}\n", 1)[0]
    for freq in ORIGINAL_TEST_FREQS:
        token = f"{freq:g}"
        assert f"[{token}," not in block and f", {token}]" not in block and f", {token}," not in block, token


@pytest.mark.parametrize("name", sorted(GENERALIZATION_NON_SPEECH))
def test_stationary_or_gated_tonal_signals_rejected(name: str, tmp_path: Path):
    wav = _write(tmp_path / f"{name}.wav", GENERALIZATION_NON_SPEECH[name]())
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(_Gate(), wav)
    assert is_speech is False, f"{name}: classified as speech ({basis})"
    assert basis in {"PURE_TONE", "STATIONARY_NOISE", "NO_SPEECH_MODULATION"}


@pytest.mark.parametrize("name", sorted(ORIGINAL_SHAPES))
def test_original_dual_tone_and_chord_rejected_without_model(name: str, tmp_path: Path):
    wav = _write(tmp_path / f"{name}.wav", ORIGINAL_SHAPES[name]())
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(_Gate(), wav)
    assert (is_speech, basis) == (False, "NO_SPEECH_MODULATION")


def _speech_variants():
    cases = []
    for name in SPEECH_FIXTURES:
        cases.append((name, "clean"))
    for name in ("te_amma_16k.wav", "te_dengue_intro_30s.wav", "hi_pcm16.wav", "en_jfk_human.wav"):
        for variant in ("quiet_x0.03", "white_noise_10db", "mains_hum_0db", "tone_bed_1khz_15db",
                        "padded_silence", "pitch_up_12pct"):
            cases.append((name, variant))
    return cases


def _degrade(samples: list[int], variant: str) -> list[float]:
    """Degradations at stated speech-to-background ratios (relative to speech RMS).

    Measured breakdown of the modulation gate (documented, not hidden): broadband
    noise and 50 Hz hum keep both features above threshold down to 0 dB SNR on
    every fixture (the pre-existing STATIONARY_NOISE zero-crossing rule, unchanged
    here, already rejects ~0 dB broadband noise, so the session-level case uses
    10 dB); a continuous
    1 kHz tone bed is tolerated to 10 dB SNR on every fixture (5 dB on most),
    because a dominant steady tone pins the zero-crossing rate.
    """
    rng = random.Random(1729)
    rms = math.sqrt(sum(s * s for s in samples) / len(samples))

    def at_snr(db: float) -> float:
        return rms * 10 ** (-db / 20)

    if variant == "clean":
        return list(samples)
    if variant == "quiet_x0.03":
        return [s * 0.03 for s in samples]
    if variant == "white_noise_10db":
        sigma = at_snr(10)
        return [s + rng.gauss(0, sigma) for s in samples]
    if variant == "mains_hum_0db":
        amp = at_snr(0) * math.sqrt(2)
        return [s + amp * math.sin(2 * math.pi * 50 * i / SR) for i, s in enumerate(samples)]
    if variant == "tone_bed_1khz_15db":
        amp = at_snr(15) * math.sqrt(2)
        return [s + amp * math.sin(2 * math.pi * 1000 * i / SR) for i, s in enumerate(samples)]
    if variant == "padded_silence":
        return [0] * SR + list(samples) + [0] * (2 * SR)
    if variant == "pitch_up_12pct":
        ratio = 1.12
        out = []
        for j in range(int(len(samples) / ratio)):
            x = j * ratio
            k = int(x)
            frac = x - k
            nxt = samples[k + 1] if k + 1 < len(samples) else samples[k]
            out.append(samples[k] * (1 - frac) + nxt * frac)
        return out
    raise AssertionError(variant)


@pytest.mark.parametrize("name,variant", _speech_variants())
def test_speech_fixtures_and_degraded_speech_still_accepted(name: str, variant: str, tmp_path: Path):
    samples = _degrade(_read(FIXTURES_DIR / name), variant)
    wav = _write(tmp_path / f"{variant}_{name}", samples)
    is_speech, basis = LocalMediaSession._detect_speech_acoustics(_Gate(), wav)
    assert (is_speech, basis) == (True, "SPEECH_CANDIDATE"), f"{name}/{variant} rejected: {basis}"


def test_modulation_features_separate_speech_from_tones_with_margin():
    speech = [speech_modulation_features(_read(FIXTURES_DIR / n)) for n in SPEECH_FIXTURES]
    assert all(f is not None for f in speech)
    assert min(f[0] for f in speech) >= 2.0 * VAD_MIN_SYLLABIC_MODULATION_DB
    assert min(f[1] for f in speech) >= 1.5 * VAD_MIN_SPECTRAL_VARIATION
    for name, make in {**GENERALIZATION_NON_SPEECH, **ORIGINAL_SHAPES}.items():
        depth, variation = speech_modulation_features(make())
        assert depth < VAD_MIN_SYLLABIC_MODULATION_DB or variation < VAD_MIN_SPECTRAL_VARIATION, name


@pytest.mark.parametrize("name", SPEECH_FIXTURES)
def test_modulation_features_survive_0db_broadband_noise_and_hum(name: str):
    samples = _read(FIXTURES_DIR / name)
    rms = math.sqrt(sum(s * s for s in samples) / len(samples))
    rng = random.Random(7)
    noisy = [s + rng.gauss(0, rms) for s in samples]
    hum = [s + rms * math.sqrt(2) * math.sin(2 * math.pi * 50 * i / SR) for i, s in enumerate(samples)]
    for degraded in (noisy, hum):
        depth, variation = speech_modulation_features(degraded)
        assert depth >= VAD_MIN_SYLLABIC_MODULATION_DB and variation >= VAD_MIN_SPECTRAL_VARIATION


def test_modulation_features_are_level_invariant():
    base = _read(FIXTURES_DIR / "te_amma_16k.wav")
    loud = speech_modulation_features(base)
    quiet = speech_modulation_features([s * 0.05 for s in base])
    assert abs(loud[0] - quiet[0]) < 0.25 and abs(loud[1] - quiet[1]) < 0.05


def test_modulation_gate_defers_on_very_short_clips():
    assert speech_modulation_features(_tones([500, 1000], 0.3, 8000)) is None


# ---------------------------------------------------------------- decode windows

def test_short_audio_is_one_window():
    for name in SPEECH_FIXTURES:
        samples = _read(FIXTURES_DIR / name)
        if len(samples) <= SR * DECODE_WINDOW_MAX_MS // 1000:
            assert plan_decode_windows(samples) == [(0, len(samples))], name


@pytest.mark.parametrize("name", [n for n in SPEECH_FIXTURES if n.endswith("_30s.wav") or n == "en_jfk_human.wav"])
def test_long_audio_windows_fit_budget_cover_audio_and_cut_quietly(name: str):
    samples = _read(FIXTURES_DIR / name)
    windows = plan_decode_windows(samples)
    assert len(windows) >= 2
    assert windows[0][0] == 0 and windows[-1][1] == len(samples)
    for (a0, a1), (b0, _b1) in zip(windows, windows[1:]):
        assert a1 == b0, "windows must be contiguous: no audio dropped between windows"
    max_len = SR * DECODE_WINDOW_MAX_MS // 1000
    min_len = SR * DECODE_WINDOW_MIN_MS // 1000
    for start, end in windows:
        assert end - start <= max_len
    for start, end in windows[:-1]:
        assert end - start >= min_len - 320
        # Cut lands on the quietest 20 ms frame of the allowed range.
        frames = range((start + min_len) // 320, (start + max_len) // 320)
        energy = {f: sum(x * x for x in samples[f * 320:(f + 1) * 320]) for f in frames}
        assert energy[(end - 160) // 320] == min(energy.values())


def test_silent_stretch_window_is_skipped_but_speech_windows_kept():
    speech = _read(FIXTURES_DIR / "te_amma_16k.wav")
    samples = speech + [0] * (12 * SR) + speech
    windows = plan_decode_windows(samples)
    covered = sum(e - s for s, e in windows)
    assert covered < len(samples), "an all-silent window must not be sent to the decoder"
    assert windows[0][0] == 0 and windows[-1][1] == len(samples)


def test_transcript_drops_non_speech_window_tags():
    text = LocalMediaSession._transcript_text(None, "నమస్కారం\n[సంగీతం]\nధన్యవాదాలు\n(Music)\n")
    assert text == "నమస్కారం ధన్యవాదాలు"
    assert LocalMediaSession._transcript_text(None, "[సంగీతం]\n(Music)\n") == ""


# ------------------------------------------------------------ real local inference

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


@pytest.mark.parametrize("name", ["dual_300_1200_3.5s", "eb_major_triad_1s", "am_chord_5hz_3s"])
def test_generalization_signals_produce_no_text_through_session(session, name: str, tmp_path: Path):
    wav = _write(tmp_path / f"{name}.wav", GENERALIZATION_NON_SPEECH[name]())
    result = session.transcribe_path(wav)
    assert result.status == "NO_SPEECH" and result.text == ""


def test_long_telugu_decode_covers_whole_clip_and_cleans_windows(session):
    import tempfile

    before = {p.name for p in Path(tempfile.gettempdir()).glob("spe-media-win-*")}
    result = session.transcribe_path(FIXTURES_DIR / "te_dengue_intro_30s.wav")
    assert result.status == "SPEECH"
    # Opening, middle and closing content of the 30 s clip all survive decoding.
    assert "డెంగ్యూ" in result.text
    assert "రక్త" in result.text
    assert "ప్లాస్మా" in result.text
    assert "\ufffd" not in result.text, "decoder output must not be cut mid UTF-8 sequence"
    assert session.temp_files_remaining == 0
    after = {p.name for p in Path(tempfile.gettempdir()).glob("spe-media-win-*")}
    assert after <= before, "per-window temp audio must be removed after inference"
