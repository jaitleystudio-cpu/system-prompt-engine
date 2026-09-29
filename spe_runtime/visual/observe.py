"""Assemble one VisualObservation from local analyzers."""

from __future__ import annotations

from spe_runtime.visual.colors import read_colors
from spe_runtime.visual.constants import REQUIRED_TAINT
from spe_runtime.visual.envelope import SuppliedOcr, VisualAsset
from spe_runtime.visual.hierarchy import read_hierarchy
from spe_runtime.visual.layout import read_composition, read_layout
from spe_runtime.visual.measure import measure_pixels
from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    GridCell,
    OcrBlock,
    VisualObservation,
    VisualProvenance,
    VisualUncertainty,
)
from spe_runtime.visual.objects import read_objects
from spe_runtime.visual.ocr import (
    attach_supplied_ocr,
    detect_textlike_bands,
    instruction_uncertainty,
    text_looks_like_instruction,
)
from spe_runtime.visual.raster import aspect_ratio_label
from spe_runtime.visual.relationships import read_relationships
from spe_runtime.visual.style import read_style
from spe_runtime.visual.typography import read_typography


def _asset_uncertainties(asset_id: str, samples: int, objects: int) -> tuple[VisualUncertainty, ...]:
    found: list[VisualUncertainty] = []
    if samples <= 0:
        found.append(
            VisualUncertainty(
                code="NO_OPAQUE_PIXELS",
                statement="No opaque pixels were sampled, so color and luminance stay UNKNOWN.",
                severity="BLOCKING",
                blocks_pass=True,
                related_claim_ids=(f"{asset_id}:opaque_samples",),
            )
        )
    if samples > 0 and objects == 0:
        found.append(
            VisualUncertainty(
                code="NO_CONTRAST_REGIONS",
                statement="No contrast region cleared the local area threshold.",
                severity="ADVISORY",
                blocks_pass=False,
                related_claim_ids=(f"{asset_id}:objects",),
            )
        )
    return tuple(found)


def observe_asset(
    asset: VisualAsset,
    supplied: tuple[SuppliedOcr, ...],
) -> tuple[VisualObservation, tuple[VisualUncertainty, ...]]:
    stats = measure_pixels(asset.raster)
    colors = read_colors(stats)
    composition = read_composition(stats, asset.source_width, asset.source_height)
    layout = read_layout(asset.raster)
    regions = read_objects(asset.raster, asset.asset_id)
    relationships = read_relationships(regions, asset.asset_id)
    detected = detect_textlike_bands(asset.raster, asset.asset_id)
    extra_uncertainty: list[VisualUncertainty] = []
    supplied_blocks: list[OcrBlock] = []
    for index, block in enumerate(supplied):
        ocr_block, notes = attach_supplied_ocr(
            asset.asset_id, block.text, block.bounds, index
        )
        extra_uncertainty.extend(notes)
        if ocr_block.text:
            supplied_blocks.append(ocr_block)
            if text_looks_like_instruction(ocr_block.text):
                extra_uncertainty.append(instruction_uncertainty(ocr_block.block_id))
    ocr_blocks = detected + tuple(supplied_blocks)
    typography = read_typography(ocr_blocks)
    style = read_style(stats)
    hierarchy = read_hierarchy(regions, asset.asset_id)
    grid = tuple(
        GridCell(
            row=row,
            col=col,
            mean_brightness=None if mean is None else round(mean, 4),
            verdict=ClaimVerdict.PASS if count else ClaimVerdict.UNKNOWN,
        )
        for row, col, mean, count in stats.grid
    )
    provenance = VisualProvenance(
        provenance_id=f"prov:{asset.asset_id}",
        source_asset_ids=(asset.asset_id,),
        method="lite-pixel+structure-heuristic",
        epistemic_status=EpistemicStatus.OBSERVATION,
        taint_labels=REQUIRED_TAINT,
        content_digest=asset.raster.digest,
        authority_delta=0,
        note=(
            "Local deterministic pixel analysis. No cloud vision API. "
            "Style, object class, OCR truth, and semantic equivalence stay UNKNOWN."
        ),
    )
    uncertainties = _asset_uncertainties(asset.asset_id, stats.samples, len(regions))
    uncertainties = uncertainties + tuple(extra_uncertainty)
    megapixels = round((asset.source_width * asset.source_height) / 1_000_000, 2)
    observation = VisualObservation(
        observation_id=f"obs:{asset.asset_id}",
        asset_id=asset.asset_id,
        kind="image",
        width=asset.raster.width,
        height=asset.raster.height,
        source_width=asset.source_width,
        source_height=asset.source_height,
        aspect_ratio=aspect_ratio_label(asset.source_width, asset.source_height),
        megapixels=megapixels,
        file_name=asset.file_name,
        mime_type=asset.mime_type,
        role=asset.role,
        opaque_samples=stats.samples,
        colors=colors,
        grid=grid,
        composition=composition,
        layout=layout,
        objects=regions,
        relationships=relationships,
        typography=typography,
        style=style,
        hierarchy=hierarchy,
        ocr_blocks=ocr_blocks,
        uncertainties=uncertainties,
        provenance=provenance,
    )
    return observation, uncertainties
