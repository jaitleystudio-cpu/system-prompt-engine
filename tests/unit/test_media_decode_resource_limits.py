"""SPE-R9S hardening — decoded-media resource limits in the canonical owner.

Compressed audio / video can expand far beyond its upload size. The owner must
bound decoding *while* ffmpeg runs (-t limit+1 s, -fs byte cap, wall-clock
timeout), measure what was produced, and refuse over-limit media with the
existing public code FILE_TOO_LARGE — never silently truncate — and leave no
temp files behind. Attack media is generated locally with ffmpeg (lavfi
sources; no downloaded content).
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import time
import wave
from pathlib import Path

import pytest

import spe_runtime.media_product.local_backend as lb
from spe_runtime.media_product.local_backend import (
    MAX_DECODED_DURATION_MS,
    MAX_DECODED_PCM_BYTES,
    PCM_BYTES_PER_SECOND,
    RESOURCE_LIMIT_CODE,
    DecodeError,
    IntegrityError,
    LocalMediaSession,
    discover_qualified_assets,
)

FFMPEG = lb._ffmpeg()
pytestmark = pytest.mark.skipif(shutil.which(FFMPEG) is None and not Path(FFMPEG).exists(), reason="ffmpeg required")
LIMIT_S = MAX_DECODED_DURATION_MS // 1000


def test_limit_is_the_reviewed_policy_value():
    # Policy constant: 10 min of 16 kHz mono PCM (19.2 MB). Changing it must be a
    # deliberate, owner-reviewed edit to this test, not a silent drift.
    assert MAX_DECODED_DURATION_MS == 600_000
    assert MAX_DECODED_PCM_BYTES == 600 * 16000 * 2 == 19_200_000


class _Owner:
    """Minimal stand-in: _to_wav only needs the temp registry."""

    def __init__(self) -> None:
        self._temps: list[Path] = []


def _gen(dest: Path, seconds: float, *args: str) -> Path:
    src = f"sine=frequency=330:sample_rate=16000:duration={seconds}"
    subprocess.run(
        [FFMPEG, "-nostdin", "-y", "-loglevel", "error", "-f", "lavfi", "-i", src, *args, str(dest)],
        check=True, capture_output=True,
    )
    return dest


@pytest.fixture(scope="module")
def media(tmp_path_factory):
    root = tmp_path_factory.mktemp("decode-limits")
    over = LIMIT_S + 60
    files = {
        "long_m4a": _gen(root / "long.m4a", over, "-c:a", "aac", "-b:a", "32k"),
        "long_low_bitrate_opus_1h": _gen(root / "long_lowrate.ogg", 3600, "-c:a", "libopus", "-b:a", "6k", "-ac", "1"),
        "long_adts_no_container_duration": _gen(root / "long.aac", over, "-c:a", "aac", "-b:a", "24k", "-f", "adts"),
        "under_limit_m4a": _gen(root / "short.m4a", 30, "-c:a", "aac", "-b:a", "32k"),
        "edge_just_under_m4a": _gen(root / "edge.m4a", LIMIT_S - 5, "-c:a", "aac", "-b:a", "24k"),
    }
    video = root / "long_video.mp4"
    subprocess.run(
        [FFMPEG, "-nostdin", "-y", "-loglevel", "error",
         "-f", "lavfi", "-i", f"color=c=black:s=16x16:r=1:d={over}",
         "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=16000:duration={over}",
         "-c:v", "libx264", "-c:a", "aac", "-b:a", "24k", "-shortest", str(video)],
        check=True, capture_output=True,
    )
    files["long_video_audio_track"] = video
    # Lying container metadata: patch mvhd/mdhd durations of an over-limit m4a to ~10 s.
    lying = root / "lying_duration.m4a"
    data = bytearray(files["long_m4a"].read_bytes())
    for atom in (b"mvhd", b"mdhd"):
        start = 0
        while (pos := data.find(atom, start)) != -1:
            version = data[pos + 4]
            if version == 0:
                timescale = struct.unpack(">I", data[pos + 16:pos + 20])[0]
                data[pos + 20:pos + 24] = struct.pack(">I", timescale * 10)
            start = pos + 4
    lying.write_bytes(bytes(data))
    files["lying_duration_metadata_m4a"] = lying
    return files


OVER_LIMIT = [
    "long_m4a",
    "long_low_bitrate_opus_1h",
    "long_adts_no_container_duration",
    "long_video_audio_track",
    "lying_duration_metadata_m4a",
]


def _leftovers(directory: Path) -> list[str]:
    return sorted(p.name for p in directory.glob("*.lane-r3b*.wav"))


@pytest.mark.parametrize("name", OVER_LIMIT)
def test_over_limit_compressed_media_refused_not_truncated(media, name: str):
    source = media[name]
    kind = "video-audio" if source.suffix == ".mp4" else "audio"
    owner = _Owner()
    started = time.monotonic()
    with pytest.raises(DecodeError) as caught:
        LocalMediaSession._to_wav(owner, source, kind)
    elapsed = time.monotonic() - started
    assert caught.value.code == RESOURCE_LIMIT_CODE
    assert "DECODED_DURATION_LIMIT" in str(caught.value)
    assert all(not p.exists() for p in owner._temps), "refusal must remove the partial decode"
    assert _leftovers(source.parent) == []
    assert elapsed < lb.DECODE_TIMEOUT_S


def test_decoder_is_bounded_while_running(media, monkeypatch):
    seen: list[list[str]] = []
    real = lb._run_ffmpeg

    def spy(args, **kwargs):
        seen.append(list(args))
        return real(args, **kwargs)

    monkeypatch.setattr(lb, "_run_ffmpeg", spy)
    with pytest.raises(DecodeError):
        LocalMediaSession._to_wav(_Owner(), media["long_low_bitrate_opus_1h"], "audio")
    args = seen[0]
    assert float(args[args.index("-t") + 1]) <= LIMIT_S + 1
    assert int(args[args.index("-fs") + 1]) <= MAX_DECODED_PCM_BYTES + 3 * PCM_BYTES_PER_SECOND + (1 << 16)
    assert args.index("-t") < args.index(args[-1]) and args.index("-fs") < len(args) - 1


def test_decode_wall_clock_limit_refuses_and_cleans(media, monkeypatch):
    monkeypatch.setattr(lb, "DECODE_TIMEOUT_S", 0.001)
    owner = _Owner()
    with pytest.raises(DecodeError) as caught:
        LocalMediaSession._to_wav(owner, media["long_low_bitrate_opus_1h"], "audio")
    assert caught.value.code == RESOURCE_LIMIT_CODE and "DECODE_TIME_LIMIT" in str(caught.value)
    assert all(not p.exists() for p in owner._temps)


@pytest.mark.parametrize("name,expected_s", [("under_limit_m4a", 30), ("edge_just_under_m4a", LIMIT_S - 5)])
def test_under_limit_media_decodes_in_full(media, name: str, expected_s: int):
    owner = _Owner()
    wav, duration_ms = LocalMediaSession._to_wav(owner, media[name], "audio")
    try:
        assert abs(duration_ms - expected_s * 1000) < 500, "under-limit audio must not be shortened"
    finally:
        wav.unlink(missing_ok=True)


def _write_wav(path: Path, seconds: float) -> Path:
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        handle.writeframes(b"\x00\x01" * int(16000 * seconds))
    return path


def test_over_limit_pcm_wav_refused_before_reading(tmp_path: Path):
    wav = _write_wav(tmp_path / "long.wav", LIMIT_S + 2)
    with pytest.raises(DecodeError) as caught:
        LocalMediaSession._to_wav(_Owner(), wav, "audio")
    assert caught.value.code == RESOURCE_LIMIT_CODE


def test_wav_header_claiming_huge_length_is_judged_by_real_size(tmp_path: Path):
    wav = _write_wav(tmp_path / "streaming.wav", 3)
    raw = bytearray(wav.read_bytes())
    data_at = raw.find(b"data")
    raw[data_at + 4:data_at + 8] = struct.pack("<I", 0xFFFFFFF0)  # streaming-style placeholder
    wav.write_bytes(bytes(raw))
    path, duration_ms = LocalMediaSession._to_wav(_Owner(), wav, "audio")
    assert path == wav and duration_ms <= 3100


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


@pytest.mark.parametrize("name", ["long_m4a", "long_video_audio_track"])
def test_session_refusal_state_is_explicit_and_clean(session, media, name: str):
    result = session.transcribe_path(media[name])
    assert result.status == "ERROR"
    assert result.error_code == RESOURCE_LIMIT_CODE
    assert result.mode == "UNAVAILABLE"
    assert result.text == "" and result.neural_session_ran is False
    assert session.temp_files_remaining == 0
    assert result.egress_attempts == 0
    assert _leftovers(media[name].parent) == []
