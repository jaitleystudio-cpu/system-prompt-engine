"""
SPE Ω — REC-1: Counterfactual Reality Transfer Engine & Discriminating Witness Search.

Determines whether a previously qualified ReliabilityEnvelope remains valid under
a target operating reality (new model revision, modified tool schema, or perturbed
environment) by synthesizing high-EIG counterfactual witnesses and enforcing
authenticated transfer receipts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
from typing import Any, Dict, List, Optional, Sequence, Tuple

from spe_runtime.prompt.meta_compiler import ProtectedIntent
from spe_runtime.requirements.models import RequirementAtom
from spe_runtime.research.rec.envelope import (
    DriftTrigger,
    EnvironmentBinding,
    EnvelopeValidityState,
    EvidenceOrigin,
    ReliabilityEnvelope,
    ReliabilityEnvelopeCompiler,
)


@dataclass(frozen=True)
class TargetRealitySpec:
    """Specification of a candidate target reality to evaluate for capability transfer."""

    target_model_id: str
    target_model_digest: str
    target_environment: EnvironmentBinding
    perturbation_magnitude: float = 0.0


@dataclass(frozen=True)
class DiscriminatingWitnessProbe:
    """A counterfactual witness probe designed to discriminate source vs target reality behavior."""

    probe_id: str
    target_dimension: str
    expected_information_gain: float
    perturbation_payload: Dict[str, Any] = field(default_factory=dict)
    rationale: str = ""


@dataclass(frozen=True)
class RealityTransferResult:
    """Outcome of evaluating counterfactual reality transfer."""

    transfer_state: EnvelopeValidityState
    transfer_authorized: bool
    executed_witness_ids: Tuple[str, ...]
    failed_witness_ids: Tuple[str, ...]
    requalification_obligations: Tuple[str, ...]
    reason: str


class CounterfactualWitnessSearch:
    """
    Synthesizes discriminating counterfactual witness probes where source reality
    assumptions and target reality characteristics diverge.
    """

    def synthesize_discriminating_witnesses(
        self,
        *,
        source_envelope: ReliabilityEnvelope,
        target_reality: TargetRealitySpec,
    ) -> Tuple[DiscriminatingWitnessProbe, ...]:
        probes: List[DiscriminatingWitnessProbe] = []
        src_env = source_envelope.environment_binding
        tgt_env = target_reality.target_environment

        # 1. Check runtime or schema divergence
        if src_env.runtime_id != tgt_env.runtime_id or src_env.schema_version != tgt_env.schema_version:
            probe_hash = hashlib.sha256(
                f"{source_envelope.envelope_id}:runtime:{src_env.runtime_id}->{tgt_env.runtime_id}".encode("utf-8")
            ).hexdigest()[:12]
            probes.append(
                DiscriminatingWitnessProbe(
                    probe_id=f"PROBE-RT-{probe_hash}",
                    target_dimension="runtime_and_schema_boundary",
                    expected_information_gain=0.45,
                    perturbation_payload={
                        "source_runtime": src_env.runtime_id,
                        "target_runtime": tgt_env.runtime_id,
                        "source_schema": src_env.schema_version,
                        "target_schema": tgt_env.schema_version,
                    },
                    rationale="Discriminate execution semantics across runtime and schema version shift.",
                )
            )

        # 2. Check tool permissions & assumption predicate divergence
        if (
            src_env.tool_permissions != tgt_env.tool_permissions
            or src_env.assumption_predicates != tgt_env.assumption_predicates
        ):
            probe_hash = hashlib.sha256(
                f"{source_envelope.envelope_id}:predicates:{tgt_env.tool_permissions}".encode("utf-8")
            ).hexdigest()[:12]
            probes.append(
                DiscriminatingWitnessProbe(
                    probe_id=f"PROBE-PRED-{probe_hash}",
                    target_dimension="environment_assumption_predicates",
                    expected_information_gain=0.52,
                    perturbation_payload={
                        "source_predicates": src_env.assumption_predicates,
                        "target_predicates": tgt_env.assumption_predicates,
                        "target_tools": list(tgt_env.tool_permissions),
                    },
                    rationale="Challenge altered environment assumptions and tool surface.",
                )
            )

        # 3. Check perturbation radius overflow
        if target_reality.perturbation_magnitude > source_envelope.coverage_scope.supported_perturbation_radius:
            probe_hash = hashlib.sha256(
                f"{source_envelope.envelope_id}:pert:{target_reality.perturbation_magnitude}".encode("utf-8")
            ).hexdigest()[:12]
            probes.append(
                DiscriminatingWitnessProbe(
                    probe_id=f"PROBE-PERT-{probe_hash}",
                    target_dimension="perturbation_radius_exceedance",
                    expected_information_gain=0.38,
                    perturbation_payload={
                        "perturbation_magnitude": target_reality.perturbation_magnitude,
                        "supported_radius": source_envelope.coverage_scope.supported_perturbation_radius,
                    },
                    rationale="Test stability outside calibrated perturbation radius.",
                )
            )

        # 4. Always include at least one invariant boundary probe
        if len(probes) < 2:
            probe_hash = hashlib.sha256(
                f"{source_envelope.envelope_id}:invariant:baseline".encode("utf-8")
            ).hexdigest()[:12]
            probes.append(
                DiscriminatingWitnessProbe(
                    probe_id=f"PROBE-INV-{probe_hash}",
                    target_dimension="protected_intent_invariant_preservation",
                    expected_information_gain=0.25,
                    perturbation_payload={"intent_digest": source_envelope.intent_digest},
                    rationale="Verify ProtectedIntent invariant preservation in target reality.",
                )
            )

        return tuple(probes)


class RealityTransferEngine:
    """
    Evaluates and enforces counterfactual reality transfer rules between source
    ReliabilityEnvelopes and target execution environments.
    """

    def __init__(self, compiler: ReliabilityEnvelopeCompiler) -> None:
        self.compiler = compiler

    def evaluate_reality_transfer(
        self,
        *,
        source_envelope: ReliabilityEnvelope,
        protected_intent: ProtectedIntent,
        requirements: Sequence[RequirementAtom],
        target_reality: TargetRealitySpec,
        witness_outcomes: Dict[str, bool],
        allow_synthetic_calibration_execution: bool = False,
    ) -> RealityTransferResult:
        # 1. Enforce Evidence-Origin Firewall first
        ds = source_envelope.dataset_commitment
        if not allow_synthetic_calibration_execution and (
            ds.is_synthetic
            or ds.evidence_origin == EvidenceOrigin.SYNTHETIC_FIXTURE
            or ds.dataset_id.lower().startswith("synth-")
        ):
            return RealityTransferResult(
                transfer_state=EnvelopeValidityState.SYNTHETIC_CALIBRATION_ONLY,
                transfer_authorized=False,
                executed_witness_ids=tuple(sorted(witness_outcomes.keys())),
                failed_witness_ids=(),
                requalification_obligations=("REAL_WORLD_INDEPENDENT_EVIDENCE_REQUIRED",),
                reason="Synthetic fixture envelope cannot authorize production reality transfer.",
            )

        # 2. Check counterfactual witness outcomes
        executed_ids = tuple(sorted(witness_outcomes.keys()))
        failed_ids = tuple(sorted(pid for pid, passed in witness_outcomes.items() if not passed))

        # 3. Evaluate envelope against target reality via canonical compiler
        env_eval = self.compiler.evaluate_envelope(
            source_envelope,
            protected_intent=protected_intent,
            requirements=requirements,
            current_model_digest=target_reality.target_model_digest,
            current_environment=target_reality.target_environment,
            current_dependency_hashes=source_envelope.dependency_hashes,
            task_category=source_envelope.coverage_scope.task_category,
            task_complexity=source_envelope.coverage_scope.max_complexity_score * 0.8,
            perturbation_magnitude=target_reality.perturbation_magnitude,
            allow_synthetic_calibration_execution=allow_synthetic_calibration_execution,
        )

        if env_eval.state == EnvelopeValidityState.INVALID:
            return RealityTransferResult(
                transfer_state=EnvelopeValidityState.INVALID,
                transfer_authorized=False,
                executed_witness_ids=executed_ids,
                failed_witness_ids=failed_ids,
                requalification_obligations=("BLOCKED_ON_INVALID_ENVELOPE",),
                reason=env_eval.reason,
            )

        if failed_ids or env_eval.state == EnvelopeValidityState.STALE or not executed_ids:
            obligations: List[str] = []
            for fid in failed_ids:
                obligations.append(f"RESOLVE_COUNTERFACTUAL_WITNESS:{fid}")
            for trig in env_eval.triggered_drift_events:
                obligations.append(f"REQUALIFY_ON_{trig}")
            for req in requirements:
                obligations.append(f"VERIFY_REQ:{req.semantic_key}")
            if not executed_ids:
                obligations.append("EXECUTE_DISCRIMINATING_WITNESSES")

            return RealityTransferResult(
                transfer_state=EnvelopeValidityState.STALE,
                transfer_authorized=False,
                executed_witness_ids=executed_ids,
                failed_witness_ids=failed_ids,
                requalification_obligations=tuple(obligations),
                reason=(
                    f"Counterfactual reality transfer rejected (STALE): "
                    f"failed_witnesses={list(failed_ids)}, drift_events={list(env_eval.triggered_drift_events)}"
                ),
            )

        return RealityTransferResult(
            transfer_state=EnvelopeValidityState.VALID,
            transfer_authorized=True,
            executed_witness_ids=executed_ids,
            failed_witness_ids=(),
            requalification_obligations=(),
            reason="All counterfactual witnesses passed and target reality matches envelope bindings.",
        )
