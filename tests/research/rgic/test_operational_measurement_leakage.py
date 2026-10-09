import pytest
from spe_runtime.research.rgic.types import ConceptCandidate, OperationalMeasurement
from spe_runtime.research.rgic.operational_measurement import OperationalMeasurementValidator, MeasurementLeakageError, ObservationDependencyError

def test_operational_measurement_leakage():
    om = OperationalMeasurement(
        procedure_ref="proc_1",
        required_observations=["A", "B"],
        temporal_constraints=[],
        validity_preconditions=[],
        procedure=lambda h: len(h)
    )
    cc = ConceptCandidate(
        concept_id="c_1",
        description="",
        representation_type="NUMERIC",
        operational_definition=om,
        claimed_role="PREDICTIVE",
        competing_explanations=[],
        registered_predictions=[],
        experiment=None,
        observation_refs=[],
        negative_control_refs=[],
        counterexample_refs=[],
        heldout_result_ref=None,
        qualification=None,
        protected_intent_ref="",
        authority_ref="",
        proof_owner_ref=""
    )
    
    # Valid history before target_time
    history = [{"time": 1, "observation_type": "A", "action": "A"}, {"time": 2, "observation_type": "B", "action": "B"}]
    assert OperationalMeasurementValidator.validate_no_leakage(cc, history, target_time=3)
    assert OperationalMeasurementValidator.validate_observation_dependencies(cc, history)
    
    # Invalid history (leakage)
    history_with_leakage = [{"time": 1, "observation_type": "A", "action": "A"}, {"time": 3, "target_outcome": "success"}]
    with pytest.raises(MeasurementLeakageError):
        OperationalMeasurementValidator.validate_no_leakage(cc, history_with_leakage, target_time=3)
        
    # Invalid history (dependency)
    history_with_dependency = [{"time": 1, "observation_type": "A", "action": "A"}, {"time": 2, "observation_type": "C", "action": "C"}]
    with pytest.raises(ObservationDependencyError):
        OperationalMeasurementValidator.validate_observation_dependencies(cc, history_with_dependency)

def test_missing_procedure():
    om = OperationalMeasurement("proc_1", [], [], []) # no procedure
    cc = ConceptCandidate("c", "", "NUMERIC", om, "PREDICTIVE", [], [], None, [], [], [], None, None, "", "", "")
    with pytest.raises(MeasurementLeakageError):
        OperationalMeasurementValidator.validate_no_leakage(cc, [], target_time=1)
