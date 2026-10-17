"""Unit tests verifying Level 6 Swarm Truth Validation & Byzantine Resilience.

Enforces:
  1. Exact artifact digest verification (rejects fake or mismatched sha256).
  2. Valid evidence provenance (rejects empty or malformed witnesses).
  3. Actual qualification result (rejects REJECTED / SUSPENDED capsules).
  4. Executable-to-evidence binding (rejects crashing or syntax-error procedures).
  5. Five simulated peers CANNOT approve malformed or disproved capabilities.
  6. Valid, qualified capability achieves BFT quorum consensus.
"""

from __future__ import annotations

import hashlib
import json
import pytest

from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CapabilityContracts,
    CapabilityGuards,
    CapabilityWitness,
    CausalInterventions,
    ProcedureFormat,
    ProcedurePayload,
    RevocationRules,
    TransferMatrix,
)
from spe_runtime.swarm.swarm_mesh import SwarmMesh


def make_test_capsule(
    capsule_id: str = "cap_test_01",
    payload: str = '{"op": "pick", "fields": ["a"]}',
    declared_sha: str = "",
    admission_state: AdmissionState = AdmissionState.DEPLOYMENT_ELIGIBLE,
    witness_hash: str = "",
    lcb_delta: float = 0.25,
) -> CapabilityCapsule:
    actual_sha = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    w_hash = witness_hash if witness_hash else hashlib.sha256(b"valid_proof").hexdigest()

    witnesses = [
        CapabilityWitness(
            witness_id="wit_01",
            verified_at="2026-10-10T12:00:00Z",
            proof_type="Wald_SPRT",
            hash=w_hash,
        )
    ] if witness_hash != "EMPTY" else []

    return CapabilityCapsule(
        capsule_id=capsule_id,
        name="Test Validation Capsule",
        version="1.0.0",
        admission_state=admission_state,
        procedure=ProcedurePayload(
            format=ProcedureFormat.AST_JSON,
            entrypoint="pick",
            payload=payload,
            sha256=declared_sha if declared_sha else actual_sha,
        ),
        contracts=CapabilityContracts(
            input_schema={"type": "object", "properties": {"a": {"type": "integer"}}},
            output_schema={"type": "object"},
            deterministic=True,
        ),
        guards=CapabilityGuards(),
        witnesses=witnesses,
        interventions=CausalInterventions(
            trial_count=10,
            active_success_rate=1.0,
            baseline_success_rate=0.0,
            placebo_success_rate=0.0,
            lcb_95_delta=lcb_delta,
        ),
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )


def test_swarm_approves_valid_qualified_capsule():
    """Valid, qualified capsule with verified digest and evidence achieves quorum."""
    mesh = SwarmMesh()
    capsule = make_test_capsule()
    receipt = mesh.run_capsule_consensus(capsule)
    assert receipt.quorum_achieved is True
    assert receipt.votes_for >= 5
    assert receipt.votes_against == 0


def test_swarm_rejects_artifact_digest_mismatch():
    """Peers reject capsule if declared sha256 does not match actual payload sha256."""
    mesh = SwarmMesh()
    fake_sha = "a" * 64
    capsule = make_test_capsule(declared_sha=fake_sha)
    receipt = mesh.run_capsule_consensus(capsule)
    assert receipt.quorum_achieved is False
    assert receipt.votes_for == 0
    assert receipt.votes_against >= 5


def test_swarm_rejects_empty_or_invalid_witnesses():
    """Peers reject capsule with missing witnesses or invalid witness hash."""
    mesh = SwarmMesh()
    capsule_no_wit = make_test_capsule(witness_hash="EMPTY")
    receipt = mesh.run_capsule_consensus(capsule_no_wit)
    assert receipt.quorum_achieved is False
    assert receipt.votes_for == 0

    capsule_short_wit = make_test_capsule(witness_hash="short_invalid_hash")
    receipt2 = mesh.run_capsule_consensus(capsule_short_wit)
    assert receipt2.quorum_achieved is False
    assert receipt2.votes_for == 0


def test_swarm_rejects_disproved_or_unqualified_state():
    """Peers reject capsule that has REJECTED, SUSPENDED, or HYPOTHESIS admission state."""
    mesh = SwarmMesh()
    for bad_state in [AdmissionState.REJECTED, AdmissionState.SUSPENDED, AdmissionState.HYPOTHESIS]:
        capsule = make_test_capsule(admission_state=bad_state)
        receipt = mesh.run_capsule_consensus(capsule)
        assert receipt.quorum_achieved is False
        assert receipt.votes_for == 0


def test_swarm_rejects_negative_or_zero_causal_delta():
    """Peers reject capsule with non-positive causal evidence delta."""
    mesh = SwarmMesh()
    capsule = make_test_capsule(lcb_delta=0.0)
    receipt = mesh.run_capsule_consensus(capsule)
    assert receipt.quorum_achieved is False
    assert receipt.votes_for == 0


def test_swarm_rejects_crashing_executable_procedure():
    """Peers reject capsule whose executable procedure crashes in sandbox."""
    mesh = SwarmMesh()
    crashing_payload = '{"op": "conditional_clamp", "require_field": "nonexistent"}'
    # But input schema doesn't supply nonexistent field -> clamp/error
    crashing_py_code = """
def run(payload):
    raise RuntimeError("crashing procedure")
"""
    actual_sha = hashlib.sha256(crashing_py_code.encode("utf-8")).hexdigest()
    capsule = CapabilityCapsule(
        capsule_id="cap_crash",
        name="Crashing Capsule",
        version="1.0.0",
        admission_state=AdmissionState.DEPLOYMENT_ELIGIBLE,
        procedure=ProcedurePayload(
            format=ProcedureFormat.PYTHON_SANDBOX,
            entrypoint="run",
            payload=crashing_py_code,
            sha256=actual_sha,
        ),
        contracts=CapabilityContracts(input_schema={}, output_schema={}),
        guards=CapabilityGuards(),
        witnesses=[
            CapabilityWitness("w1", "2026-10-10T12:00:00Z", "Wald_SPRT", hashlib.sha256(b"proof").hexdigest())
        ],
        interventions=CausalInterventions(10, 1.0, 0.0, 0.0, 0.25),
        transfer=TransferMatrix(),
        revocation_rules=RevocationRules(),
    )
    receipt = mesh.run_capsule_consensus(capsule)
    assert receipt.quorum_achieved is False
    assert receipt.votes_for == 0
    assert receipt.votes_against >= 5
