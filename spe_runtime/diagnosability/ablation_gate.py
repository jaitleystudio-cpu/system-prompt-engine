"""SPE diagnosability owner R9: controlled contrast against sham/negative controls.

A pair of benchmark gains does not establish an internal model root cause.
This module checks that paired captured-outcome experiments are internally
consistent, test the SAME frozen case set, include competing explanations, and
discriminate a prespecified intervention from a negative/sham control.

All captures are untrusted until separately linked to authorized provider
traces and independent verification. No calls, writes or publication.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass

from spe_runtime.failure_genome.paired_evaluation import PairedEvaluation
from spe_runtime.proof_graph.graph import CausalProofGraph
from spe_runtime.proof_graph.models import (
    CausalEdge, CausalNode, EdgeType, NodeType,
)

_HYPOTHESIS = re.compile(r"^[A-Z][A-Z0-9_]{3,63}$")


@dataclass(frozen=True)
class AblationStudy:
    hypothesis_id: str
    competing_hypotheses: tuple[str, ...]
    primary: PairedEvaluation
    sham_control: PairedEvaluation
    prespecified_minimum_delta: float = 0.10
    maximum_sham_delta: float = 0.02


@dataclass(frozen=True)
class AblationAssessment:
    state: str
    reason_codes: tuple[str, ...]
    hypothesis_id: str
    primary_delta: float | None
    sham_delta: float | None
    evidence_graph: dict[str, object]
    experiment_structure_valid: bool
    independent_real_model_proven: bool = False
    proprietary_provider_internal_cause_proven: bool = False
    prompt_repair_validated_for_publication: bool = False
    publication_authorized: bool = False


def _internally_consistent(e: object) -> bool:
    if not isinstance(e, PairedEvaluation):
        return False
    n = e.tasks * e.trials_per_task
    if not (
        type(e.tasks) is int and type(e.trials_per_task) is int
        and 20 <= e.tasks <= 2000 and 1 <= e.trials_per_task <= 20
        and 0 < n <= 4000
        and e.split == "HELD_OUT"
        and isinstance(e.suite_digest, str) and len(e.suite_digest) == 64
        and all(c in "0123456789abcdef" for c in e.suite_digest)
        and e.evidence_class == "SUPPLIED_OUTPUTS_UNVERIFIED"
        and type(e.baseline_successes) is int and type(e.candidate_successes) is int
        and 0 <= e.baseline_successes <= n and 0 <= e.candidate_successes <= n
        and type(e.discordant_baseline_only) is int and type(e.discordant_candidate_only) is int
        and 0 <= e.discordant_baseline_only <= n
        and 0 <= e.discordant_candidate_only <= n
        and e.discordant_candidate_only - e.discordant_baseline_only == e.candidate_successes - e.baseline_successes
        and e.discordant_candidate_only + e.discordant_baseline_only <= n
        and isinstance(e.paired_success_delta, (float, int))
        and math.isfinite(e.paired_success_delta)
        and -1 <= e.paired_success_delta <= 1
        and abs(e.paired_success_delta - (e.candidate_successes - e.baseline_successes)/n) <= 0.0000015
        and isinstance(e.regression_task_ids, tuple)
        and len(e.regression_task_ids) <= e.discordant_baseline_only
        and e.publication_authorized is False
        and e.remote_model_replay_proven is False
        and e.causal_root_cause_proven is False
        and e.repair_validated_for_publication is False
    ):
        return False
    return True


def assess_controlled_ablation(study: AblationStudy) -> AblationAssessment:
    """Return *only* a candidate signal or HOLD, NEVER provider internal proof."""
    hypothesis = getattr(study, "hypothesis_id", "UNKNOWN")
    issues: set[str] = set()
    if not isinstance(study, AblationStudy):
        issues.add("STUDY_MALFORMED")
    else:
        if (
            not isinstance(hypothesis, str) or not _HYPOTHESIS.fullmatch(hypothesis)
            or not isinstance(study.competing_hypotheses, tuple)
            or len(set(study.competing_hypotheses)) < 2
            or hypothesis in study.competing_hypotheses
            or any(not isinstance(s, str) or not _HYPOTHESIS.fullmatch(s) for s in study.competing_hypotheses)
        ):
            issues.add("ALTERNATIVE_HYPOTHESES_NOT_PRESPECIFIED")
        if (
            not isinstance(study.prespecified_minimum_delta, (int, float))
            or not math.isfinite(study.prespecified_minimum_delta)
            or not 0.05 <= study.prespecified_minimum_delta <= 0.50
            or not isinstance(study.maximum_sham_delta, (int, float))
            or not math.isfinite(study.maximum_sham_delta)
            or not 0 <= study.maximum_sham_delta <= 0.10
        ):
            issues.add("PRE_REGISTERED_THRESHOLDS_INVALID")
        if not _internally_consistent(study.primary) or not _internally_consistent(study.sham_control):
            issues.add("PAIRED_EVALUATION_INCONSISTENT")
        else:
            a, b = study.primary, study.sham_control
            if (a.suite_digest, a.tasks, a.trials_per_task) != (b.suite_digest, b.tasks, b.trials_per_task):
                issues.add("CONTROL_COMPARISON_MISMATCH")
            if a.regression_task_ids or a.discordant_baseline_only:
                issues.add("PRIMARY_CAUSED_REGRESSIONS")
            if a.paired_success_delta < study.prespecified_minimum_delta:
                issues.add("PRIMARY_GAIN_BELOW_THRESHOLD")
            if abs(b.paired_success_delta) > study.maximum_sham_delta:
                issues.add("SHAM_CONTROL_CHANGED_TOO_MUCH")

    primary_delta = study.primary.paired_success_delta if isinstance(study, AblationStudy) and _internally_consistent(study.primary) else None
    sham_delta = study.sham_control.paired_success_delta if isinstance(study, AblationStudy) and _internally_consistent(study.sham_control) else None
    structural_signal = not issues

    graph = CausalProofGraph()
    graph.add_node(CausalNode(
        "intervention", NodeType.CANDIDATE_REPAIR,
        "Prespecified intervention hypothesis — not a model root cause",
        {"hypothesis_id": hypothesis if isinstance(hypothesis, str) else "UNKNOWN"},
    ))
    if structural_signal:
        graph.add_node(CausalNode(
            "ablation_outcome", NodeType.EVIDENCE,
            "Unverified controlled contrast on supplied outputs",
            {"scope": "SUPPLIED_OUTPUTS_ONLY",
             "primary_delta": primary_delta, "sham_delta": sham_delta},
        ))
        graph.add_edge(CausalEdge(
            "ablation_support", "intervention", "ablation_outcome", EdgeType.EVIDENCED_BY,
        ))
    state = "STRUCTURAL_ABLATION_SIGNAL_ONLY" if structural_signal else "HOLD"
    if structural_signal:
        issues.add("REMOTE_PROVENANCE_AND_INDEPENDENT_CAUSAL_EVIDENCE_MISSING")
    return AblationAssessment(
        state=state,
        reason_codes=tuple(sorted(issues)),
        hypothesis_id=hypothesis if isinstance(hypothesis, str) else "UNKNOWN",
        primary_delta=primary_delta,
        sham_delta=sham_delta,
        evidence_graph=graph.to_dict(),
        experiment_structure_valid=structural_signal,
    )
