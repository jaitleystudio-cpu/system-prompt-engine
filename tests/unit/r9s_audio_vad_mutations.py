#!/usr/bin/env python3
"""SPE-R9S Task 1 — mutation gate for the VAD modulation gate + decode windows.

Copies spe_runtime, the audio tests and the media fixtures into a temp dir,
applies one deliberate defect at a time to the canonical owner
spe_runtime/media_product/local_backend.py, and requires the audio tests to
FAIL. Production source is never modified. Builder regression only.

The "hardcode-original-frequencies" mutant replaces the general modulation
gate with a detector for exactly the original adversarial-test frequencies; it
must still be killed (by the generalization tests), proving the suite cannot be
passed by fixture-specific hard-coding.

--with-model hard-links the local media pack into the temp copy so the
original session-level dual-tone/chord tests run on real local inference for
the "remove-modulation-gate" mutant (requires the pack on the same volume).

Usage: python tests/unit/r9s_audio_vad_mutations.py [--with-model]
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OWNER = "spe_runtime/media_product/local_backend.py"
GATE = (
    "            if syllabic_db < VAD_MIN_SYLLABIC_MODULATION_DB or tilt_variation < VAD_MIN_TILT_VARIATION_DECADES:\n"
)
HARDCODE = '''            def _goertzel(freq):
                import math as _m
                k = 2 * _m.cos(2 * _m.pi * freq / 16000)
                s1 = s2 = 0.0
                for x in samples[:16000]:
                    s1, s2 = x + k * s1 - s2, s1
                return s1 * s1 + s2 * s2 - k * s1 * s2
            _total = sum(x * x for x in samples[:16000]) * 16000 / 2 + 1e-9
            if sum(_goertzel(f) for f in (440.0, 880.0, 554.37, 659.25)) / _total > 0.5:
'''
# Whole-clip per-bin DFT computed directly (the pre-hardening quadratic shape).
WHOLE_CLIP_DFT = """    centered_env = [v - sum(env) / n for v in env]
    whole = 0.0
    for k in range(1, n // 2 + 1):
        if not (VAD_SYLLABIC_BAND_HZ[0] <= k * frame_rate / n <= VAD_SYLLABIC_BAND_HZ[1]):
            continue
        re = im = 0.0
        for t_idx, v in enumerate(centered_env):
            re += v * math.cos(2.0 * math.pi * k * t_idx / n)
            im += v * math.sin(2.0 * math.pi * k * t_idx / n)
        amp = 2.0 * math.hypot(re, im) / n
        whole += amp * amp / 2.0
    length = min(VAD_MODULATION_WINDOW_FRAMES, n)
    _whole_depth = math.sqrt(whole)
"""
MUTANTS: list[tuple[str, str, str]] = [
    ("remove-modulation-gate", GATE, "            if False:\n"),
    ("hardcode-original-frequencies", GATE, HARDCODE),
    ("depth-only-no-tilt-variation", GATE,
     "            if syllabic_db < VAD_MIN_SYLLABIC_MODULATION_DB:\n"),
    ("tilt-variation-only-no-depth", GATE,
     "            if tilt_variation < VAD_MIN_TILT_VARIATION_DECADES:\n"),
    ("over-strict-gate-rejects-speech", "VAD_MIN_SYLLABIC_MODULATION_DB = 1.0\n",
     "VAD_MIN_SYLLABIC_MODULATION_DB = 6.0\n"),
    ("single-window-decode", "    if total <= max_len:\n        return [(0, total)]\n",
     "    if True:\n        return [(0, total)]\n"),
    ("fixed-cut-not-quiet-point", "            cut = quiet * frame + frame // 2\n",
     "            cut = start + max_len\n"),
    ("oversized-windows", "DECODE_WINDOW_MAX_MS = 6000\n", "DECODE_WINDOW_MAX_MS = 30000\n"),
    ("send-silent-windows", "    kept = [w for w in windows if loud_enough(w)]\n", "    kept = windows\n"),
    ("leak-non-speech-window-tags", "            if non_speech(stripped):\n                continue\n", ""),
    # --- hardening pass ---
    ("reintroduce-whole-clip-dft", "    length = min(VAD_MODULATION_WINDOW_FRAMES, n)\n", WHOLE_CLIP_DFT),
    ("no-stationary-floor-subtraction",
     "    floor = _percentile(power, VAD_STATIONARY_FLOOR_PERCENTILE)\n    diff_floor = _percentile(diff_power, VAD_STATIONARY_FLOOR_PERCENTILE)\n",
     "    floor = 0.0\n    diff_floor = 0.0\n"),
    ("silent-truncation-no-produced-duration-check",
     "        if produced_ms > MAX_DECODED_DURATION_MS:\n            dest.unlink(missing_ok=True)\n            raise DecodeError(RESOURCE_LIMIT_CODE, \"DECODED_DURATION_LIMIT\")\n", ""),
    ("unbounded-decoder-no-t-no-fs",
     '                    "-t",\n                    str(MAX_DECODED_DURATION_MS // 1000 + 1),\n                    "-fs",\n                    str(MAX_DECODED_PCM_BYTES + 2 * PCM_BYTES_PER_SECOND + _WAV_HEADER_SLACK_BYTES),\n', ""),
    ("no-decode-wall-clock-limit", "                timeout=DECODE_TIMEOUT_S,\n", ""),
    ("wav-passthrough-unbounded",
     "            if duration_ms > MAX_DECODED_DURATION_MS or size > MAX_DECODED_PCM_BYTES + _WAV_HEADER_SLACK_BYTES:\n",
     "            if False:\n"),
    ("limit-raised-silently", "MAX_DECODED_DURATION_MS = 600_000\n", "MAX_DECODED_DURATION_MS = 6_000_000\n"),
    ("no-seam-reconciliation", "        merged = words if not merged else _merge_seam(merged, words)\n",
     "        merged = merged + words\n"),
    ("no-window-overlap", "    pad = sample_rate * DECODE_WINDOW_OVERLAP_MS // 1000\n", "    pad = 0\n"),
    ("keep-truncated-left-copy",
     "    shared = [\n        right[j + t] if right[j + t] != left[i + t] and right[j + t].startswith(left[i + t]) else left[i + t]\n        for t in range(run)\n    ]\n",
     "    shared = left[i:i + run]\n"),
    ("seam-match-deep-in-right-window",
     "        for j in range(min(SEAM_MAX_EDGE_FRAGMENTS + 1, len(right))):\n",
     "        for j in range(min(SEAM_MAX_OVERLAP_WORDS, len(right))):\n"),
    ("seam-prefers-longest-run", "            key = (-(tail + j), run)\n", "            key = (run, -(tail + j))\n"),
    ("seam-run-not-bounded-by-overlap", "            if run == 0 or run > SEAM_MAX_OVERLAP_WORDS:\n", "            if run == 0:\n"),
    ("no-collapsed-window-recovery",
     "        if not flagged or self._cancel_event.is_set():\n            return texts\n",
     "        return texts\n"),
    ("core-redecode-overrides-richer-text",
     "            if len(core.split()) > len(recovered[index].split()):\n",
     "            if True:\n"),
    ("single-core-redecode-reads-missing-file",
     "        core_texts = self._window_texts(paths) if len(paths) > 1 else [self._transcript_text(stdout)]\n",
     "        core_texts = self._window_texts(paths)\n"),
]
VAD_TESTS = [
    "tests/unit/test_audio_vad_modulation_generalization.py",
    "tests/unit/test_audio_adversarial_vad.py",
    "tests/unit/test_audio_multilingual_corpus_and_vad_guard.py",
]
LIMIT_TESTS = ["tests/unit/test_media_decode_resource_limits.py"]
SEAM_TESTS = ["tests/unit/test_audio_window_seams.py", "tests/unit/test_audio_vad_modulation_generalization.py"]
LIMIT_MUTANTS = {
    "silent-truncation-no-produced-duration-check", "unbounded-decoder-no-t-no-fs",
    "no-decode-wall-clock-limit", "wav-passthrough-unbounded", "limit-raised-silently",
}
SEAM_MUTANTS = {
    "no-seam-reconciliation", "no-window-overlap", "keep-truncated-left-copy", "seam-match-deep-in-right-window",
    "seam-prefers-longest-run", "seam-run-not-bounded-by-overlap",
    "no-collapsed-window-recovery", "core-redecode-overrides-richer-text", "single-core-redecode-reads-missing-file",
}


def _targets(name: str) -> list[str]:
    if name in LIMIT_MUTANTS:
        return LIMIT_TESTS
    if name in SEAM_MUTANTS:
        return SEAM_TESTS
    return VAD_TESTS


TESTS = [
    "tests/unit/test_audio_vad_modulation_generalization.py",
    "tests/unit/test_media_decode_resource_limits.py",
    "tests/unit/test_audio_window_seams.py",
    "tests/unit/test_audio_adversarial_vad.py",
    "tests/unit/test_audio_multilingual_corpus_and_vad_guard.py",
]
ORIGINAL_SESSION_TESTS = [
    "tests/unit/test_audio_adversarial_vad.py::test_dual_tone_suppressed",
    "tests/unit/test_audio_adversarial_vad.py::test_chord_suppressed",
]


def _stage(tmp: Path, with_model: bool) -> None:
    shutil.copytree(REPO / "spe_runtime", tmp / "spe_runtime", ignore=shutil.ignore_patterns("__pycache__"))
    (tmp / "tests" / "unit").mkdir(parents=True)
    for test in TESTS:
        shutil.copy2(REPO / test, tmp / "tests/unit/")
    shutil.copytree(REPO / "apps/web/scripts/fixtures/media", tmp / "apps/web/scripts/fixtures/media")
    (tmp / "media-pack").mkdir()
    shutil.copy2(REPO / "media-pack/PACK_MANIFEST.json", tmp / "media-pack/")
    if with_model:
        for src in (REPO / "media-pack").rglob("*"):
            dest = tmp / "media-pack" / src.relative_to(REPO / "media-pack")
            if src.is_dir():
                dest.mkdir(parents=True, exist_ok=True)
            elif not dest.exists():
                os.link(src, dest)


def _pytest(tmp: Path, args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-x", "-p", "no:cacheprovider", *args],
        cwd=tmp, capture_output=True, text=True,
        env={"PYTHONPATH": str(tmp), "PATH": "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"},
    )


def main() -> int:
    with_model = "--with-model" in sys.argv
    survived: list[str] = []
    for name, needle, replacement in MUTANTS:
        tmp = Path(tempfile.mkdtemp(prefix="spe-r9s-mut-", dir=REPO.parent if with_model else None))
        try:
            _stage(tmp, with_model and name == "remove-modulation-gate")
            target = tmp / OWNER
            source = target.read_text(encoding="utf-8")
            if source.count(needle) != 1:
                print(f"ANCHOR_MISSING: {name}")
                return 2
            target.write_text(source.replace(needle, replacement), encoding="utf-8")
            if name == "hardcode-original-frequencies":
                # The cheat must genuinely satisfy the original shapes, else this mutant proves nothing.
                cheat = _pytest(tmp, ["tests/unit/test_audio_vad_modulation_generalization.py",
                                      "-k", "original_dual_tone_and_chord_rejected_without_model"])
                print(f"  hardcode mutant on ORIGINAL shapes: {'PASSES (cheat is real)' if cheat.returncode == 0 else 'fails'}")
            proc = _pytest(tmp, _targets(name))
            tail = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
            if proc.returncode == 0:
                survived.append(name)
                print(f"SURVIVED: {name} ({tail})")
            elif not any(marker in proc.stdout for marker in ("AssertionError", "assert", "DID NOT RAISE")):
                survived.append(name)
                print(f"DIED_FOR_WRONG_REASON: {name}\n{proc.stdout[-1500:]}")
            else:
                print(f"KILLED: {name} ({tail})")
            if with_model and name == "remove-modulation-gate":
                real = _pytest(tmp, ORIGINAL_SESSION_TESTS)
                verdict = "KILLED" if real.returncode != 0 else "SURVIVED"
                print(f"  original session tests on real inference: {verdict} "
                      f"({real.stdout.strip().splitlines()[-1] if real.stdout.strip() else ''})")
                if real.returncode == 0:
                    survived.append(name + "[real-inference]")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    print(f"{len(MUTANTS) - len(survived)}/{len(MUTANTS)} R9-S audio VAD/decode-window mutants killed")
    return 1 if survived else 0


if __name__ == "__main__":
    raise SystemExit(main())
