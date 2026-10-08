"""Tests for Model Atlas empirical execution classes and local observed provenance."""

import pytest
from spe_runtime.model_atlas.atlas import ModelAtlasRegistry, RemoteExecutionNotPermittedError
from spe_runtime.model_atlas.models import ExecutionClass, ExecutionProvenance


def test_observed_local_execution_provenance():
    registry = ModelAtlasRegistry()
    prov = ExecutionProvenance(
        execution_id="exec-local-001",
        provider="llama_cpp",
        model_id="llama-3.2-3b-instruct-q4",
        execution_class=ExecutionClass.OBSERVED_LOCAL,
        timestamp="2026-10-08T10:30:00Z",
        input_digest="sha256:abc123input",
        output_digest="sha256:def456output",
        latency_ms=18.4,
        input_tokens=42,
        output_tokens=16,
        cost_usd=0.0,
        score=0.95,
        oracle_id="schema-task-sec-01",
        model_digest="sha256:gguf-digest-789",
        runtime="llama.cpp-b3452",
        quantization="Q4_K_M",
        hardware="Apple M2 Max (Metal)",
        parameters={"temperature": 0.0, "top_p": 1.0},
        repeat_count=3,
    )

    registry.record_execution(prov, allow_remote=False)
    passport = registry.get_passport("llama-3.2-3b-instruct-q4")

    assert passport is not None
    assert passport.execution_class == ExecutionClass.OBSERVED_LOCAL
    assert passport.sample_count == 1
    assert passport.latency_p50_ms == 18.4


def test_remote_execution_requires_explicit_opt_in():
    registry = ModelAtlasRegistry()
    remote_prov = ExecutionProvenance(
        execution_id="exec-remote-001",
        provider="openai",
        model_id="gpt-4o",
        execution_class=ExecutionClass.OBSERVED_REMOTE,
        timestamp="2026-10-08T10:30:00Z",
        input_digest="sha256:remote-in",
        output_digest="sha256:remote-out",
        latency_ms=450.0,
        input_tokens=100,
        output_tokens=50,
        cost_usd=0.001,
        score=0.98,
        oracle_id="det-task-held-01",
    )

    # Without allow_remote=True, must raise RemoteExecutionNotPermittedError
    with pytest.raises(RemoteExecutionNotPermittedError, match="Remote model execution requires explicit opt-in"):
        registry.record_execution(remote_prov, allow_remote=False)

    # With explicit allow_remote=True, recording succeeds
    registry.record_execution(remote_prov, allow_remote=True)
    passport = registry.get_passport("gpt-4o")
    assert passport is not None
    assert passport.execution_class == ExecutionClass.OBSERVED_REMOTE


def test_simulated_never_promoted_to_observed():
    registry = ModelAtlasRegistry()
    sim_prov = ExecutionProvenance(
        execution_id="exec-sim-001",
        provider="simulated_eval",
        model_id="hypothetical-model-v1",
        execution_class=ExecutionClass.SIMULATED,
        timestamp="2026-10-08T10:30:00Z",
        input_digest="sha256:sim-in",
        output_digest="sha256:sim-out",
        latency_ms=0.0,
        input_tokens=10,
        output_tokens=10,
        cost_usd=0.0,
        score=0.75,
        oracle_id="llm-judge-rubric",
    )

    registry.record_execution(sim_prov)
    passport = registry.get_passport("hypothetical-model-v1")
    assert passport is not None
    assert passport.execution_class == ExecutionClass.SIMULATED
    assert passport.execution_class != ExecutionClass.OBSERVED_LOCAL
    assert passport.execution_class != ExecutionClass.OBSERVED_REMOTE
