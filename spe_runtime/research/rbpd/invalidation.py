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
    """Describes a code/prompt edit, requirement/tool/dataset/permission change, environment drift, model update, or revocation."""

    event_type: str
    touched_modules: Tuple[str, ...] = field(default_factory=tuple)
    touched_requirements: Tuple[str, ...] = field(default_factory=tuple)
    touched_tools: Tuple[str, ...] = field(default_factory=tuple)
    violated_assumptions: Dict[str, Any] = field(default_factory=dict)
    new_model_digest: Optional[str] = None
    new_dataset_commitment: Optional[str] = None
    new_environment_fingerprint: Optional[str] = None
    revoked_permissions: Tuple[str, ...] = field(default_factory=tuple)
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

    def _get_upstream_obligations(self, obl_id: str) -> Set[str]:
        """Returns all upstream obligation IDs from explicit bindings and CausalProofGraph edges."""
        upstream = set(self.obligation_dependencies.get(obl_id, set()))
        for edge in self.proof_graph.edges.values():
            if edge.target_id == obl_id and edge.source_id != obl_id:
                upstream.add(edge.source_id)
        return upstream

    def _compute_downstream_cone(self, directly_touched: Set[str]) -> Set[str]:
        """Computes transitive closure of obligations depending on directly_touched obligations."""
        all_obl_ids = set(self.hypergraph.obligations.keys()) | set(self.obligation_dependencies.keys())
        cone = set(directly_touched)
        changed = True
        while changed:
            changed = False
            for obl_id in all_obl_ids:
                upstream_set = self._get_upstream_obligations(obl_id)
                if obl_id not in cone and (upstream_set & cone):
                    cone.add(obl_id)
                    changed = True
        return cone

    def compute_requalification_plan(self, event: InvalidationEvent) -> RequalificationPlan:
        """
        Evaluates all registered obligations under the given InvalidationEvent and partitions
        them into reused (VALID), stale (STALE), invalid (INVALID), and unknown (UNKNOWN).
        Enforces sound transitive propagation over multi-hop and diamond dependency graphs.
        """
        directly_touched_obls: Set[str] = set()
        for mod in event.touched_modules:
            directly_touched_obls.update(self.module_to_obligations.get(mod, set()))

        if event.touched_requirements:
            req_set = set(event.touched_requirements)
            for obl_id, asset in self.assets_by_obligation.items():
                if set(asset.requirement_atoms) & req_set:
                    directly_touched_obls.add(obl_id)

        if event.touched_tools:
            tool_set = set(event.touched_tools)
            for obl_id, base_assump in self.base_assumptions.items():
                bound_tool = base_assump.get("tool")
                bound_tools = base_assump.get("tools", ())
                if (bound_tool and str(bound_tool) in tool_set) or (
                    isinstance(bound_tools, (list, tuple, set)) and (set(str(t) for t in bound_tools) & tool_set)
                ) or (self.obligation_to_modules.get(obl_id, set()) & tool_set):
                    directly_touched_obls.add(obl_id)

        if event.revoked_permissions:
            perm_set = set(event.revoked_permissions)
            for obl_id, asset in self.assets_by_obligation.items():
                base_assump = self.base_assumptions.get(obl_id, {})
                if (
                    asset.authority_grant_id in perm_set
                    or asset.authority_scope in perm_set
                    or str(base_assump.get("permission", "")) in perm_set
                ):
                    directly_touched_obls.add(obl_id)

        # Also check if any obligation's assumptions are directly violated by event.violated_assumptions
        for obl_id, base_assump in self.base_assumptions.items():
            for k, v in event.violated_assumptions.items():
                if k in base_assump and base_assump[k] != v:
                    directly_touched_obls.add(obl_id)

        transitive_cone = self._compute_downstream_cone(directly_touched_obls)

        verdicts: Dict[str, AssetValidationVerdict] = {}
        revoked_oracles = (event.revoked_oracle_id,) if event.revoked_oracle_id else ()

        for obl_id in sorted(self.hypergraph.obligations.keys()):
            asset = self.assets_by_obligation.get(obl_id)
            if asset is None:
                verdicts[obl_id] = AssetValidationVerdict(
                    status=EpistemicStatus.UNKNOWN,
                    can_reuse=False,
                    reason="No asset registered for obligation",
                )
                continue

            # Determine current subject, slice, assumptions, and model digest for this obligation
            if obl_id in directly_touched_obls and (
                any(m in self.obligation_to_modules.get(obl_id, set()) for m in event.touched_modules)
                or (event.touched_requirements and (set(asset.requirement_atoms) & set(event.touched_requirements)))
            ):
                curr_subject = hashlib.sha256(
                    f"mutated-subject:{obl_id}:{','.join(event.touched_modules)}:{','.join(event.touched_requirements)}".encode(
                        "utf-8"
                    )
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

            if event.touched_tools and obl_id in directly_touched_obls:
                if "tool" in curr_assumptions:
                    curr_assumptions["tool"] = f"mutated:{','.join(event.touched_tools)}"
                if "tools" in curr_assumptions:
                    curr_assumptions["tools"] = [f"mutated:{t}" for t in event.touched_tools]

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
                current_environment_fingerprint=event.new_environment_fingerprint,
                current_evaluation_dataset_commitment=event.new_dataset_commitment,
            )

            if event.revoked_permissions and obl_id in directly_touched_obls and verdict.status != EpistemicStatus.INVALID:
                verdict = AssetValidationVerdict(
                    status=EpistemicStatus.INVALID,
                    can_reuse=False,
                    reason=f"Authority/permission revoked for '{obl_id}': {', '.join(event.revoked_permissions)}",
                    triggered_invalidations=(InvalidationTrigger.AUTHORITY_SCOPE_CHANGED.value,),
                )

            verdicts[obl_id] = verdict

        # Fixed-point transitive propagation across multi-hop and diamond dependency graphs:
        # 1. Any obligation with an unregistered or UNKNOWN upstream dependency becomes UNKNOWN.
        # 2. Any VALID obligation with an INVALID or STALE upstream dependency becomes STALE.
        changed = True
        while changed:
            changed = False
            for obl_id in sorted(self.hypergraph.obligations.keys()):
                current_verdict = verdicts[obl_id]
                if current_verdict.status != EpistemicStatus.VALID:
                    continue
                upstream_ids = self._get_upstream_obligations(obl_id)
                for up_id in sorted(upstream_ids):
                    up_verdict = verdicts.get(up_id)
                    if up_verdict is None or up_verdict.status == EpistemicStatus.UNKNOWN:
                        verdicts[obl_id] = AssetValidationVerdict(
                            status=EpistemicStatus.UNKNOWN,
                            can_reuse=False,
                            reason=f"Conservative UNKNOWN: upstream dependency '{up_id}' is UNKNOWN or unregistered",
                            triggered_invalidations=(InvalidationTrigger.DEPENDENCY_EVIDENCE_CHANGED.value,),
                        )
                        changed = True
                        break
                    if up_verdict.status in (EpistemicStatus.INVALID, EpistemicStatus.STALE):
                        verdicts[obl_id] = AssetValidationVerdict(
                            status=EpistemicStatus.STALE,
                            can_reuse=False,
                            reason=(
                                f"Asset is STALE due to transitive upstream invalidation from '{up_id}' "
                                f"({up_verdict.status.value})"
                            ),
                            triggered_invalidations=(
                                InvalidationTrigger.PROOF_SLICE_CHANGED.value,
                                InvalidationTrigger.DEPENDENCY_EVIDENCE_CHANGED.value,
                            ),
                        )
                        changed = True
                        break

        reused: List[str] = []
        stale: List[str] = []
        invalid: List[str] = []
        unknown: List[str] = []
        for obl_id in sorted(self.hypergraph.obligations.keys()):
            v = verdicts[obl_id]
            if v.status == EpistemicStatus.VALID:
                reused.append(obl_id)
            elif v.status == EpistemicStatus.STALE:
                stale.append(obl_id)
            elif v.status == EpistemicStatus.INVALID:
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
