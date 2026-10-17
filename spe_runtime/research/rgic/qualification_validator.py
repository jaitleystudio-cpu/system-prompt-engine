from spe_runtime.research.rgic.types import ConceptCandidate, ClaimedRole
from typing import List, Dict, Any

class QualificationValidator:
    def evaluate_candidate(
        self,
        candidate: ConceptCandidate,
        delta_pred: float,
        identifiable: bool,
        shuffled_feedback_delta_pred: float,
        causal_identified: bool = False,
        history: List[Dict[str, Any]] = None,
        target_time: int = 0
    ) -> str:
        """
        Evaluates promotion conjuncts: operational definition validity, 
        observation timing/leakage check, held-out predictive improvement, 
        negative/shuffled feedback control, identifiability check, and causal vs predictive barrier.
        """
        if not candidate.operational_definition or not candidate.operational_definition.procedure:
            candidate.qualification.status = "UNQUALIFIED"
            return "UNQUALIFIED"
            
        from spe_runtime.research.rgic.operational_measurement import OperationalMeasurementValidator, MeasurementLeakageError, ObservationDependencyError
        if history is not None:
            try:
                OperationalMeasurementValidator.validate_no_leakage(candidate, history, target_time)
                OperationalMeasurementValidator.validate_observation_dependencies(candidate, history)
            except (MeasurementLeakageError, ObservationDependencyError):
                candidate.qualification.status = "UNQUALIFIED"
                return "UNQUALIFIED"
                
        if not identifiable:
            # Retain UNKNOWN when observationally equivalent
            candidate.qualification.status = "UNKNOWN"
            return "UNKNOWN"
            
        if shuffled_feedback_delta_pred >= delta_pred:
            candidate.qualification.status = "UNQUALIFIED"
            return "UNQUALIFIED"
            
        if delta_pred <= 0:
            candidate.qualification.status = "UNQUALIFIED"
            return "UNQUALIFIED"
            
        # Causal claim requires specific identification evidence beyond just prediction
        if candidate.claimed_role == ClaimedRole.CAUSAL:
            if not causal_identified:
                candidate.qualification.status = "UNQUALIFIED"
                return "UNQUALIFIED"
                
        candidate.qualification.status = "QUALIFIED"
        return "QUALIFIED"
