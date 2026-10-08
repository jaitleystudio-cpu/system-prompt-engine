"""Tests for Observed Model Atlas & Passport (M7)."""

from pathlib import Path
import pytest

from spe_runtime.model_atlas.atlas import (
    ModelAtlasRegistry,
    RemoteExecutionNotPermittedError,
    compare_model_passports,
)
from spe_runtime.model_atlas.models import (
    ExecutionClass,
    ExecutionProvenance,
)


def test_model_atlas_provenance_and_passport_aggregation(tmp_path: Path):
    registry = ModelAtlasRegistry(tmp_path / "atlas.json")

    # 1. Local observed execution
    prov1 = ExecutionProvenance(
        execution_id="exec-001",
        provider="llama.cpp",
        model_id="llama-3.1-8b-instruct",
        execution_class=ExecutionClass.OBSERVED_LOCAL,
        timestamp="2026-10-08T00:00:00Z",
        input_digest="sha256-input-1",
        output_digest="sha256-output-1",
        latency_ms=120.5,
        input_tokens=250,
        output_tokens=60,
        cost_usd=0.0,
        score=0.95,
        oracle_id="oracle-det-1",
    )
    registry.record_execution(prov1)

    passport = registry.get_passport("llama-3.1-8b-instruct")
    assert passport is not None
    assert passport.execution_class == ExecutionClass.OBSERVED_LOCAL
    assert passport.structured_output_success == 0.95
    assert passport.latency_p50_ms == 120.5
    assert passport.sample_count == 1

    # 2. Remote execution WITHOUT opt-in must fail closed
    prov_remote = ExecutionProvenance(
        execution_id="exec-002",
        provider="openai",
        model_id="gpt-4o",
        execution_class=ExecutionClass.OBSERVED_REMOTE,
        timestamp="2026-10-08T00:05:00Z",
        input_digest="sha256-input-2",
        output_digest="sha256-output-2",
        latency_ms=450.0,
        input_tokens=300,
        output_tokens=80,
        cost_usd=0.003,
        score=0.99,
        oracle_id="oracle-det-1",
    )
    with pytest.raises(RemoteExecutionNotPermittedError):
        registry.record_execution(prov_remote, allow_remote=False)

    # Remote execution WITH opt-in succeeds
    registry.record_execution(prov_remote, allow_remote=True)
    p_remote = registry.get_passport("gpt-4o")
    assert p_remote is not None
    assert p_remote.execution_class == ExecutionClass.OBSERVED_REMOTE

    # 3. Model Passport comparison
    comp = compare_model_passports(passport, p_remote)
    assert comp["model_a"] == "llama-3.1-8b-instruct"
    assert comp["model_b"] == "gpt-4o"
    assert comp["execution_class_a"] == "OBSERVED_LOCAL"
    assert comp["execution_class_b"] == "OBSERVED_REMOTE"
    assert comp["metrics_diff"]["structured_output_delta"] == 0.04
