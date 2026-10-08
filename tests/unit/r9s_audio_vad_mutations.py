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
    "            if syllabic_db < VAD_MIN_SYLLABIC_MODULATION_DB or spectral_variation < VAD_MIN_SPECTRAL_VARIATION:\n"
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
MUTANTS: list[tuple[str, str, str]] = [
    ("remove-modulation-gate", GATE, "            if False:\n"),
    ("hardcode-original-frequencies", GATE, HARDCODE),
    ("depth-only-no-spectral-variation", GATE,
     "            if syllabic_db < VAD_MIN_SYLLABIC_MODULATION_DB:\n"),
    ("spectral-variation-only-no-depth", GATE,
     "            if spectral_variation < VAD_MIN_SPECTRAL_VARIATION:\n"),
    ("over-strict-gate-rejects-speech", "VAD_MIN_SYLLABIC_MODULATION_DB = 1.0\n",
     "VAD_MIN_SYLLABIC_MODULATION_DB = 6.0\n"),
    ("single-window-decode", "    if total <= max_len:\n        return [(0, total)]\n",
     "    if True:\n        return [(0, total)]\n"),
    ("fixed-cut-not-quiet-point", "            cut = quiet * frame + frame // 2\n",
     "            cut = start + max_len\n"),
    ("oversized-windows", "DECODE_WINDOW_MAX_MS = 7000\n", "DECODE_WINDOW_MAX_MS = 30000\n"),
    ("send-silent-windows", "    kept = [w for w in windows if loud_enough(w)]\n", "    kept = windows\n"),
    ("leak-non-speech-window-tags", "            if non_speech(stripped):\n                continue\n", ""),
]
TESTS = [
    "tests/unit/test_audio_vad_modulation_generalization.py",
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
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", *args],
        cwd=tmp, capture_output=True, text=True, env={"PYTHONPATH": str(tmp), "PATH": "/usr/bin:/bin"},
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
            proc = _pytest(tmp, TESTS)
            tail = proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else ""
            if proc.returncode == 0:
                survived.append(name)
                print(f"SURVIVED: {name} ({tail})")
            elif "AssertionError" not in proc.stdout and "assert" not in proc.stdout:
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
