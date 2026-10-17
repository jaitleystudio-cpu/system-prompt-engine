from spe_runtime.research.rgic.types import ConceptCandidate, ClaimedRole, ConceptQualification, OperationalMeasurement
from spe_runtime.research.rgic.qualification_validator import QualificationValidator

def get_dummy_candidate(role=ClaimedRole.PREDICTIVE):
    cq = ConceptQualification("s", [], [])
    om = OperationalMeasurement("p", [], [], [], lambda h: 1)
    return ConceptCandidate("c", "", "NUMERIC", om, role, [], [], None, [], ["neg1"], ["cex1"], None, cq, "", "", "")

def test_qualification_predictive():
    validator = QualificationValidator()
    cc = get_dummy_candidate()
    
    # Base case: delta_pred > 0 and greater than shuffled feedback
    status = validator.evaluate_candidate(cc, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.1)
    assert status == "QUALIFIED"
    
    # Shuffled feedback rejection
    status = validator.evaluate_candidate(cc, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.6)
    assert status == "UNQUALIFIED"

    # Identifiability enforcement -> UNKNOWN
    status = validator.evaluate_candidate(cc, delta_pred=0.5, identifiable=False, shuffled_feedback_delta_pred=0.1)
    assert status == "UNKNOWN"
    
    # History with leakage -> UNQUALIFIED
    history_with_leakage = [{"time": 3, "target_outcome": "success"}]
    status = validator.evaluate_candidate(cc, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.1, history=history_with_leakage, target_time=3)
    assert status == "UNQUALIFIED"

    # Valid history -> QUALIFIED
    valid_history = [{"time": 1, "observation_type": "obs_1"}]
    cc.operational_definition.required_observations = ["obs_1"]
    status = validator.evaluate_candidate(cc, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.1, history=valid_history, target_time=3)
    assert status == "QUALIFIED"

def test_qualification_causal_barrier():
    validator = QualificationValidator()
    cc_causal = get_dummy_candidate(role=ClaimedRole.CAUSAL)
    
    # Without specific causal identification, should fail
    status = validator.evaluate_candidate(cc_causal, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.1, causal_identified=False)
    assert status == "UNQUALIFIED"
    
    # With specific causal identification, should pass
    status = validator.evaluate_candidate(cc_causal, delta_pred=0.5, identifiable=True, shuffled_feedback_delta_pred=0.1, causal_identified=True)
    assert status == "QUALIFIED"
