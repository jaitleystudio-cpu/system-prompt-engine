"""Tests for SPE Replay Capsule deterministic container."""

from spe_runtime.replay_capsule.models import (
    ExecutionEnvironment,
    ReplayCapsule,
    RetrievalContextSnapshot,
    TaintLevel,
    ToolDefinitionSnapshot,
)
from spe_runtime.replay_capsule.capsule import (
    create_replay_capsule,
    export_capsule_json,
    import_capsule_json,
    verify_replay_capsule,
)


def test_replay_capsule_creation_and_soundness():
    env = ExecutionEnvironment(
        provider="local",
        model_id="llama3.2:1b",
        temperature=0.0,
        seed=42,
    )
    tools = (
        ToolDefinitionSnapshot(
            name="query_db",
            description="Query read-only database",
            parameters_schema={"type": "object", "properties": {"sql": {"type": "string"}}},
            permission_tier="READ_ONLY",
        ),
    )
    retrieval = (
        RetrievalContextSnapshot(
            chunk_id="c-001",
            source_uri="file:///docs/policy.md",
            content="Allow user profile reads only.",
            content_hash="hash-policy-01",
            taint_level=TaintLevel.TRUSTED,
        ),
    )

    capsule = create_replay_capsule(
        instruction_version_id="inst-v1",
        environment=env,
        prompt_input="Return user profile for alice",
        observed_output='{"user": "alice", "status": "active"}',
        tools=tools,
        retrieval_context=retrieval,
        created_at="2026-10-08T00:00:00Z",
    )

    assert capsule.capsule_id.startswith("capsule-")
    assert capsule.expected_output_digest != ""

    # Verify without rerun
    verification = verify_replay_capsule(capsule)
    assert verification.is_valid is True
    assert verification.input_digest_match is True
    assert verification.output_digest_match is True
    assert len(verification.violations) == 0


def test_replay_capsule_replay_function():
    env = ExecutionEnvironment(provider="mock", model_id="mock-1")
    capsule = create_replay_capsule(
        instruction_version_id="v1",
        environment=env,
        prompt_input="Ping",
        observed_output="Pong",
        created_at="2026-10-08T00:00:00Z",
    )

    # Replay returns identical output
    ver_success = verify_replay_capsule(capsule, replay_fn=lambda c: "Pong")
    assert ver_success.is_valid is True
    assert ver_success.replayed_output_match is True

    # Replay returns diverging output (drift detected)
    ver_drift = verify_replay_capsule(capsule, replay_fn=lambda c: "Pong-Drifted")
    assert ver_drift.is_valid is False
    assert ver_drift.replayed_output_match is False
    assert any("Replayed output digest mismatch" in v for v in ver_drift.violations)


def test_replay_capsule_serialization_roundtrip():
    env = ExecutionEnvironment(provider="anthropic", model_id="claude-3-7-sonnet", temperature=0.2)
    capsule = create_replay_capsule(
        instruction_version_id="v2",
        environment=env,
        prompt_input="Format as JSON",
        observed_output='{"status": 200}',
        created_at="2026-10-08T00:00:00Z",
    )

    json_str = export_capsule_json(capsule)
    imported = import_capsule_json(json_str)

    assert imported.capsule_id == capsule.capsule_id
    assert imported.instruction_version_id == capsule.instruction_version_id
    assert imported.environment.model_id == "claude-3-7-sonnet"
    assert imported.observed_output == '{"status": 200}'
    assert imported.capsule_digest == capsule.capsule_digest

    verification = verify_replay_capsule(imported)
    assert verification.is_valid is True
