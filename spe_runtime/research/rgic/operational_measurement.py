from typing import List, Dict, Any
from spe_runtime.research.rgic.types import ConceptCandidate

class MeasurementLeakageError(Exception):
    pass

class ObservationDependencyError(Exception):
    pass

class OperationalMeasurementValidator:
    @staticmethod
    def validate_no_leakage(candidate: ConceptCandidate, history: List[Dict[str, Any]], target_time: int) -> bool:
        """
        Enforces operational measurement procedure z_t = g(h_t)
        Validates timing (no leakage of future target outcome y).
        """
        if not candidate.operational_definition or not candidate.operational_definition.procedure:
            raise MeasurementLeakageError("No operational measurement procedure provided.")
            
        # check if history contains elements from target_time or later
        for event in history:
            if event.get("time", 0) >= target_time:
                raise MeasurementLeakageError("Leakage: Measurement history includes future events.")
                    
        return True

    @staticmethod
    def validate_observation_dependencies(candidate: ConceptCandidate, history: List[Dict[str, Any]]) -> bool:
        """
        Enforces observation dependency checks.
        """
        if not candidate.operational_definition:
            return False
            
        required_obs = set(candidate.operational_definition.required_observations)
        for event in history:
            obs_type = event.get("observation_type")
            if obs_type and obs_type not in required_obs:
                raise ObservationDependencyError(f"Observation dependency failed: {obs_type} not in required observations")
        return True

    @staticmethod
    def compute_measurement(candidate: ConceptCandidate, history: List[Dict[str, Any]]) -> Any:
        if not candidate.operational_definition or not candidate.operational_definition.procedure:
            raise ValueError("Procedure not defined.")
        return candidate.operational_definition.procedure(history)
