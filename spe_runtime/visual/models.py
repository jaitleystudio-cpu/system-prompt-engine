"""Visual input IR. Output stops at VisualIntentContract; Lane A owns the rest."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping

from spe_runtime.visual.constants import (
    AUTHORITY_DELTA_FROM_MEDIA,
    DISPOSITION_ABSTAIN,
    DISPOSITION_READY,
    DOES_NOT_OWN,
    DOWNSTREAM_OWNER,
    LAYER,
    OUTPUT_BOUNDARY,
    REQUIRED_TAINT,
    SCHEMA_VERSION,
    UNTRUSTED_OPEN,
)
from spe_runtime.visual.errors import UnknownLaunderError, VisualAuthorityError, VisualInputError
from spe_runtime.visual.verdict import (
    ClaimVerdict,
    EpistemicStatus,
    assert_unknown_is_not_pass,
    combine_verdicts,
)


class InputMode(str, Enum):
    IMAGE_TO_PROMPT = "image_to_prompt"
    COMPARE = "compare"
    DESCRIBE = "describe"

    def __str__(self) -> str:
        return self.value


def _enum_value(value: Enum) -> str:
    return str(value.value)


def _clamp_unit(value: float, label: str) -> float:
    number = float(value)
    if number < 0.0 or number > 1.0:
        raise VisualInputError(f"{label} must be in [0, 1], got {number}")
    return number


@dataclass(frozen=True)
class NormBounds:
    x: float
    y: float
    w: float
    h: float

    def __post_init__(self) -> None:
        object.__setattr__(self, "x", _clamp_unit(self.x, "bounds.x"))
        object.__setattr__(self, "y", _clamp_unit(self.y, "bounds.y"))
        object.__setattr__(self, "w", _clamp_unit(self.w, "bounds.w"))
        object.__setattr__(self, "h", _clamp_unit(self.h, "bounds.h"))
        if self.x + self.w > 1.001 or self.y + self.h > 1.001:
            raise VisualInputError("bounds extend outside the unit frame")

    def to_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y, "w": self.w, "h": self.h}


@dataclass(frozen=True)
class VisualProvenance:
    provenance_id: str
    source_asset_ids: tuple[str, ...]
    method: str
    epistemic_status: EpistemicStatus
    taint_labels: tuple[str, ...]
    content_digest: str
    authority_delta: int
    note: str

    def __post_init__(self) -> None:
        if not str(self.provenance_id).strip():
            raise VisualInputError("provenance_id is required")
        if int(self.authority_delta) != AUTHORITY_DELTA_FROM_MEDIA:
            raise VisualAuthorityError(
                "authority_delta from media must be 0"
            )
        object.__setattr__(self, "authority_delta", AUTHORITY_DELTA_FROM_MEDIA)
        labels = tuple(str(label) for label in self.taint_labels)
        missing = [label for label in REQUIRED_TAINT if label not in labels]
        if missing:
            raise VisualInputError(
                "visual provenance missing taint labels: " + ", ".join(missing)
            )
        object.__setattr__(self, "taint_labels", labels)
        object.__setattr__(self, "source_asset_ids", tuple(self.source_asset_ids))
        if not str(self.content_digest).startswith("sha256:"):
            raise VisualInputError("content_digest must be a sha256 digest")
        status = self.epistemic_status
        if not isinstance(status, EpistemicStatus):
            status = EpistemicStatus(str(status))
            object.__setattr__(self, "epistemic_status", status)

    def to_dict(self) -> dict[str, Any]:
        return {
            "provenance_id": self.provenance_id,
            "source_asset_ids": list(self.source_asset_ids),
            "method": self.method,
            "epistemic_status": _enum_value(self.epistemic_status),
            "taint_labels": list(self.taint_labels),
            "content_digest": self.content_digest,
            "authority_delta": self.authority_delta,
            "note": self.note,
        }


@dataclass(frozen=True)
class VisualUncertainty:
    code: str
    statement: str
    severity: str
    blocks_pass: bool
    related_claim_ids: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.severity not in {"BLOCKING", "ADVISORY"}:
            raise VisualInputError(f"unknown uncertainty severity {self.severity}")
        if self.severity == "BLOCKING" and not self.blocks_pass:
            raise VisualInputError("BLOCKING uncertainty must set blocks_pass")
        if not str(self.code).strip() or not str(self.statement).strip():
            raise VisualInputError("uncertainty code and statement are required")
        object.__setattr__(self, "blocks_pass", bool(self.blocks_pass))
        object.__setattr__(self, "related_claim_ids", tuple(self.related_claim_ids))

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "statement": self.statement,
            "severity": self.severity,
            "blocks_pass": self.blocks_pass,
            "related_claim_ids": list(self.related_claim_ids),
        }


@dataclass(frozen=True)
class VisualEvidenceNode:
    node_id: str
    claim: str
    value: str
    verdict: ClaimVerdict
    epistemic_status: EpistemicStatus
    confidence: float
    method: str
    asset_ids: tuple[str, ...]
    gates_contract: bool
    provenance_id: str

    def __post_init__(self) -> None:
        verdict = self.verdict if isinstance(self.verdict, ClaimVerdict) else ClaimVerdict(str(self.verdict))
        status = (
            self.epistemic_status
            if isinstance(self.epistemic_status, EpistemicStatus)
            else EpistemicStatus(str(self.epistemic_status))
        )
        assert_unknown_is_not_pass(verdict, status)
        confidence = float(self.confidence)
        if confidence < 0.0 or confidence > 1.0:
            raise VisualInputError("confidence must be in [0, 1]")
        object.__setattr__(self, "verdict", verdict)
        object.__setattr__(self, "epistemic_status", status)
        object.__setattr__(self, "confidence", confidence)
        object.__setattr__(self, "asset_ids", tuple(self.asset_ids))
        object.__setattr__(self, "gates_contract", bool(self.gates_contract))
        if verdict is ClaimVerdict.PASS and not str(self.value).strip() and self.claim != "opaque_samples":
            raise VisualInputError("PASS claim requires a value")

    def to_dict(self) -> dict[str, Any]:
        return {
            "node_id": self.node_id,
            "claim": self.claim,
            "value": self.value,
            "verdict": _enum_value(self.verdict),
            "epistemic_status": _enum_value(self.epistemic_status),
            "confidence": self.confidence,
            "method": self.method,
            "asset_ids": list(self.asset_ids),
            "gates_contract": self.gates_contract,
            "provenance_id": self.provenance_id,
        }


@dataclass(frozen=True)
class VisualEvidenceEdge:
    edge_id: str
    source_id: str
    target_id: str
    relation: str

    def __post_init__(self) -> None:
        if self.relation not in {"informs", "locates", "compares", "contains", "contradicts"}:
            raise VisualInputError(f"unknown evidence relation {self.relation}")

    def to_dict(self) -> dict[str, str]:
        return {
            "edge_id": self.edge_id,
            "source_id": self.source_id,
            "target_id": self.target_id,
            "relation": self.relation,
        }


@dataclass(frozen=True)
class VisualEvidenceGraph:
    graph_id: str
    nodes: tuple[VisualEvidenceNode, ...]
    edges: tuple[VisualEvidenceEdge, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "nodes", tuple(self.nodes))
        object.__setattr__(self, "edges", tuple(self.edges))
        ids = [node.node_id for node in self.nodes]
        if len(ids) != len(set(ids)):
            raise VisualInputError("evidence node ids must be unique")

    def gating_verdict(self) -> ClaimVerdict:
        return combine_verdicts(
            tuple(node.verdict for node in self.nodes if node.gates_contract)
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "graph_id": self.graph_id,
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
        }


@dataclass(frozen=True)
class ColorSwatch:
    hex: str
    share: float
    verdict: ClaimVerdict
    epistemic_status: EpistemicStatus
    method: str

    def __post_init__(self) -> None:
        verdict = self.verdict if isinstance(self.verdict, ClaimVerdict) else ClaimVerdict(self.verdict)
        status = (
            self.epistemic_status
            if isinstance(self.epistemic_status, EpistemicStatus)
            else EpistemicStatus(self.epistemic_status)
        )
        assert_unknown_is_not_pass(verdict, status)
        if not str(self.hex).startswith("#") or len(self.hex) != 7:
            raise VisualInputError("color hex must be #rrggbb")
        object.__setattr__(self, "verdict", verdict)
        object.__setattr__(self, "epistemic_status", status)
        object.__setattr__(self, "share", float(self.share))

    def to_dict(self) -> dict[str, Any]:
        return {
            "hex": self.hex,
            "share": self.share,
            "verdict": _enum_value(self.verdict),
            "epistemic_status": _enum_value(self.epistemic_status),
            "method": self.method,
        }


@dataclass(frozen=True)
class GridCell:
    row: int
    col: int
    mean_brightness: float | None
    verdict: ClaimVerdict

    def to_dict(self) -> dict[str, Any]:
        verdict = self.verdict if isinstance(self.verdict, ClaimVerdict) else ClaimVerdict(self.verdict)
        return {
            "row": self.row,
            "col": self.col,
            "mean_brightness": self.mean_brightness,
            "verdict": _enum_value(verdict),
        }


@dataclass(frozen=True)
class CompositionReading:
    orientation: str
    orientation_verdict: ClaimVerdict
    symmetry_score: float | None
    symmetry_score_verdict: ClaimVerdict
    symmetry_label: str
    symmetry_label_verdict: ClaimVerdict
    bias_suggestion: str
    bias_verdict: ClaimVerdict
    method: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "orientation": self.orientation,
            "orientation_verdict": _enum_value(self.orientation_verdict),
            "symmetry_score": self.symmetry_score,
            "symmetry_score_verdict": _enum_value(self.symmetry_score_verdict),
            "symmetry_label": self.symmetry_label,
            "symmetry_label_verdict": _enum_value(self.symmetry_label_verdict),
            "bias_suggestion": self.bias_suggestion,
            "bias_verdict": _enum_value(self.bias_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class LayoutReading:
    projection_columns: int | None
    projection_columns_verdict: ClaimVerdict
    semantic_columns_verdict: ClaimVerdict
    projection_rows: int | None
    projection_rows_verdict: ClaimVerdict
    semantic_rows_verdict: ClaimVerdict
    gutters: tuple[float, ...]
    row_gaps: tuple[float, ...]
    gutter_verdict: ClaimVerdict
    method: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "projection_columns": self.projection_columns,
            "projection_columns_verdict": _enum_value(self.projection_columns_verdict),
            "semantic_columns_verdict": _enum_value(self.semantic_columns_verdict),
            "projection_rows": self.projection_rows,
            "projection_rows_verdict": _enum_value(self.projection_rows_verdict),
            "semantic_rows_verdict": _enum_value(self.semantic_rows_verdict),
            "gutters": list(self.gutters),
            "row_gaps": list(self.row_gaps),
            "gutter_verdict": _enum_value(self.gutter_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class VisualObject:
    object_id: str
    class_label: str
    class_verdict: ClaimVerdict
    bounds: NormBounds
    area_share: float
    bounds_verdict: ClaimVerdict
    method: str

    def __post_init__(self) -> None:
        class_verdict = (
            self.class_verdict
            if isinstance(self.class_verdict, ClaimVerdict)
            else ClaimVerdict(self.class_verdict)
        )
        if class_verdict is ClaimVerdict.PASS:
            raise UnknownLaunderError("object class labels cannot PASS on the local path")
        if self.class_label != "UNKNOWN":
            raise VisualInputError("local object class_label must stay UNKNOWN")
        object.__setattr__(self, "class_verdict", class_verdict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "object_id": self.object_id,
            "class_label": self.class_label,
            "class_verdict": _enum_value(self.class_verdict),
            "bounds": self.bounds.to_dict(),
            "area_share": self.area_share,
            "bounds_verdict": _enum_value(self.bounds_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class VisualRelationship:
    relationship_id: str
    subject_id: str
    object_id: str
    predicate: str
    verdict: ClaimVerdict
    epistemic_status: EpistemicStatus
    method: str

    def __post_init__(self) -> None:
        verdict = self.verdict if isinstance(self.verdict, ClaimVerdict) else ClaimVerdict(self.verdict)
        status = (
            self.epistemic_status
            if isinstance(self.epistemic_status, EpistemicStatus)
            else EpistemicStatus(self.epistemic_status)
        )
        assert_unknown_is_not_pass(verdict, status)
        allowed = {"left-of", "right-of", "above", "below", "overlaps", "contains", "near"}
        if self.predicate not in allowed:
            raise VisualInputError(f"unknown spatial predicate {self.predicate}")
        object.__setattr__(self, "verdict", verdict)
        object.__setattr__(self, "epistemic_status", status)

    def to_dict(self) -> dict[str, Any]:
        return {
            "relationship_id": self.relationship_id,
            "subject_id": self.subject_id,
            "object_id": self.object_id,
            "predicate": self.predicate,
            "verdict": _enum_value(self.verdict),
            "epistemic_status": _enum_value(self.epistemic_status),
            "method": self.method,
        }


@dataclass(frozen=True)
class TypographyReading:
    band_count: int
    band_count_verdict: ClaimVerdict
    coverage: float
    coverage_verdict: ClaimVerdict
    density_suggestion: str
    density_verdict: ClaimVerdict
    scale_ratios: tuple[float, ...]
    scale_verdict: ClaimVerdict
    method: str

    def __post_init__(self) -> None:
        density_verdict = (
            self.density_verdict
            if isinstance(self.density_verdict, ClaimVerdict)
            else ClaimVerdict(self.density_verdict)
        )
        if density_verdict is ClaimVerdict.PASS:
            raise UnknownLaunderError("typography density is a judgment and cannot PASS")
        object.__setattr__(self, "density_verdict", density_verdict)
        object.__setattr__(self, "scale_ratios", tuple(self.scale_ratios))

    def to_dict(self) -> dict[str, Any]:
        return {
            "band_count": self.band_count,
            "band_count_verdict": _enum_value(self.band_count_verdict),
            "coverage": self.coverage,
            "coverage_verdict": _enum_value(self.coverage_verdict),
            "density_suggestion": self.density_suggestion,
            "density_verdict": _enum_value(self.density_verdict),
            "scale_ratios": list(self.scale_ratios),
            "scale_verdict": _enum_value(self.scale_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class StyleReading:
    kind_suggestion: str
    kind_verdict: ClaimVerdict
    lighting_suggestion: str
    lighting_verdict: ClaimVerdict
    brightness_mean: float | None
    brightness_verdict: ClaimVerdict
    edge_density: float | None
    edge_verdict: ClaimVerdict
    palette_mood: str
    palette_mood_verdict: ClaimVerdict
    method: str

    def __post_init__(self) -> None:
        for label, verdict in (
            ("kind", self.kind_verdict),
            ("lighting", self.lighting_verdict),
            ("palette_mood", self.palette_mood_verdict),
        ):
            parsed = verdict if isinstance(verdict, ClaimVerdict) else ClaimVerdict(verdict)
            if parsed is ClaimVerdict.PASS:
                raise UnknownLaunderError(f"style {label} is a judgment and cannot PASS")

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind_suggestion": self.kind_suggestion,
            "kind_verdict": _enum_value(self.kind_verdict),
            "lighting_suggestion": self.lighting_suggestion,
            "lighting_verdict": _enum_value(self.lighting_verdict),
            "brightness_mean": self.brightness_mean,
            "brightness_verdict": _enum_value(self.brightness_verdict),
            "edge_density": self.edge_density,
            "edge_verdict": _enum_value(self.edge_verdict),
            "palette_mood": self.palette_mood,
            "palette_mood_verdict": _enum_value(self.palette_mood_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class HierarchyItem:
    item_id: str
    region_id: str
    rank: int
    reading_order: int
    order_verdict: ClaimVerdict
    role_label: str
    role_verdict: ClaimVerdict
    method: str

    def __post_init__(self) -> None:
        role_verdict = (
            self.role_verdict
            if isinstance(self.role_verdict, ClaimVerdict)
            else ClaimVerdict(self.role_verdict)
        )
        if role_verdict is ClaimVerdict.PASS or self.role_label != "UNKNOWN":
            raise UnknownLaunderError("hierarchy roles stay UNKNOWN and cannot PASS")
        object.__setattr__(self, "role_verdict", role_verdict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "item_id": self.item_id,
            "region_id": self.region_id,
            "rank": self.rank,
            "reading_order": self.reading_order,
            "order_verdict": _enum_value(self.order_verdict),
            "role_label": self.role_label,
            "role_verdict": _enum_value(self.role_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class OcrBlock:
    block_id: str
    text: str
    bounds: NormBounds | None
    decoded: bool
    geometry_verdict: ClaimVerdict
    text_verdict: ClaimVerdict
    method: str
    provenance: str

    def __post_init__(self) -> None:
        text_verdict = (
            self.text_verdict
            if isinstance(self.text_verdict, ClaimVerdict)
            else ClaimVerdict(self.text_verdict)
        )
        if text_verdict is ClaimVerdict.PASS:
            raise UnknownLaunderError("OCR text truth cannot PASS")
        if self.provenance != "UNTRUSTED_SOURCE":
            raise VisualInputError("OCR provenance must be UNTRUSTED_SOURCE")
        object.__setattr__(self, "text_verdict", text_verdict)
        object.__setattr__(self, "decoded", bool(self.decoded))

    def to_dict(self) -> dict[str, Any]:
        return {
            "block_id": self.block_id,
            "text": self.text,
            "bounds": None if self.bounds is None else self.bounds.to_dict(),
            "decoded": self.decoded,
            "geometry_verdict": _enum_value(self.geometry_verdict),
            "text_verdict": _enum_value(self.text_verdict),
            "method": self.method,
            "provenance": self.provenance,
        }


@dataclass(frozen=True)
class ImageComparison:
    left_asset_id: str
    right_asset_id: str
    byte_identical: bool
    byte_identity_verdict: ClaimVerdict
    same_dimensions: bool
    dimension_verdict: ClaimVerdict
    brightness_delta: float | None
    brightness_delta_verdict: ClaimVerdict
    palette_distance: float | None
    palette_distance_verdict: ClaimVerdict
    semantic_equivalence_verdict: ClaimVerdict
    method: str

    def __post_init__(self) -> None:
        semantic = (
            self.semantic_equivalence_verdict
            if isinstance(self.semantic_equivalence_verdict, ClaimVerdict)
            else ClaimVerdict(self.semantic_equivalence_verdict)
        )
        if semantic is not ClaimVerdict.UNKNOWN:
            raise UnknownLaunderError(
                "semantic image equivalence stays UNKNOWN; byte identity is a separate claim"
            )
        object.__setattr__(self, "semantic_equivalence_verdict", semantic)

    def to_dict(self) -> dict[str, Any]:
        return {
            "left_asset_id": self.left_asset_id,
            "right_asset_id": self.right_asset_id,
            "byte_identical": self.byte_identical,
            "byte_identity_verdict": _enum_value(self.byte_identity_verdict),
            "same_dimensions": self.same_dimensions,
            "dimension_verdict": _enum_value(self.dimension_verdict),
            "brightness_delta": self.brightness_delta,
            "brightness_delta_verdict": _enum_value(self.brightness_delta_verdict),
            "palette_distance": self.palette_distance,
            "palette_distance_verdict": _enum_value(self.palette_distance_verdict),
            "semantic_equivalence_verdict": _enum_value(self.semantic_equivalence_verdict),
            "method": self.method,
        }


@dataclass(frozen=True)
class VisualObservation:
    """One asset after local analysis. Judgments stay inside this record."""

    observation_id: str
    asset_id: str
    kind: str
    width: int
    height: int
    source_width: int
    source_height: int
    aspect_ratio: str
    megapixels: float
    file_name: str | None
    mime_type: str | None
    role: str
    opaque_samples: int
    colors: tuple[ColorSwatch, ...]
    grid: tuple[GridCell, ...]
    composition: CompositionReading
    layout: LayoutReading
    objects: tuple[VisualObject, ...]
    relationships: tuple[VisualRelationship, ...]
    typography: TypographyReading
    style: StyleReading
    hierarchy: tuple[HierarchyItem, ...]
    ocr_blocks: tuple[OcrBlock, ...]
    uncertainties: tuple[VisualUncertainty, ...]
    provenance: VisualProvenance

    def __post_init__(self) -> None:
        if self.kind != "image":
            raise VisualInputError("visual observations in v1 are image-kind only")
        object.__setattr__(self, "colors", tuple(self.colors))
        object.__setattr__(self, "grid", tuple(self.grid))
        object.__setattr__(self, "objects", tuple(self.objects))
        object.__setattr__(self, "relationships", tuple(self.relationships))
        object.__setattr__(self, "hierarchy", tuple(self.hierarchy))
        object.__setattr__(self, "ocr_blocks", tuple(self.ocr_blocks))
        object.__setattr__(self, "uncertainties", tuple(self.uncertainties))

    def to_dict(self) -> dict[str, Any]:
        return {
            "observation_id": self.observation_id,
            "asset_id": self.asset_id,
            "kind": self.kind,
            "width": self.width,
            "height": self.height,
            "source_width": self.source_width,
            "source_height": self.source_height,
            "aspect_ratio": self.aspect_ratio,
            "megapixels": self.megapixels,
            "file_name": self.file_name,
            "mime_type": self.mime_type,
            "role": self.role,
            "opaque_samples": self.opaque_samples,
            "colors": [item.to_dict() for item in self.colors],
            "grid": [item.to_dict() for item in self.grid],
            "composition": self.composition.to_dict(),
            "layout": self.layout.to_dict(),
            "objects": [item.to_dict() for item in self.objects],
            "relationships": [item.to_dict() for item in self.relationships],
            "typography": self.typography.to_dict(),
            "style": self.style.to_dict(),
            "hierarchy": [item.to_dict() for item in self.hierarchy],
            "ocr_blocks": [item.to_dict() for item in self.ocr_blocks],
            "uncertainties": [item.to_dict() for item in self.uncertainties],
            "provenance": self.provenance.to_dict(),
        }


def ownership_record() -> dict[str, Any]:
    return {
        "layer": LAYER,
        "output_boundary": OUTPUT_BOUNDARY,
        "downstream_owner": DOWNSTREAM_OWNER,
        "authority_delta": AUTHORITY_DELTA_FROM_MEDIA,
        "unknown_is_pass": False,
        "does_not_own": list(DOES_NOT_OWN),
    }


def freeze_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return MappingProxyType({str(key): freeze_json(item) for key, item in value.items()})
    if isinstance(value, (list, tuple)):
        return tuple(freeze_json(item) for item in value)
    return value


def thaw_json(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {str(key): thaw_json(item) for key, item in value.items()}
    if isinstance(value, tuple):
        return [thaw_json(item) for item in value]
    return value


@dataclass(frozen=True)
class VisualIntentContract:
    """Sole output boundary of Lane E. Not a ProtectedIntent."""

    contract_id: str
    schema_version: str
    source_envelope_id: str
    mode: str
    observations: tuple[VisualObservation, ...]
    evidence_graph: VisualEvidenceGraph
    uncertainties: tuple[VisualUncertainty, ...]
    provenance: tuple[VisualProvenance, ...]
    comparisons: tuple[ImageComparison, ...]
    verdict: ClaimVerdict
    verdict_reason_codes: tuple[str, ...]
    authority_delta: int
    disposition: str
    prompt_block: str
    prompt_slots: Mapping[str, Any]
    ownership: Mapping[str, Any]

    def __post_init__(self) -> None:
        if self.schema_version != SCHEMA_VERSION:
            raise VisualInputError(f"unsupported schema_version {self.schema_version}")
        if int(self.authority_delta) != AUTHORITY_DELTA_FROM_MEDIA:
            raise VisualAuthorityError("VisualIntentContract.authority_delta must be 0")
        object.__setattr__(self, "authority_delta", AUTHORITY_DELTA_FROM_MEDIA)
        verdict = self.verdict if isinstance(self.verdict, ClaimVerdict) else ClaimVerdict(self.verdict)
        object.__setattr__(self, "verdict", verdict)
        if self.disposition not in {DISPOSITION_READY, DISPOSITION_ABSTAIN}:
            raise VisualInputError(f"unknown disposition {self.disposition}")
        if verdict is ClaimVerdict.PASS and self.disposition != DISPOSITION_READY:
            raise VisualInputError("PASS contracts are READY_FOR_LANE_A")
        if verdict is not ClaimVerdict.PASS and self.disposition != DISPOSITION_ABSTAIN:
            raise VisualInputError("non-PASS contracts abstain")
        object.__setattr__(self, "observations", tuple(self.observations))
        object.__setattr__(self, "uncertainties", tuple(self.uncertainties))
        object.__setattr__(self, "provenance", tuple(self.provenance))
        object.__setattr__(self, "comparisons", tuple(self.comparisons))
        object.__setattr__(self, "verdict_reason_codes", tuple(self.verdict_reason_codes))
        if not self.verdict_reason_codes:
            raise VisualInputError("verdict_reason_codes must be non-empty")
        slots = freeze_json(dict(self.prompt_slots))
        ownership = freeze_json(dict(self.ownership))
        object.__setattr__(self, "prompt_slots", slots)
        object.__setattr__(self, "ownership", ownership)
        if ownership["unknown_is_pass"] is not False:
            raise UnknownLaunderError("unknown_is_pass must be false")
        if ownership["authority_delta"] != 0:
            raise VisualAuthorityError("ownership.authority_delta must be 0")
        if tuple(ownership["does_not_own"]) != DOES_NOT_OWN:
            raise VisualInputError("ownership.does_not_own drifted from the lane fence")
        blocking = any(item.blocks_pass for item in self.uncertainties)
        gating = self.evidence_graph.gating_verdict()
        if verdict is ClaimVerdict.PASS:
            if blocking:
                raise UnknownLaunderError("blocking uncertainty cannot sit on a PASS contract")
            if gating is not ClaimVerdict.PASS:
                raise UnknownLaunderError("gating graph is not PASS")
        if UNTRUSTED_OPEN not in self.prompt_block:
            raise VisualInputError("prompt_block must wrap media as UNTRUSTED_SOURCE")

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract_id": self.contract_id,
            "schema_version": self.schema_version,
            "source_envelope_id": self.source_envelope_id,
            "mode": self.mode,
            "observations": [item.to_dict() for item in self.observations],
            "evidence_graph": self.evidence_graph.to_dict(),
            "uncertainties": [item.to_dict() for item in self.uncertainties],
            "provenance": [item.to_dict() for item in self.provenance],
            "comparisons": [item.to_dict() for item in self.comparisons],
            "verdict": _enum_value(self.verdict),
            "verdict_reason_codes": list(self.verdict_reason_codes),
            "authority_delta": self.authority_delta,
            "disposition": self.disposition,
            "prompt_block": self.prompt_block,
            "prompt_slots": thaw_json(self.prompt_slots),
            "ownership": thaw_json(self.ownership),
        }

