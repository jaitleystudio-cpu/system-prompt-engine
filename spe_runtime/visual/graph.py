"""VisualEvidenceGraph. Edges inform; they never promote UNKNOWN to PASS."""

from __future__ import annotations

from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    ImageComparison,
    VisualEvidenceEdge,
    VisualEvidenceGraph,
    VisualEvidenceNode,
    VisualObservation,
)


def _status(
    verdict: ClaimVerdict,
    unknown: EpistemicStatus = EpistemicStatus.MODEL_JUDGMENT,
) -> EpistemicStatus:
    if verdict is ClaimVerdict.FAIL or verdict is ClaimVerdict.PASS:
        return EpistemicStatus.OBSERVATION
    return unknown


class _Bag:
    def __init__(self) -> None:
        self.nodes: list[VisualEvidenceNode] = []
        self.edges: list[VisualEvidenceEdge] = []

    def add(
        self,
        node_id: str,
        claim: str,
        value: str,
        verdict: ClaimVerdict,
        *,
        method: str,
        asset_ids: tuple[str, ...] = (),
        gates: bool = False,
        provenance_id: str,
        unknown: EpistemicStatus = EpistemicStatus.MODEL_JUDGMENT,
        confidence: float | None = None,
    ) -> str:
        if confidence is None:
            confidence = 1.0 if verdict is ClaimVerdict.PASS else 0.0
        self.nodes.append(
            VisualEvidenceNode(
                node_id=node_id,
                claim=claim,
                value=value,
                verdict=verdict,
                epistemic_status=_status(verdict, unknown),
                confidence=confidence,
                method=method,
                asset_ids=asset_ids,
                gates_contract=gates,
                provenance_id=provenance_id,
            )
        )
        return node_id

    def link(self, source: str, target: str, relation: str) -> None:
        self.edges.append(
            VisualEvidenceEdge(
                edge_id=f"e:{len(self.edges)}:{relation}",
                source_id=source,
                target_id=target,
                relation=relation,
            )
        )


def build_evidence_graph(
    *,
    graph_id: str,
    observations: tuple[VisualObservation, ...],
    comparisons: tuple[ImageComparison, ...],
    asset_count: int,
    mode: str,
    authority_rejected: bool,
    ownership_keys: tuple[str, ...],
    contract_provenance_id: str,
) -> VisualEvidenceGraph:
    bag = _Bag()
    media_verdict = ClaimVerdict.PASS if asset_count else ClaimVerdict.UNKNOWN
    media = bag.add(
        "n:contract:media",
        "media_present",
        str(asset_count),
        media_verdict,
        method="envelope",
        gates=True,
        provenance_id=contract_provenance_id,
        unknown=EpistemicStatus.ABSENT,
    )
    authority_verdict = ClaimVerdict.FAIL if authority_rejected else ClaimVerdict.PASS
    authority = bag.add(
        "n:contract:authority",
        "authority_delta",
        "rejected" if authority_rejected else "0",
        authority_verdict,
        method="lane-e-fence",
        gates=True,
        provenance_id=contract_provenance_id,
    )
    taint = bag.add(
        "n:contract:taint",
        "untrusted_taint",
        "UNTRUSTED_SOURCE,MEDIA_OBSERVATION",
        ClaimVerdict.PASS,
        method="lane-e-fence",
        gates=True,
        provenance_id=contract_provenance_id,
    )
    boundary = bag.add(
        "n:contract:boundary",
        "output_boundary",
        "VisualIntentContract",
        ClaimVerdict.PASS,
        method="lane-e-fence",
        gates=True,
        provenance_id=contract_provenance_id,
    )
    if ownership_keys:
        ownership = bag.add(
            "n:contract:ownership",
            "ownership_fields",
            ",".join(ownership_keys),
            ClaimVerdict.FAIL,
            method="lane-e-fence",
            gates=True,
            provenance_id=contract_provenance_id,
        )
    else:
        ownership = bag.add(
            "n:contract:ownership",
            "ownership_fields",
            "none",
            ClaimVerdict.PASS,
            method="lane-e-fence",
            gates=True,
            provenance_id=contract_provenance_id,
        )
    bag.link(media, boundary, "informs")
    bag.link(authority, boundary, "informs")
    bag.link(taint, boundary, "informs")
    bag.link(ownership, boundary, "informs")
    if mode == "compare":
        arity_verdict = ClaimVerdict.PASS if asset_count >= 2 else ClaimVerdict.UNKNOWN
        bag.add(
            "n:contract:compare_arity",
            "compare_arity",
            str(asset_count),
            arity_verdict,
            method="envelope",
            gates=True,
            provenance_id=contract_provenance_id,
            unknown=EpistemicStatus.ABSENT,
        )

    raster_ids: dict[str, str] = {}
    for obs in observations:
        asset = obs.asset_id
        prov = obs.provenance.provenance_id
        raster_id = bag.add(
            f"n:{asset}:raster",
            "raster_decoded",
            f"{obs.width}x{obs.height}",
            ClaimVerdict.PASS,
            method="raster",
            asset_ids=(asset,),
            gates=True,
            provenance_id=prov,
        )
        raster_ids[asset] = raster_id
        opaque_verdict = ClaimVerdict.PASS if obs.opaque_samples > 0 else ClaimVerdict.UNKNOWN
        opaque_id = bag.add(
            f"n:{asset}:opaque",
            "opaque_samples",
            str(obs.opaque_samples),
            opaque_verdict,
            method="lite-pixel",
            asset_ids=(asset,),
            gates=True,
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bag.link(raster_id, opaque_id, "informs")
        bright = bag.add(
            f"n:{asset}:brightness",
            "brightness_mean",
            "" if obs.style.brightness_mean is None else str(obs.style.brightness_mean),
            obs.style.brightness_verdict,
            method=obs.style.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bag.link(opaque_id, bright, "informs")
        bag.add(
            f"n:{asset}:edge",
            "edge_density",
            "" if obs.style.edge_density is None else str(obs.style.edge_density),
            obs.style.edge_verdict,
            method="lite-pixel",
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        color_verdict = ClaimVerdict.PASS if obs.colors else ClaimVerdict.UNKNOWN
        bag.add(
            f"n:{asset}:colors",
            "dominant_colors",
            ",".join(item.hex for item in obs.colors),
            color_verdict,
            method="lite-pixel",
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        orient = bag.add(
            f"n:{asset}:orientation",
            "orientation",
            obs.composition.orientation,
            obs.composition.orientation_verdict,
            method=obs.composition.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bag.link(raster_id, orient, "informs")
        bag.add(
            f"n:{asset}:symmetry_score",
            "symmetry_score",
            "" if obs.composition.symmetry_score is None else str(obs.composition.symmetry_score),
            obs.composition.symmetry_score_verdict,
            method=obs.composition.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bias = bag.add(
            f"n:{asset}:bias",
            "composition_bias",
            obs.composition.bias_suggestion,
            obs.composition.bias_verdict,
            method="structure-heuristic",
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.link(bright, bias, "informs")
        bag.add(
            f"n:{asset}:symmetry_label",
            "symmetry_label",
            obs.composition.symmetry_label,
            obs.composition.symmetry_label_verdict,
            method="structure-heuristic",
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.add(
            f"n:{asset}:projection_columns",
            "projection_columns",
            "" if obs.layout.projection_columns is None else str(obs.layout.projection_columns),
            obs.layout.projection_columns_verdict,
            method=obs.layout.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bag.add(
            f"n:{asset}:semantic_columns",
            "semantic_columns",
            "UNKNOWN",
            obs.layout.semantic_columns_verdict,
            method=obs.layout.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.add(
            f"n:{asset}:projection_rows",
            "projection_rows",
            "" if obs.layout.projection_rows is None else str(obs.layout.projection_rows),
            obs.layout.projection_rows_verdict,
            method=obs.layout.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=EpistemicStatus.ABSENT,
        )
        bag.add(
            f"n:{asset}:semantic_rows",
            "semantic_rows",
            "UNKNOWN",
            obs.layout.semantic_rows_verdict,
            method=obs.layout.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        kind = bag.add(
            f"n:{asset}:style_kind",
            "style_kind",
            obs.style.kind_suggestion,
            obs.style.kind_verdict,
            method=obs.style.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.link(bright, kind, "informs")
        bag.add(
            f"n:{asset}:lighting",
            "lighting",
            obs.style.lighting_suggestion,
            obs.style.lighting_verdict,
            method=obs.style.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.add(
            f"n:{asset}:palette_mood",
            "palette_mood",
            obs.style.palette_mood,
            obs.style.palette_mood_verdict,
            method=obs.style.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.add(
            f"n:{asset}:textlike_count",
            "textlike_band_count",
            str(obs.typography.band_count),
            obs.typography.band_count_verdict,
            method=obs.typography.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        density = bag.add(
            f"n:{asset}:density",
            "typography_density",
            obs.typography.density_suggestion,
            obs.typography.density_verdict,
            method=obs.typography.method,
            asset_ids=(asset,),
            provenance_id=prov,
        )
        bag.link(f"n:{asset}:textlike_count", density, "informs")
        scale_unknown = (
            EpistemicStatus.OBSERVATION
            if obs.typography.scale_verdict is ClaimVerdict.PASS
            else EpistemicStatus.ABSENT
        )
        bag.add(
            f"n:{asset}:scale",
            "textlike_scale_ratios",
            ",".join(str(item) for item in obs.typography.scale_ratios),
            obs.typography.scale_verdict,
            method=obs.typography.method,
            asset_ids=(asset,),
            provenance_id=prov,
            unknown=scale_unknown,
        )
        for region in obs.objects:
            bounds_id = bag.add(
                f"n:{region.object_id}:bounds",
                "region_bounds",
                f"{region.bounds.x},{region.bounds.y},{region.bounds.w},{region.bounds.h}",
                region.bounds_verdict,
                method=region.method,
                asset_ids=(asset,),
                provenance_id=prov,
            )
            class_id = bag.add(
                f"n:{region.object_id}:class",
                "object_class",
                region.class_label,
                region.class_verdict,
                method=region.method,
                asset_ids=(asset,),
                provenance_id=prov,
            )
            bag.link(raster_id, bounds_id, "locates")
            bag.link(bounds_id, class_id, "informs")
        for rel in obs.relationships:
            rel_id = bag.add(
                f"n:{rel.relationship_id}",
                "spatial_relation",
                rel.predicate,
                rel.verdict,
                method=rel.method,
                asset_ids=(asset,),
                provenance_id=prov,
                unknown=rel.epistemic_status
                if rel.verdict is not ClaimVerdict.PASS
                else EpistemicStatus.MODEL_JUDGMENT,
            )
            bag.link(f"n:{rel.subject_id}:bounds", rel_id, "locates")
            bag.link(rel_id, f"n:{rel.object_id}:bounds", "locates")
        for item in obs.hierarchy:
            order_id = bag.add(
                f"n:{item.item_id}:order",
                "reading_order",
                str(item.reading_order),
                item.order_verdict,
                method=item.method,
                asset_ids=(asset,),
                provenance_id=prov,
            )
            role_id = bag.add(
                f"n:{item.item_id}:role",
                "hierarchy_role",
                item.role_label,
                item.role_verdict,
                method=item.method,
                asset_ids=(asset,),
                provenance_id=prov,
            )
            bag.link(f"n:{item.region_id}:bounds", order_id, "informs")
            bag.link(order_id, role_id, "informs")
        for block in obs.ocr_blocks:
            text_status = (
                EpistemicStatus.SUPPLIED_UNTRUSTED
                if block.decoded
                else EpistemicStatus.ABSENT
            )
            bag.add(
                f"n:{block.block_id}:geometry",
                "ocr_geometry",
                block.text if block.bounds is None else (
                    f"{block.bounds.x},{block.bounds.y},{block.bounds.w},{block.bounds.h}"
                ),
                block.geometry_verdict,
                method=block.method,
                asset_ids=(asset,),
                provenance_id=prov,
                unknown=EpistemicStatus.ABSENT,
            )
            text_id = bag.add(
                f"n:{block.block_id}:text",
                "ocr_text",
                block.text,
                block.text_verdict,
                method=block.method,
                asset_ids=(asset,),
                provenance_id=prov,
                unknown=text_status,
            )
            bag.link(f"n:{block.block_id}:geometry", text_id, "informs")

    for index, pair in enumerate(comparisons):
        left = raster_ids[pair.left_asset_id]
        right = raster_ids[pair.right_asset_id]
        identity = bag.add(
            f"n:cmp:{index}:bytes",
            "byte_identity",
            "true" if pair.byte_identical else "false",
            pair.byte_identity_verdict,
            method=pair.method,
            asset_ids=(pair.left_asset_id, pair.right_asset_id),
            provenance_id=contract_provenance_id,
        )
        bag.add(
            f"n:cmp:{index}:scene",
            "semantic_equivalence",
            "UNKNOWN",
            pair.semantic_equivalence_verdict,
            method=pair.method,
            asset_ids=(pair.left_asset_id, pair.right_asset_id),
            provenance_id=contract_provenance_id,
        )
        bag.link(left, identity, "compares")
        bag.link(identity, right, "compares")
        bag.link(identity, f"n:cmp:{index}:scene", "informs")

    return VisualEvidenceGraph(graph_id=graph_id, nodes=tuple(bag.nodes), edges=tuple(bag.edges))
