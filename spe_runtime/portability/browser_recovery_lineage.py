"""R1 import bridge: bind R0 browser observations into existing .spe portability.

This is not a new .spe format, compiler, verifier, or runtime authority.
The independently generated source .spe must already exist. Input JSON from a
test harness is untrusted; matching digests show consistency, NOT execution
authenticity, a verified model identity, or a production release approval.
"""

from __future__ import annotations

import copy
import hashlib
import os
import re
from pathlib import Path
from typing import Any, Mapping

from spe_runtime.portability.canonical import canonical_dumps, strict_equal
from spe_runtime.portability.spe_artifact import (
    compute_integrity,
    dumps_spe_artifact,
    loads_spe_artifact,
    protected_intent_of,
    roundtrip_spe_artifact,
    verify_integrity,
)

_R0_SCHEMA = "spe.live_crash_recovery.acceptance.v0"
_RECEIPT_SCHEMA = "spe.execution.browser-recovery-bridge.v0"
_BROWSER = "REAL_EPHEMERAL_CHROMIUM_OBSERVATION"
_DIGEST = re.compile(r"^sha256:[0-9a-f]{64}$")
_PASSED_FILE = re.compile(r"^browser-passed-[0-9a-f]{16}\.html$")
_QUALIFICATION_BY_PROVENANCE = {
    "FIXTURE": {"FIXTURE_PASS_NOT_LIVE", "FIXTURE_REPAIRED_NOT_LIVE", "FAILED_BOUNDED_REPAIR", "INCONCLUSIVE_EXCEPTION"},
    "EXTERNAL_COMMAND_UNATTESTED": {"BROWSER_PASS_PROVIDER_UNATTESTED", "BROWSER_REPAIRED_PROVIDER_UNATTESTED", "FAILED_BOUNDED_REPAIR", "INCONCLUSIVE_EXCEPTION"},
}
_EXPECTED_CHECKS = frozenset({"applicationVisible", "canvasVisible", "interactionWorking"})


def _sha(data: str | bytes) -> str:
    body = data.encode("utf-8") if isinstance(data, str) else data
    return "sha256:" + hashlib.sha256(body).hexdigest()


def _digest(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _DIGEST.fullmatch(value):
        raise ValueError("INVALID_DIGEST:" + label)
    return value


def _mapping(value: Any, label: str) -> Mapping[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("INVALID_MAPPING:" + label)
    return value


def _validate_observation(value: Any, idx: int) -> Mapping[str, Any]:
    obs = _mapping(value, "observation")
    _digest(obs.get("candidateDigest"), "candidate")
    if obs.get("evidenceKind") != _BROWSER:
        raise ValueError("INVALID_BROWSER_EVIDENCE_KIND")
    errors = obs.get("errors")
    checks = _mapping(obs.get("checks"), "checks")
    if not isinstance(errors, list) or any(not isinstance(item, str) for item in errors):
        raise ValueError("INVALID_OBSERVATION_ERRORS")
    if set(checks) != _EXPECTED_CHECKS or any(type(value) is not bool for value in checks.values()):
        raise ValueError("INVALID_OBSERVATION_CHECKS")
    if type(obs.get("passed")) is not bool:
        raise ValueError("INVALID_OBSERVATION_DISPOSITION")
    if obs["passed"] and (errors or not all(checks.values())):
        raise ValueError("PASS_CONTRADICTS_BROWSER_OBSERVATION")
    if not obs["passed"] and not errors and all(checks.values()):
        raise ValueError("FAIL_CONTRADICTS_BROWSER_OBSERVATION")
    screenshot = obs.get("screenshotDigest")
    if screenshot is not None:
        _digest(screenshot, "screenshot")
    if obs["passed"] and screenshot is None:
        raise ValueError("PASS_MISSING_SCREENSHOT_DIGEST")
    return obs


def validate_recovery_manifest(
    manifest: Mapping[str, Any], evidence_dir: str | os.PathLike[str],
    *, goal: str, compiled_prompt: str,
) -> dict[str, Any]:
    """Validate manifest consistency and exact saved HTML bytes when available.

    Manifest content is self-reported by a local harness, not an attestation.
    Does not execute HTML or grant authority. An independently sourced browser
    receipt will be needed before promoting this to production qualification.
    """
    record = _mapping(manifest, "manifest")
    if record.get("schema") != _R0_SCHEMA:
        raise ValueError("UNSUPPORTED_RECOVERY_SCHEMA")
    if record.get("protectedGoal") != goal or record.get("protectedGoalDigest") != _sha(goal):
        raise ValueError("PROTECTED_GOAL_MISMATCH")
    if record.get("initialPromptDigest") != _sha(compiled_prompt):
        raise ValueError("COMPILED_PROMPT_MISMATCH")
    provenance = record.get("provenance")
    qualification = record.get("qualification")
    if provenance not in _QUALIFICATION_BY_PROVENANCE:
        raise ValueError("UNSUPPORTED_PROVENANCE")
    if qualification not in _QUALIFICATION_BY_PROVENANCE[provenance]:
        raise ValueError("QUALIFICATION_PROVENANCE_MISMATCH")
    attempts = record.get("attempts")
    if not isinstance(attempts, list) or len(attempts) not in (1, 2):
        raise ValueError("INVALID_ATTEMPT_COUNT")
    if attempts[0].get("phase") != "INITIAL" or (
        len(attempts) == 2 and attempts[1].get("phase") != "REPAIR"
    ):
        raise ValueError("INVALID_ATTEMPT_SEQUENCE")
    if attempts[0].get("promptDigest") != _sha(compiled_prompt):
        raise ValueError("INITIAL_ATTEMPT_PROMPT_MISMATCH")
    observations = [
        _validate_observation(_mapping(item, "attempt").get("observation"), i)
        for i, item in enumerate(attempts)
    ]
    if record.get("artifactDigest") != observations[-1]["candidateDigest"]:
        raise ValueError("FINAL_CANDIDATE_MISMATCH")
    if len(attempts) == 2:
        repair = _mapping(record.get("repair"), "repair")
        if repair.get("sourceCandidateDigest") != observations[0]["candidateDigest"]:
            raise ValueError("STALE_REPAIR_SOURCE")
        if attempts[1].get("promptDigest") != _sha(str(repair.get("prompt") or "")):
            raise ValueError("REPAIR_PROMPT_MISMATCH")
        if observations[0]["passed"]:
            raise ValueError("REDUNDANT_REPAIR_AFTER_PASS")
    elif record.get("repair") is not None:
        raise ValueError("UNEXPECTED_REPAIR")
    final_pass = bool(observations[-1]["passed"])
    if qualification in {
        "FIXTURE_PASS_NOT_LIVE", "BROWSER_PASS_PROVIDER_UNATTESTED"
    } and (len(attempts) != 1 or not final_pass):
        raise ValueError("SUCCESS_DISPOSITION_MISMATCH")
    if qualification in {
        "FIXTURE_REPAIRED_NOT_LIVE", "BROWSER_REPAIRED_PROVIDER_UNATTESTED"
    } and (len(attempts) != 2 or not final_pass):
        raise ValueError("REPAIR_DISPOSITION_MISMATCH")
    if qualification == "FAILED_BOUNDED_REPAIR" and (len(attempts) != 2 or final_pass):
        raise ValueError("FAILURE_DISPOSITION_MISMATCH")
    # Exceptions stay unqualified. No attempt to convert them to failures or PASS.
    if qualification == "INCONCLUSIVE_EXCEPTION" and final_pass:
        raise ValueError("EXCEPTION_DISPOSITION_MISMATCH")

    saved = record.get("browserPassedArtifact")
    passed = [obs for obs in observations if obs["passed"]]
    saved_digest = None
    if passed:
        bound = _mapping(saved, "passedArtifact")
        filename = bound.get("file")
        if not isinstance(filename, str) or not _PASSED_FILE.fullmatch(filename):
            raise ValueError("UNSAFE_SAVED_ARTIFACT_NAME")
        saved_digest = _digest(bound.get("digest"), "savedArtifact")
        if saved_digest != observations[-1]["candidateDigest"]:
            raise ValueError("SAVED_ARTIFACT_NOT_FINAL_CANDIDATE")
        if filename != "browser-passed-" + saved_digest[7:23] + ".html":
            raise ValueError("SAVED_ARTIFACT_NAME_DIGEST_MISMATCH")
        directory = Path(evidence_dir)
        path = directory / filename
        if path.is_symlink() or not path.is_file():
            raise ValueError("UNTRUSTED_OR_MISSING_SAVED_ARTIFACT")
        if path.stat().st_size > 150_000:
            raise ValueError("OVERSIZE_SAVED_ARTIFACT")
        if _sha(path.read_bytes()) != saved_digest:
            raise ValueError("SAVED_ARTIFACT_BYTES_MISMATCH")
    elif saved is not None:
        raise ValueError("SAVED_ARTIFACT_WITHOUT_BROWSER_PASS")

    return {
        "manifest_digest": _sha(canonical_dumps(record)),
        "browser_passed_digest": saved_digest,
        "attempts": [
            {
                "phase": attempt["phase"],
                "prompt_digest": _digest(attempt.get("promptDigest"), "attemptPrompt"),
                "candidate_digest": obs["candidateDigest"],
                "browser_pass_claim": obs["passed"],
                "observed_error_count": len(obs["errors"]),
            }
            for attempt, obs in zip(attempts, observations)
        ],
        "claimed_provenance": provenance,
        "claimed_qualification": qualification,
    }


def attach_recovery_to_spe(
    source_artifact: Mapping[str, Any], manifest: Mapping[str, Any],
    evidence_dir: str | os.PathLike[str],
) -> dict[str, Any]:
    """Attach an untrusted local execution observation to existing .spe.

    Does not rewrite the frozen intent, XCAT, K3, context_protocol, rendered
    prompt, WASM declaration or other canonical source fields. Never merges
    with / overwrites an existing execution_record silently.
    """
    source = loads_spe_artifact(source_artifact)
    if verify_integrity(source)["integrity"]["state"] != "VERIFIED":
        raise ValueError("SOURCE_SPE_INTEGRITY_MISMATCH")
    if source.get("execution_record") is not None:
        raise ValueError("EXISTING_EXECUTION_RECORD_RECONCILIATION_REQUIRED")
    goal = source.get("user_request")
    prompt = source.get("rendered_prompt")
    if not isinstance(goal, str) or not isinstance(prompt, str):
        raise ValueError("MISSING_CANONICAL_GOAL_OR_PROMPT")
    evidence = validate_recovery_manifest(manifest, evidence_dir, goal=goal, compiled_prompt=prompt)
    protected_before = protected_intent_of(source)
    result = copy.deepcopy(source)
    result["execution_record"] = {
        "schema": _RECEIPT_SCHEMA,
        "disposition": "REVIEW_ONLY_UNATTESTED",
        "execution_authority": "NONE",
        "source_kind": "SELF_REPORTED_BROWSER_HARNESS",
        "qualification_claim": evidence["claimed_qualification"],
        "model_provenance_claim": evidence["claimed_provenance"],
        "manifest_digest": evidence["manifest_digest"],
        "browser_passed_artifact_digest": evidence["browser_passed_digest"],
        "attempts": evidence["attempts"],
        "known_limitations": [
            "No independent browser attestation",
            "No authenticated model-provider identity",
            "No production release authority",
        ],
    }
    result["integrity"] = compute_integrity(result)
    checked = roundtrip_spe_artifact(result)
    if not strict_equal(protected_intent_of(checked), protected_before):
        raise RuntimeError("PROTECTED_INTENT_MUTATED")
    for field in (
        "spe_format", "category", "target", "envelope", "wasm", "rendered_prompt",
        "lineage", "context_protocol", "user_request", "created_at_utc",
    ):
        if not strict_equal(checked.get(field), source.get(field)):
            raise RuntimeError("CANONICAL_SOURCE_CHANGED:" + field)
    if verify_integrity(checked)["integrity"]["state"] != "VERIFIED":
        raise RuntimeError("OUTPUT_SPE_INTEGRITY_MISMATCH")
    return checked


def dump_attached_spe(value: Mapping[str, Any]) -> str:
    """Use the pre-existing canonical serializer, never custom JSON format."""
    return dumps_spe_artifact(value) + "\n"
