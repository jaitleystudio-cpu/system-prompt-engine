"""
SPE Ω — RBPD Phase B: Sound Invalidation & Selective Re-Qualification.

Computes exact causal invalidation cones over CausalProofGraph and
ObligationHypergraph across the 6 canonical mutation/drift classes:
1. Unrelated module edit -> 0 unaffected obligations invalidated; 100% reused.
2. Direct requirement/module edit -> invalidates touched slice and transitive dependents (STALE).
3. Shared dependency / assumption mutation -> invalidates transitive cone (STALE).
4. Model revision digest change -> invalidates all model-dependent assets (STALE).
5. Oracle trust / version revocation -> transitions affected assets to INVALID.
6. Durable revocation tombstone -> transitions target asset to INVALID permanently.
"""

from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import time
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple

from spe_runtime.proof_graph.graph import CausalProofGraph
from spe_runtime.proof_graph.models import (
    CausalEdge,
    CausalEvidence,
    CausalNode,
    EdgeType,
    NodeType,
)
from spe_runtime.research.lvt.learning_validator import LearningValidator
from spe_runtime.research.rbpd.contract import (
    AssetValidationVerdict,
    EpistemicStatus,
    InvalidationTrigger,
    ProofContractValidator,
    RealityBoundEvidenceAsset,
)
from spe_runtime.research.wdes.witness_hypergraph import (
    HyperEdge,
    HyperEdgeType,
    ObligationHypergraph,
    ObligationNode,
    WitnessNode,
    WitnessType,
)


@dataclass(frozen=True)
class InvalidationEvent:
    """Describes a code/prompt edit, environment assumption drift, model update, or revocation."""

    event_type: str
    touched_modules: Tuple[str, ...] = field(default_factory=tuple)
    violated_assumptions: Dict[str, Any] = field(default_factory=dict)
    new_model_digest: Optional[str] = None
    revoked_oracle_id: Optional[str] = None
    evaluation_time: Optional[float] = None


@dataclass(frozen=True)
class RequalificationPlan:
    """Computed selective re-qualification partition over the obligation graph."""

    reused_obligations: Tuple[str, ...]
    stale_obligations: Tuple[str, ...]
    invalid_obligations: Tuple[str, ...]
    unknown_obligations: Tuple[str, ...]
    verdicts_by_obligation: Dict[str, AssetValidationVerdict]

    @property
    def requires_reverification(self) -> Tuple[str, ...]:
        return tuple(
            sorted(
                set(self.stale_obligations)
                | set(self.invalid_obligations)
                | set(self.unknown_obligations)
            )
        )


class SelectiveRequalificationEngine:
    """
    Tracks obligation-to-module, obligation-to-assumption, and obligation-to-obligation
    dependencies over CausalProofGraph and ObligationHypergraph, and selectively
    invalidates only the affected causal cone on mutation.
    """

    def __init__(
        self,
        contract_validator: ProofContractValidator,
        proof_graph: CausalProofGraph,
        hypergraph: ObligationHypergraph,
    ) -> None:
        self.contract_validator = contract_validator
        self.proof_graph = proof_graph
        self.hypergraph = hypergraph
        self.assets_by_obligation: Dict[str, RealityBoundEvidenceAsset] = {}
        self.module_to_obligations: Dict[str, Set[str]] = {}
        self.obligation_to_modules: Dict[str, Set[str]] = {}
        self.obligation_dependencies: Dict[str, Set[str]] = {}  # obl_id -> upstream obl_ids it depends on
        self.base_subject_digests: Dict[str, str] = {}
        self.base_slice_digests: Dict[str, str] = {}
        self.base_assumptions: Dict[str, Dict[str, Any]] = {}
        self.base_model_digest: str = ""

    def register_obligation_binding(
        self,
        *,
        obligation_id: str,
        modules: Sequence[str],
        upstream_obligations: Sequence[str],
        assumptions: Dict[str, Any],
        asset: RealityBoundEvidenceAsset,
    ) -> None:
        self.assets_by_obligation[obligation_id] = asset
        mod_set = set(modules)
        self.obligation_to_modules[obligation_id] = mod_set
        for m in mod_set:
            self.module_to_obligations.setdefault(m, set()).add(obligation_id)
        self.obligation_dependencies[obligation_id] = set(upstream_obligations)
        self.base_subject_digests[obligation_id] = asset.subject_digest
        self.base_slice_digests[obligation_id] = asset.proof_slice_digest
        self.base_assumptions[obligation_id] = dict(assumptions)
        self.base_model_digest = asset.model_or_runtime_digest

    def revoke_obligation_asset(self, obligation_id: str, *, reason: str) -> None:
        asset = self.assets_by_obligation.get(obligation_id)
        if asset is None:
            raise KeyError(f"Unknown obligation_id '{obligation_id}'")
        self.contract_validator.revoke_asset(asset, reason=reason, details=f"Revoked {obligation_id}")

    def _compute_downstream_cone(self, directly_touched: Set[str]) -> Set[str]:
        """Computes transitive closure of obligations depending on directly_touched obligations."""
        cone = set(directly_touched)
        changed = True
        while changed:
            changed = False
            for obl_id, upstream_set in self.obligation_dependencies.items():
                if obl_id not in cone and (upstream_set & cone):
                    cone.add(obl_id)
                    changed = True
        return cone

    def compute_requalification_plan(self, event: InvalidationEvent) -> RequalificationPlan:
        """
        Evaluates all registered obligations under the given InvalidationEvent and partitions
        them into reused (VALID), stale (STALE), invalid (INVALID), and unknown (UNKNOWN).
        """
        directly_touched_obls: Set[str] = set()
        for mod in event.touched_modules:
            directly_touched_obls.update(self.module_to_obligations.get(mod, set()))

        # Also check if any obligation's assumptions are directly violated by event.violated_assumptions
        for obl_id, base_assump in self.base_assumptions.items():
            for k, v in event.violated_assumptions.items():
                if k in base_assump and base_assump[k] != v:
                    directly_touched_obls.add(obl_id)

        transitive_cone = self._compute_downstream_cone(directly_touched_obls)

        reused: List[str] = []
        stale: List[str] = []
        invalid: List[str] = []
        unknown: List[str] = []
        verdicts: Dict[str, AssetValidationVerdict] = {}

        revoked_oracles = (event.revoked_oracle_id,) if event.revoked_oracle_id else ()

        for obl_id in sorted(self.hypergraph.obligations.keys()):
            asset = self.assets_by_obligation.get(obl_id)
            if asset is None:
                v = AssetValidationVerdict(
                    status=EpistemicStatus.UNKNOWN,
                    can_reuse=False,
                    reason="No asset registered for obligation",
                )
                unknown.append(obl_id)
                verdicts[obl_id] = v
                continue

            # Determine current subject, slice, assumptions, and model digest for this obligation
            if obl_id in directly_touched_obls and any(
                m in self.obligation_to_modules.get(obl_id, set()) for m in event.touched_modules
            ):
                curr_subject = hashlib.sha256(
                    f"mutated-subject:{obl_id}:{','.join(event.touched_modules)}".encode("utf-8")
                ).hexdigest()
            else:
                curr_subject = self.base_subject_digests[obl_id]

            if obl_id in transitive_cone:
                curr_slice = hashlib.sha256(
                    f"mutated-slice:{obl_id}:{event.event_type}".encode("utf-8")
                ).hexdigest()
            else:
                curr_slice = self.base_slice_digests[obl_id]

            curr_assumptions = dict(self.base_assumptions.get(obl_id, {}))
            for k, v in event.violated_assumptions.items():
                if k in curr_assumptions:
                    curr_assumptions[k] = v

            curr_model = (
                event.new_model_digest
                if event.new_model_digest is not None
                else self.base_model_digest
            )

            verdict = self.contract_validator.validate_asset(
                asset,
                current_subject_digest=curr_subject,
                current_proof_slice_digest=curr_slice,
                current_assumptions=curr_assumptions,
                current_model_digest=curr_model,
                current_time=event.evaluation_time,
                revoked_oracles=revoked_oracles,
            )
            verdicts[obl_id] = verdict
            if verdict.status == EpistemicStatus.VALID:
                reused.append(obl_id)
            elif verdict.status == EpistemicStatus.STALE:
                stale.append(obl_id)
            elif verdict.status == EpistemicStatus.INVALID:
                invalid.append(obl_id)
            else:
                unknown.append(obl_id)

        return RequalificationPlan(
            reused_obligations=tuple(reused),
            stale_obligations=tuple(stale),
            invalid_obligations=tuple(invalid),
            unknown_obligations=tuple(unknown),
            verdicts_by_obligation=verdicts,
        )

    @classmethod
    def build_modular_benchmark_graph(
        cls,
        *,
        validator: LearningValidator,
        oracle_signing_key: bytes,
        oracle_public_key: bytes,
        num_modules: int = 10,
    ) -> SelectiveRequalificationEngine:
        """
        Constructs a canonical modular obligation hypergraph and causal proof graph
        with num_modules obligations, where OBL-01 depends on OBL-00 (shared core assumption),
        and OBL-02..OBL-{N-1} are independent modular slices.
        """
        contract_validator = ProofContractValidator(validator=validator)
        proof_graph = CausalProofGraph()
        hypergraph = ObligationHypergraph(
            contract_digest=hashlib.sha256(f"rbpd-modular-{num_modules}".encode("utf-8")).hexdigest()
        )
        engine = cls(
            contract_validator=contract_validator,
            proof_graph=proof_graph,
            hypergraph=hypergraph,
        )

        now = time.time()
        model_digest = hashlib.sha256(b"verified-weights:gpt-4o-2026-08-01").hexdigest()
        protocol_digest = hashlib.sha256(b"rbpd-dual-channel-protocol-v1").hexdigest()

        for i in range(num_modules):
            obl_id = f"OBL-{i:02d}"
            mod_name = f"mod-leaf-{i:02d}"
            req_id = f"REQ-{i:02d}"
            wit_id = f"WIT-{i:02d}"

            # Populate CausalProofGraph
            c_node = CausalNode(
                node_id=obl_id,
                node_type=NodeType.REQUIREMENT,
                label=f"Requirement obligation {obl_id} for {mod_name}",
            )
            proof_graph.add_node(c_node)

            # Populate ObligationHypergraph
            hypergraph.add_obligation(
                ObligationNode(
                    obligation_id=obl_id,
                    description=f"Modular verification obligation {obl_id}",
                    is_safety_critical=(i < 2),
                )
            )
            hypergraph.add_witness(
                WitnessNode(
                    witness_id=wit_id,
                    witness_type=WitnessType.DETERMINISTIC_PROBE,
                    produces_evidence_for=[obl_id],
                    estimated_cost_nanos=1000,
                    estimated_latency_ms=10.0,
                )
            )
            hypergraph.add_hyperedge(
                HyperEdge(
                    edge_id=f"EDGE-{i:02d}",
                    target_obligation_id=obl_id,
                    source_witness_ids={wit_id},
                    edge_type=HyperEdgeType.AND,
                )
            )

            # OBL-01 depends on OBL-00 and shares 'shared_core_assumption'
            upstream = ("OBL-00",) if i == 1 else ()
            if i == 1:
                proof_graph.add_edge(
                    CausalEdge(
                        edge_id="CAUSAL-EDGE-00-01",
                        source_id="OBL-00",
                        target_id="OBL-01",
                        edge_type=EdgeType.DERIVES_FROM,
                    )
                )

            assumptions: Dict[str, Any] = {"module": mod_name, "runtime": "spe-v1"}
            if i == 0:
                assumptions["shared_core_assumption"] = "invariant-v1"

            subj_digest = hashlib.sha256(f"subject:{mod_name}:v1".encode("utf-8")).hexdigest()
            slice_digest = hashlib.sha256(
                f"slice:{obl_id}:{','.join(upstream)}:v1".encode("utf-8")
            ).hexdigest()

            asset = contract_validator.mint_asset(
                asset_id=f"ASSET-{obl_id}",
                claim_id=f"CLAIM-{obl_id}",
                subject_digest=subj_digest,
                requirement_atoms=(req_id,),
                assumption_boundaries=assumptions,
                proof_slice_digest=slice_digest,
                witness_protocol_digest=protocol_digest,
                oracle_identity="oracle-rbpd-01",
                oracle_class="independent_static_oracle",
                model_or_runtime_digest=model_digest,
                model_digest_type="VERIFIED_MODEL_REVISION",
                validity_horizon=now + 7200.0,
                invalidation_triggers=(
                    InvalidationTrigger.SUBJECT_DIGEST_CHANGED.value,
                    InvalidationTrigger.PROOF_SLICE_CHANGED.value,
                    InvalidationTrigger.ASSUMPTION_VIOLATED.value,
                    InvalidationTrigger.MODEL_REVISION_CHANGED.value,
                    InvalidationTrigger.ORACLE_UNTRUSTED.value,
                    InvalidationTrigger.TOMBSTONE_REVOKED.value,
                ),
                generator_id="gpt-4o",
                oracle_signing_key=oracle_signing_key,
                oracle_public_key=oracle_public_key,
                committed_timestamp=now,
            )

            proof_graph.attach_evidence(
                obl_id,
                CausalEvidence(
                    evidence_id=asset.asset_id,
                    evidence_class="OBSERVED_LOCAL",
                    metric="rbpd_epistemic_status",
                    value="VALID",
                    observed_at="2026-10-11T00:00:00Z",
                ),
            )

            engine.register_obligation_binding(
                obligation_id=obl_id,
                modules=(mod_name,),
                upstream_obligations=upstream,
                assumptions=assumptions,
                asset=asset,
            )

        return engine
