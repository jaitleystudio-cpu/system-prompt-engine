"""Semantic Channel Matrix and Risk-Weighted Semantic Distance calculations."""

from __future__ import annotations

import math
from typing import Dict, List, Optional, Tuple

from spe_runtime.diagnosability.models import (
    DiagnosabilityEnvelope,
    FaultClass,
    SemanticChannelMatrix,
    SensorSpec,
)


def build_calibrated_channel_matrix(
    model_id: str,
    workload_type: str,
    sensors: List[SensorSpec],
    faults: List[FaultClass],
    fault_sensor_map: Optional[Dict[str, str]] = None,
) -> SemanticChannelMatrix:
    """Builds a calibrated SemanticChannelMatrix based on sensor specs and fault profiles."""
    table: Dict[str, Dict[str, float]] = {}

    # Common semantic synonym mappings between faults and sensors
    synonyms = {
        "stale": ["fresh", "freshness", "stale"],
        "retrieval": ["fresh", "freshness", "retrieval"],
        "args": ["arg", "argument", "validator"],
        "malformed": ["arg", "argument", "schema"],
        "authority": ["auth", "authority", "lease"],
        "revoked": ["auth", "authority"],
        "tool": ["tool", "router"],
        "injection": ["injection", "jailbreak"],
        "poison": ["injection", "poison"],
        "budget": ["budget", "spend"],
        "overrun": ["budget", "spend"],
        "schema": ["schema", "conformance"],
        "mismatch": ["schema", "conformance"],
        "concurrency": ["concurrency", "race"],
        "race": ["concurrency", "race"],
    }

    for fault in faults:
        table[fault.fault_id] = {}
        target_sensor_id = fault_sensor_map.get(fault.fault_id) if fault_sensor_map else None

        for sensor in sensors:
            f_key = fault.fault_id.lower()
            s_key = sensor.sensor_id.lower()

            is_match = False
            if target_sensor_id and sensor.sensor_id == target_sensor_id:
                is_match = True
            else:
                tokens = f_key.split("_")[1:]
                for t in tokens:
                    if t in s_key or any(syn in s_key for syn in synonyms.get(t, [])):
                        is_match = True
                        break

            if is_match:
                # Target sensor for this fault -> sensitivity
                p = sensor.sensitivity
            else:
                # Non-target sensor -> false positive rate = 1.0 - specificity
                p = max(0.01, 1.0 - sensor.specificity)

            table[fault.fault_id][sensor.sensor_id] = round(p, 4)

    return SemanticChannelMatrix(
        model_id=model_id,
        workload_type=workload_type,
        sensors=sensors,
        faults=faults,
        likelihood_table=table,
    )


def compute_bernoulli_js_divergence(p1: float, p2: float) -> float:
    """Jensen-Shannon divergence between two Bernoulli distributions."""
    p1 = max(1e-6, min(1.0 - 1e-6, p1))
    p2 = max(1e-6, min(1.0 - 1e-6, p2))
    m = 0.5 * (p1 + p2)

    def kl(p, q):
        return p * math.log(p / q) + (1.0 - p) * math.log((1.0 - p) / (1.0 - q))

    js = 0.5 * kl(p1, m) + 0.5 * kl(p2, m)
    return max(0.0, js)


def compute_risk_weighted_semantic_distance(
    channel: SemanticChannelMatrix,
    f1_id: str,
    f2_id: str,
) -> float:
    """Computes Risk-Weighted Semantic Distance d_Omega between two failure classes."""
    fault_map = {f.fault_id: f for f in channel.faults}
    f1 = fault_map.get(f1_id)
    f2 = fault_map.get(f2_id)
    if not f1 or not f2:
        raise ValueError(f"Unknown fault ID: {f1_id} or {f2_id}")

    # Risk weight is driven by the maximum consequence of misdiagnosing either fault
    risk_weight = max(f1.severity_weight, f2.severity_weight)

    t1 = channel.likelihood_table.get(f1_id, {})
    t2 = channel.likelihood_table.get(f2_id, {})

    total_divergence = 0.0
    for sensor in channel.sensors:
        s_id = sensor.sensor_id
        p1 = t1.get(s_id, 0.05)
        p2 = t2.get(s_id, 0.05)
        total_divergence += compute_bernoulli_js_divergence(p1, p2)

    return round(risk_weight * total_divergence, 4)


def calculate_diagnosability_envelope(
    channel: SemanticChannelMatrix,
    min_separation_threshold: float = 0.25,
) -> DiagnosabilityEnvelope:
    """Evaluates pairwise separability and calculates total Observability Debt (OD)."""
    fault_ids = [f.fault_id for f in channel.faults]

    diagnosable: List[str] = []
    ambiguous_pairs: List[Tuple[str, str]] = []
    fault_min_dist: Dict[str, float] = {fid: float("inf") for fid in fault_ids}

    for i in range(len(fault_ids)):
        for j in range(i + 1, len(fault_ids)):
            fid1 = fault_ids[i]
            fid2 = fault_ids[j]
            dist = compute_risk_weighted_semantic_distance(channel, fid1, fid2)

            fault_min_dist[fid1] = min(fault_min_dist[fid1], dist)
            fault_min_dist[fid2] = min(fault_min_dist[fid2], dist)

            if dist < min_separation_threshold:
                ambiguous_pairs.append((fid1, fid2))

    undiagnosable: List[str] = []
    for fid, m_dist in fault_min_dist.items():
        if m_dist >= min_separation_threshold:
            diagnosable.append(fid)
        else:
            undiagnosable.append(fid)

    # Observability Debt = sum_i Risk(F_i) * [1 - Diagnosability(F_i)]
    total_risk = sum(f.severity_weight for f in channel.faults)
    debt_accum = 0.0
    for f in channel.faults:
        m_dist = fault_min_dist.get(f.fault_id, 0.0)
        diag_degree = min(1.0, m_dist / min_separation_threshold) if min_separation_threshold > 0 else 1.0
        debt_accum += f.severity_weight * (1.0 - diag_degree)

    normalized_od = round(debt_accum / total_risk, 4) if total_risk > 0 else 0.0
    overall_min_dist = min(fault_min_dist.values()) if fault_min_dist else 0.0

    return DiagnosabilityEnvelope(
        diagnosable_faults=diagnosable,
        ambiguous_pairs=ambiguous_pairs,
        undiagnosable_faults=undiagnosable,
        observability_debt=normalized_od,
        minimum_semantic_distance=round(overall_min_dist, 4),
    )
