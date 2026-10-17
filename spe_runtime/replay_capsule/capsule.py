"""SPE Replay Capsule creation, verification, and serialization."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Callable

from spe_runtime.ci_gate.receipt import rfc8785_canonicalize
from spe_runtime.replay_capsule.models import (
    ExecutionEnvironment,
    ReplayCapsule,
    ReplayVerificationResult,
    RetrievalContextSnapshot,
    TaintLevel,
    ToolDefinitionSnapshot,
)


def _compute_digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def create_replay_capsule(
    instruction_version_id: str,
    environment: ExecutionEnvironment,
    prompt_input: str,
    observed_output: str,
    tools: tuple[ToolDefinitionSnapshot, ...] = (),
    retrieval_context: tuple[RetrievalContextSnapshot, ...] = (),
    metadata: dict[str, Any] | None = None,
    created_at: str | None = None,
) -> ReplayCapsule:
    """Creates a deterministic, content-addressed ReplayCapsule."""
    now = created_at or datetime.now(timezone.utc).isoformat()
    output_digest = _compute_digest(observed_output.encode("utf-8"))

    payload = {
        "instruction_version_id": instruction_version_id,
        "environment": environment.to_dict(),
        "prompt_input": prompt_input,
        "tools": [t.to_dict() for t in tools],
        "retrieval_context": [r.to_dict() for r in retrieval_context],
        "created_at": now,
        "expected_output_digest": output_digest,
    }

    canonical_bytes = rfc8785_canonicalize(payload)
    capsule_digest = _compute_digest(canonical_bytes)
    capsule_id = f"capsule-{capsule_digest[:16]}"

    return ReplayCapsule(
        capsule_id=capsule_id,
        instruction_version_id=instruction_version_id,
        environment=environment,
        prompt_input=prompt_input,
        expected_output_digest=output_digest,
        observed_output=observed_output,
        tools=tools,
        retrieval_context=retrieval_context,
        created_at=now,
        metadata=metadata or {},
        capsule_digest=capsule_digest,
    )


def verify_replay_capsule(
    capsule: ReplayCapsule,
    replay_fn: Callable[[ReplayCapsule], str] | None = None,
) -> ReplayVerificationResult:
    """Verifies that capsule digests are sound and replayed execution matches expected output."""
    violations: list[str] = []

    # 1. Verify expected output matches observed output digest
    calculated_output_digest = _compute_digest(capsule.observed_output.encode("utf-8"))
    output_match = calculated_output_digest == capsule.expected_output_digest
    if not output_match:
        violations.append(
            f"Output digest mismatch: expected {capsule.expected_output_digest}, got {calculated_output_digest}"
        )

    # 2. Verify capsule digest integrity
    payload = {
        "instruction_version_id": capsule.instruction_version_id,
        "environment": capsule.environment.to_dict(),
        "prompt_input": capsule.prompt_input,
        "tools": [t.to_dict() for t in capsule.tools],
        "retrieval_context": [r.to_dict() for r in capsule.retrieval_context],
        "created_at": capsule.created_at,
        "expected_output_digest": capsule.expected_output_digest,
    }
    canonical_bytes = rfc8785_canonicalize(payload)
    calculated_capsule_digest = _compute_digest(canonical_bytes)
    input_digest_match = calculated_capsule_digest == capsule.capsule_digest
    if not input_digest_match:
        violations.append(
            f"Capsule digest mismatch: expected {capsule.capsule_digest}, got {calculated_capsule_digest}"
        )

    # 3. Optional: replay execution function
    replayed_match = True
    if replay_fn is not None:
        replayed_output = replay_fn(capsule)
        replayed_digest = _compute_digest(replayed_output.encode("utf-8"))
        if replayed_digest != capsule.expected_output_digest:
            replayed_match = False
            violations.append(
                f"Replayed output digest mismatch: expected {capsule.expected_output_digest}, got {replayed_digest}"
            )

    is_valid = output_match and input_digest_match and replayed_match

    return ReplayVerificationResult(
        capsule_id=capsule.capsule_id,
        is_valid=is_valid,
        input_digest_match=input_digest_match,
        output_digest_match=output_match,
        replayed_output_match=replayed_match,
        violations=tuple(violations),
    )


def export_capsule_json(capsule: ReplayCapsule) -> str:
    """Serializes ReplayCapsule to formatted JSON."""
    return json.dumps(capsule.to_dict(), indent=2)


def import_capsule_json(json_str: str) -> ReplayCapsule:
    """Deserializes ReplayCapsule from JSON string."""
    data = json.loads(json_str)

    env_data = data["environment"]
    env = ExecutionEnvironment(
        provider=env_data["provider"],
        model_id=env_data["model_id"],
        model_version=env_data.get("model_version"),
        temperature=float(env_data.get("temperature", 0.0)),
        top_p=float(env_data.get("top_p", 1.0)),
        seed=env_data.get("seed"),
        max_tokens=env_data.get("max_tokens"),
        tokenizer_name=env_data.get("tokenizer_name"),
    )

    tools = tuple(
        ToolDefinitionSnapshot(
            name=t["name"],
            description=t["description"],
            parameters_schema=t["parameters_schema"],
            permission_tier=t.get("permission_tier", "DEFAULT"),
        )
        for t in data.get("tools", [])
    )

    retrieval = tuple(
        RetrievalContextSnapshot(
            chunk_id=r["chunk_id"],
            source_uri=r["source_uri"],
            content=r["content"],
            content_hash=r["content_hash"],
            taint_level=TaintLevel(r.get("taint_level", "TRUSTED")),
        )
        for r in data.get("retrieval_context", [])
    )

    return ReplayCapsule(
        capsule_id=data["capsule_id"],
        instruction_version_id=data["instruction_version_id"],
        environment=env,
        prompt_input=data["prompt_input"],
        expected_output_digest=data["expected_output_digest"],
        observed_output=data["observed_output"],
        tools=tools,
        retrieval_context=retrieval,
        created_at=data["created_at"],
        metadata=data.get("metadata", {}),
        capsule_digest=data.get("capsule_digest", ""),
    )
