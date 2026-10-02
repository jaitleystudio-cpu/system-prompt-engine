"""Adversarial mutants for false-local labeling and empty-hash integrity."""

from __future__ import annotations

from pathlib import Path

import pytest

from spe_runtime.media_product.local_backend import local_claim, verify_file_sha256

SOURCE = Path("spe_runtime/media_product/local_backend.py")


def _load(source: str) -> dict:
    import sys
    import types

    module = types.ModuleType("mutant_local_backend")
    module.__file__ = "mutant_local_backend.py"
    sys.modules["mutant_local_backend"] = module
    exec(compile(source, "mutant_local_backend.py", "exec"), module.__dict__)
    return module.__dict__


def _expect_local_claim(fn) -> None:
    assert fn("whisper-cli") == "LOCAL_CPU"
    assert fn("web-speech") == "NOT_LOCAL"
    assert fn("browser-speech-recognition") == "NOT_LOCAL"
    assert fn("cloud-whisper") == "NOT_LOCAL"


def _expect_empty_hash(fn) -> None:
    try:
        fn(SOURCE, "")
    except Exception as exc:
        if "EMPTY_OR_INVALID_HASH" not in str(exc):
            raise AssertionError(f"unexpected error: {exc}") from exc
        return
    raise AssertionError("empty hash was accepted")


def test_real_claim_and_hash_hold() -> None:
    _expect_local_claim(local_claim)
    _expect_empty_hash(verify_file_sha256)


def test_false_local_mutant_is_killed() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    mutated = source.replace('return "NOT_LOCAL"', 'return "LOCAL_CPU"', 1)
    assert mutated != source
    fn = _load(mutated)["local_claim"]
    with pytest.raises(AssertionError):
        _expect_local_claim(fn)


def test_empty_hash_mutant_is_killed() -> None:
    source = SOURCE.read_text(encoding="utf-8")
    mutated = source.replace(
        'raise IntegrityError("EMPTY_OR_INVALID_HASH")',
        'return ""',
        1,
    )
    assert mutated != source
    fn = _load(mutated)["verify_file_sha256"]
    with pytest.raises(AssertionError):
        _expect_empty_hash(fn)
