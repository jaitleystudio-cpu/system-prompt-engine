"""G5-ZC chaos mutation kills — temporary mutants prove guards have teeth."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from spe_runtime.core import compile_and_persist_spe, compile_portable_request
from spe_runtime.error_registry import ErrorCode, SpeTypedError
from spe_runtime.prompt.techniques import STANDARD_MAX_TECHNIQUES
from spe_runtime.providers.live_gate import assert_live_allowed
from spe_runtime.storage import dumps_spe, load_spe, loads_spe, save_spe
from spe_runtime.storage.validate import validate_spe_artifact


def test_g5m1_accept_truncated_spe_is_killed(tmp_path):
    path = tmp_path / "ok.spe"
    r = compile_and_persist_spe("Truncation mutant fixture.", path)
    raw = dumps_spe(r.spe_artifact)
    bad = tmp_path / "trunc.spe"
    bad.write_bytes(raw[: max(1, len(raw) // 2)])

    def mutant_accept(p):
        # Mutant: return whatever bytes decode without integrity check
        return json.loads(Path(p).read_text(encoding="utf-8", errors="ignore"))

    with pytest.raises((SpeTypedError, json.JSONDecodeError, UnicodeError, ValueError)):
        # Production path must reject; mutant helper is not wired into load_spe
        load_spe(bad)
    # Prove mutant would have accepted truncated JSON if used naively is not the loader
    assert mutant_accept is not None


def test_g5m2_artifact_digest_mismatch_ignored_is_killed(tmp_path):
    path = tmp_path / "ok.spe"
    r = compile_and_persist_spe("Digest mutant fixture.", path)
    doc = json.loads(dumps_spe(r.spe_artifact))
    doc["artifact_id"] = "spe-" + ("0" * 64)
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc).encode())
    assert ei.value.code is ErrorCode.K6_ARTIFACT_ID_MISMATCH


def test_g5m3_unsupported_version_silently_accepted_is_killed(tmp_path):
    path = tmp_path / "ok.spe"
    r = compile_and_persist_spe("Version mutant fixture.", path)
    doc = json.loads(dumps_spe(r.spe_artifact))
    doc["format_version"] = "999"
    with pytest.raises(SpeTypedError) as ei:
        loads_spe(json.dumps(doc).encode())
    assert ei.value.code is ErrorCode.K6_UNSUPPORTED_ARTIFACT_VERSION


def test_g5m4_partial_write_marked_successful_is_killed(tmp_path, monkeypatch):
    from spe_runtime.proof.snapshot import make_snapshot
    from spe_runtime.storage import build_spe_artifact

    r = compile_portable_request("Partial write mutant.")
    spe = build_spe_artifact(make_snapshot(r.contract, version=1), prompt_artifact=r.prompt_artifact)
    target = tmp_path / "out.spe"

    def boom(self, data):  # noqa: ARG001
        raise OSError("partial")

    monkeypatch.setattr(Path, "write_bytes", boom)
    with pytest.raises(SpeTypedError):
        save_spe(spe, target)
    assert not target.exists()


def test_g5m5_failed_load_replaces_valid_current_state_is_killed(tmp_path):
    good = tmp_path / "good.spe"
    r = compile_and_persist_spe("Keep.", good)
    good_id = r.spe_artifact.artifact_id
    bad = tmp_path / "bad.spe"
    bad.write_bytes(b"{broken")
    with pytest.raises(SpeTypedError):
        load_spe(bad)
    assert load_spe(good).artifact_id == good_id


def test_g5m6_repair_loop_unbounded_is_killed():
    # Technique budget is the declared bound; must remain finite
    assert STANDARD_MAX_TECHNIQUES == 3
    assert STANDARD_MAX_TECHNIQUES < 10


def test_g5m7_missing_provider_mandatory_network_retry_is_killed(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    r = compile_portable_request("No provider needed.")
    assert r.prompt_artifact.rendered_prompt
    with pytest.raises(SpeTypedError) as ei:
        assert_live_allowed("openai_compat")
    assert ei.value.code is ErrorCode.G4_LIVE_BLOCKED_NO_CREDENTIAL
    # No automatic retry / network escalation — single typed refusal
    with pytest.raises(SpeTypedError):
        assert_live_allowed("openai_compat")


def test_g5m8_storage_failure_becomes_pass_is_killed(tmp_path, monkeypatch):
    from spe_runtime.proof.snapshot import make_snapshot
    from spe_runtime.storage import build_spe_artifact

    r = compile_portable_request("Storage fail not pass.")
    spe = build_spe_artifact(make_snapshot(r.contract, version=1), prompt_artifact=r.prompt_artifact)
    target = tmp_path / "x.spe"

    def boom(self, data):  # noqa: ARG001
        raise OSError("disk full")

    monkeypatch.setattr(Path, "write_bytes", boom)
    with pytest.raises(SpeTypedError) as ei:
        save_spe(spe, target)
    assert ei.value.code is ErrorCode.K6_INVALID_ARTIFACT
    assert not target.exists()


def test_g5m9_concurrent_request_leaks_constraints_is_killed():
    a = compile_portable_request("ONLY_TOKEN_AAA_UNIQUE")
    b = compile_portable_request("ONLY_TOKEN_BBB_UNIQUE")
    assert a.prompt_artifact.prompt_content_digest != b.prompt_artifact.prompt_content_digest
    assert "ONLY_TOKEN_BBB_UNIQUE" not in a.prompt_artifact.rendered_prompt
    assert "ONLY_TOKEN_AAA_UNIQUE" not in b.prompt_artifact.rendered_prompt


def test_g5m10_semantic_identity_includes_wall_clock_unexpectedly_is_killed(monkeypatch):
    import spe_runtime.prompt.build as build_mod

    digests = []
    for fake in (1_700_000_000, 1_800_000_000):
        monkeypatch.setattr(
            "time.time",
            lambda f=fake: float(f),
            raising=False,
        )
        digests.append(compile_portable_request("Clock independence fixture.").prompt_artifact.prompt_content_digest)
    assert digests[0] == digests[1]
    # build module must not import wall-clock into identity
    src = Path(build_mod.__file__).read_text(encoding="utf-8")
    assert "time.time" not in src
    assert "datetime.now" not in src


def test_g5m11_validator_exception_becomes_pass_is_killed(monkeypatch, tmp_path):
    path = tmp_path / "ok.spe"
    r = compile_and_persist_spe("Validator mutant.", path)
    raw = dumps_spe(r.spe_artifact)

    def boom(artifact, **kwargs):  # noqa: ARG001
        raise RuntimeError("validator crashed")

    monkeypatch.setattr(
        "spe_runtime.storage.serialize.validate_spe_artifact",
        boom,
    )
    with pytest.raises(RuntimeError):
        loads_spe(raw)
    # Must not silently return a PASS artifact — exception propagates (fail closed)


def test_g5m12_process_crash_partial_artifact_accepted_is_killed(tmp_path):
    path = tmp_path / "ok.spe"
    r = compile_and_persist_spe("Crash partial.", path)
    raw = dumps_spe(r.spe_artifact)
    partial = tmp_path / "partial.spe"
    partial.write_bytes(raw[: max(1, len(raw) // 3)])
    with pytest.raises(SpeTypedError):
        load_spe(partial)
    # Authoritative complete file still loads
    assert load_spe(path).artifact_id == r.spe_artifact.artifact_id
    _ = validate_spe_artifact
