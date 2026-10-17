"""Adversarial R1 recovery import tests. Synthetic reports are NOT live proof."""

from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path

import pytest

from spe_runtime.portability.spe_artifact import (
    build_context_protocol_lineage,
    build_spe_artifact,
    dumps_spe_artifact,
    protected_intent_of,
    verify_integrity,
)
from spe_runtime.portability.browser_recovery_lineage import attach_recovery_to_spe


GOAL = "Build an interactive canvas hero, preserving the canvas and Rotate the scene button."
HEX = "0" * 64


def sha(raw):
    return "sha256:" + hashlib.sha256(
        raw if isinstance(raw, bytes) else raw.encode("utf-8")
    ).hexdigest()


BROKEN = "<html><script>void sceneConfig.theme</script></html>"
REPAIRED = '<!doctype html><main id="spe-app"><canvas id="spe-stage"></canvas><button id="spe-interact">Go</button></main>'


def fixture_spe(*, fmt="spe.artifact.v1", goal=GOAL):
    partial = {
        "created_at_utc": "2026-10-18T00:00:00Z",
        "user_request": goal,
        "category": "CODING",
        "target": "general",
        "envelope": {"frozen": True},
        "rendered_prompt": goal,
        "intent": {
            "goal": goal, "hard_constraints": [{"statement": "preserve canvas"}],
            "authority_state": {"status": "NONE", "level": 0, "grants": []},
        },
        "lineage": {"engine": "existing-spe-rust-wasm", "not_a_release": True},
    }
    cp = None
    if fmt == "spe.artifact.v2":
        cp = build_context_protocol_lineage(
            context_snapshot_ids=["ctx-1"], protocol_id="context-v1",
            protocol_version="1", depth="STANDARD", adapter_id="local",
            freshness_state="FRESH", quality_record={
                "required_nodes": ["render"], "completed_nodes": [],
                "unknown_nodes": ["render"], "prompt_digest": sha(goal),
            }, prompt_digest=sha(goal),
        )
    return build_spe_artifact(partial, spe_format=fmt, context_protocol=cp)


def observation(html, passed):
    return {
        "candidateDigest": sha(html),
        "screenshotDigest": sha(b"fake-screen") if passed else None,
        "checks": {
            "applicationVisible": passed,
            "canvasVisible": passed,
            "interactionWorking": passed,
        },
        "errors": [] if passed else ["ReferenceError: sceneConfig is not defined"],
        "passed": passed,
        "evidenceKind": "REAL_EPHEMERAL_CHROMIUM_OBSERVATION",
    }


def fixture_manifest(directory: Path, *, repaired=True, provenance="FIXTURE"):
    directory.mkdir(parents=True, exist_ok=True)
    repair_prompt = "FIX: MUST NOT reference sceneConfig unless defined."
    first = observation(BROKEN, False)
    second = observation(REPAIRED if repaired else BROKEN, repaired)
    attempts = [
        {"phase": "INITIAL", "promptDigest": sha(GOAL), "observation": first},
        {"phase": "REPAIR", "promptDigest": sha(repair_prompt), "observation": second},
    ]
    record = {
        "schema": "spe.live_crash_recovery.acceptance.v0",
        "protectedGoal": GOAL,
        "protectedGoalDigest": sha(GOAL),
        "initialPromptDigest": sha(GOAL),
        "provenance": provenance,
        "qualification": (
            ("FIXTURE_REPAIRED_NOT_LIVE" if provenance == "FIXTURE"
             else "BROWSER_REPAIRED_PROVIDER_UNATTESTED")
            if repaired else "FAILED_BOUNDED_REPAIR"
        ),
        "attempts": attempts,
        "repair": {"prompt": repair_prompt, "sourceCandidateDigest": first["candidateDigest"]},
        "artifactDigest": second["candidateDigest"],
    }
    if repaired:
        filename = "browser-passed-" + sha(REPAIRED)[7:23] + ".html"
        (directory / filename).write_text(REPAIRED, encoding="utf8")
        record["browserPassedArtifact"] = {"file": filename, "digest": sha(REPAIRED)}
    return record


@pytest.mark.parametrize("fmt", ["spe.artifact.v1", "spe.artifact.v2"])
def test_canonical_artifact_preserved_and_roundtrips(tmp_path, fmt):
    before = fixture_spe(fmt=fmt)
    old = copy.deepcopy(before)
    manifest = fixture_manifest(tmp_path)
    result = attach_recovery_to_spe(before, manifest, tmp_path)
    assert before == old, "Original .spe was mutated"
    assert protected_intent_of(result) == protected_intent_of(before)
    for key in ("rendered_prompt", "context_protocol", "wasm", "lineage", "envelope", "intent"):
        assert result.get(key) == before.get(key)
    assert verify_integrity(result)["integrity"]["state"] == "VERIFIED"
    assert json.loads(dumps_spe_artifact(result)) == result
    er = result["execution_record"]
    assert er["disposition"] == "REVIEW_ONLY_UNATTESTED"
    assert er["execution_authority"] == "NONE"
    assert er["qualification_claim"] == "FIXTURE_REPAIRED_NOT_LIVE"
    assert er["browser_passed_artifact_digest"] == sha(REPAIRED)
    assert er["attempts"][0]["browser_pass_claim"] is False
    assert er["attempts"][1]["browser_pass_claim"] is True
    assert er["known_limitations"]
    assert "receipt" not in er


@pytest.mark.parametrize("attack", [
    "goal", "goalDigest", "promptDigest", "candidate", "repairSource",
    "repairPrompt", "fileBytes", "filePath", "savedDigest",
    "noScreenshot", "fakePass", "fakeModelQualification", "provenance",
])
def test_adversarial_recovery_import_rejects_false_claims(tmp_path, attack):
    original = fixture_spe()
    manifest = fixture_manifest(tmp_path)
    if attack == "goal":
        manifest["protectedGoal"] = "Different goal"
    elif attack == "goalDigest":
        manifest["protectedGoalDigest"] = sha("Different goal")
    elif attack == "promptDigest":
        manifest["initialPromptDigest"] = sha("Different prompt")
    elif attack == "candidate":
        manifest["artifactDigest"] = sha("bad")
    elif attack == "repairSource":
        manifest["repair"]["sourceCandidateDigest"] = sha("old failure")
    elif attack == "repairPrompt":
        manifest["attempts"][1]["promptDigest"] = sha("a different repair prompt")
    elif attack == "fileBytes":
        fp = next(tmp_path.glob("browser-passed-*"))
        fp.write_text("tampered content", encoding="utf8")
    elif attack == "filePath":
        manifest["browserPassedArtifact"]["file"] = "../../secrets.txt"
    elif attack == "savedDigest":
        manifest["browserPassedArtifact"]["digest"] = sha("not the artifact")
    elif attack == "noScreenshot":
        manifest["attempts"][1]["observation"]["screenshotDigest"] = None
    elif attack == "fakePass":
        manifest["attempts"][1]["observation"]["checks"]["canvasVisible"] = False
    elif attack == "fakeModelQualification":
        manifest["qualification"] = "LIVE_VERIFIED"
    elif attack == "provenance":
        manifest["provenance"] = "PRODUCTION_TRUSTED"
    with pytest.raises(ValueError):
        attach_recovery_to_spe(original, manifest, tmp_path)


def test_failed_attempt_does_not_claim_browser_success(tmp_path):
    original = fixture_spe()
    manifest = fixture_manifest(tmp_path, repaired=False)
    result = attach_recovery_to_spe(original, manifest, tmp_path)
    assert result["execution_record"]["browser_passed_artifact_digest"] is None
    assert result["execution_record"]["qualification_claim"] == "FAILED_BOUNDED_REPAIR"


def test_source_artifact_mutation_or_existing_execution_record_held(tmp_path):
    original = fixture_spe()
    manifest = fixture_manifest(tmp_path)
    tampered = copy.deepcopy(original)
    tampered["intent"]["goal"] = "A different goal"
    with pytest.raises(ValueError, match="SOURCE_SPE_INTEGRITY_MISMATCH"):
        attach_recovery_to_spe(tampered, manifest, tmp_path)
    used = copy.deepcopy(original)
    used["execution_record"] = {"prior": "keep"}
    from spe_runtime.portability.spe_artifact import compute_integrity
    used["integrity"] = compute_integrity(used)
    with pytest.raises(ValueError, match="RECONCILIATION_REQUIRED"):
        attach_recovery_to_spe(used, manifest, tmp_path)


def test_symlinked_browser_artifact_is_rejected(tmp_path):
    original = fixture_spe()
    manifest = fixture_manifest(tmp_path)
    name = manifest["browserPassedArtifact"]["file"]
    stored = tmp_path / name
    target = tmp_path / "original.txt"
    stored.rename(target)
    stored.symlink_to(target)
    with pytest.raises(ValueError, match="UNTRUSTED_OR_MISSING"):
        attach_recovery_to_spe(original, manifest, tmp_path)


def test_external_command_provider_never_grants_authority(tmp_path):
    manifest = fixture_manifest(tmp_path, provenance="EXTERNAL_COMMAND_UNATTESTED")
    result = attach_recovery_to_spe(fixture_spe(), manifest, tmp_path)
    er = result["execution_record"]
    assert er["qualification_claim"] == "BROWSER_REPAIRED_PROVIDER_UNATTESTED"
    assert er["execution_authority"] == "NONE"
    assert er["disposition"] == "REVIEW_ONLY_UNATTESTED"


def test_real_browser_fixture_export_when_explicitly_available():
    """CI runs this after a real Chromium test exported its observed fixture."""
    folder = os.getenv("SPE_R0_CHROMIUM_EVIDENCE_DIR")
    if not folder:
        pytest.skip("No browser harness export supplied: unit-only proof")
    path = Path(folder)
    manifest = json.loads((path / "living-spe-recovery.json").read_text(encoding="utf-8"))
    assert manifest["provenance"] == "FIXTURE"
    assert manifest["qualification"] == "FIXTURE_REPAIRED_NOT_LIVE"
    result = attach_recovery_to_spe(fixture_spe(), manifest, path)
    assert verify_integrity(result)["integrity"]["state"] == "VERIFIED"
    assert result["execution_record"]["browser_passed_artifact_digest"] == (
        manifest["browserPassedArtifact"]["digest"]
    )
