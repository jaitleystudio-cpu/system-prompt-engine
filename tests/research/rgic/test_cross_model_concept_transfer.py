import pytest
from spe_runtime.research.rgic.types import ConceptCandidate, ConceptQualification, TransferMapping
from spe_runtime.research.rgic.transfer_adapter import TransferAdapter, EnvironmentShiftError

def get_qualified_candidate():
    cq = ConceptQualification("s", [], [], status="QUALIFIED")
    return ConceptCandidate("c", "", "NUMERIC", None, "PREDICTIVE", [], [], None, [], [], [], None, cq, "", "", "")

def test_cross_model_transfer_success():
    cc = get_qualified_candidate()
    tm = TransferMapping("c", "target_env", lambda x: x)
    
    # Target model independently verifies concept
    success = TransferAdapter.evaluate_transfer(
        mapping=tm,
        source_candidate=cc,
        target_evidence_check=lambda: True,
        environment_drift_detected=False
    )
    assert success is True

def test_cross_model_transfer_target_fails():
    cc = get_qualified_candidate()
    tm = TransferMapping("c", "target_env", lambda x: x)
    
    # Target model fails to verify
    success = TransferAdapter.evaluate_transfer(
        mapping=tm,
        source_candidate=cc,
        target_evidence_check=lambda: False,
        environment_drift_detected=False
    )
    assert success is False

def test_environment_shift_revocation():
    cc = get_qualified_candidate()
    tm = TransferMapping("c", "target_env", lambda x: x)
    
    with pytest.raises(EnvironmentShiftError):
        TransferAdapter.evaluate_transfer(
            mapping=tm,
            source_candidate=cc,
            target_evidence_check=lambda: True,
            environment_drift_detected=True
        )
    
    # Qualification should be revoked
    assert cc.qualification.status == "UNQUALIFIED"
