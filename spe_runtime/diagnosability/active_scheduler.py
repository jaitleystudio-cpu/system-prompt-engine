"""Active Syndrome Scheduler: Value-of-Information (VOI) probe scheduling."""

from __future__ import annotations

import math
from typing import Callable, Dict, List, Optional, Tuple

from spe_runtime.diagnosability.decoder import BayesianSyndromeDecoder
from spe_runtime.diagnosability.models import (
    DiagnosticResult,
    SemanticChannelMatrix,
    SensorSpec,
)


class ActiveSyndromeScheduler:
    """Schedules the cheapest next diagnostic observation that maximizes Value of Information."""

    def __init__(self, decoder: Optional[BayesianSyndromeDecoder] = None, max_probes: int = 5):
        self.decoder = decoder or BayesianSyndromeDecoder()
        self.max_probes = max_probes

    def compute_shannon_entropy(self, probabilities: Dict[str, float]) -> float:
        """Shannon entropy H(F) of current fault posterior distribution."""
        entropy = 0.0
        for p in probabilities.values():
            if p > 1e-6:
                entropy -= p * math.log2(p)
        return entropy

    def compute_sensor_voi(
        self,
        sensor: SensorSpec,
        current_posteriors: Dict[str, float],
        channel: SemanticChannelMatrix,
    ) -> float:
        """Computes Value of Information: VOI = (Delta_Risk + Delta_Uncertainty) / Cost."""
        p_s1 = sum(
            channel.likelihood_table.get(fid, {}).get(sensor.sensor_id, 0.05) * p
            for fid, p in current_posteriors.items()
        )
        p_s1 = max(1e-4, min(1.0 - 1e-4, p_s1))

        # Expected entropy after observing S
        h_current = self.compute_shannon_entropy(current_posteriors)
        
        # Dispersion of likelihoods across plausible faults
        likelihoods = [
            channel.likelihood_table.get(fid, {}).get(sensor.sensor_id, 0.05)
            for fid, p in current_posteriors.items()
            if p > 0.05
        ]
        dispersion = max(likelihoods) - min(likelihoods) if likelihoods else 0.5
        expected_info_gain = max(0.1, dispersion * h_current)

        cost = max(1e-4, sensor.execution_cost_usd)
        voi = expected_info_gain / cost
        return round(voi, 4)

    def schedule_and_decode(
        self,
        initial_syndrome: Dict[str, float],
        channel: SemanticChannelMatrix,
        oracle_evaluator: Callable[[str], float],
        target_confidence: float = 0.80,
    ) -> DiagnosticResult:
        """Dynamically queries probes in descending VOI order until diagnosis is resolved."""
        current_syndrome = dict(initial_syndrome)
        executed_probes = list(current_syndrome.keys())
        total_cost = sum(
            next((s.execution_cost_usd for s in channel.sensors if s.sensor_id == pid), 0.001)
            for pid in executed_probes
        )

        res = self.decoder.decode(current_syndrome, channel, total_cost, executed_probes)
        if res.confidence >= target_confidence and not res.is_unknown_family:
            return res

        available_sensors = [s for s in channel.sensors if s.sensor_id not in current_syndrome]

        for _ in range(self.max_probes):
            if not available_sensors:
                break

            # Pick sensor with highest VOI
            scored_sensors = [
                (s, self.compute_sensor_voi(s, res.posterior_probabilities, channel))
                for s in available_sensors
            ]
            scored_sensors.sort(key=lambda item: item[1], reverse=True)
            best_sensor, best_voi = scored_sensors[0]

            # Execute oracle probe
            probe_obs = oracle_evaluator(best_sensor.sensor_id)
            current_syndrome[best_sensor.sensor_id] = probe_obs
            executed_probes.append(best_sensor.sensor_id)
            total_cost += best_sensor.execution_cost_usd
            available_sensors.remove(best_sensor)

            res = self.decoder.decode(current_syndrome, channel, total_cost, executed_probes)
            if res.confidence >= target_confidence and not res.is_unknown_family:
                break

        return res
