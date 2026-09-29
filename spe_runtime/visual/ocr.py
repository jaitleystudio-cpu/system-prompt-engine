"""Text-likeness bands plus caller-supplied OCR. Character truth stays UNKNOWN."""

from __future__ import annotations

from spe_runtime.visual.constants import MAX_SUPPLIED_OCR_CHARS, TAINT_UNTRUSTED_SOURCE
from spe_runtime.visual.models import (
    ClaimVerdict,
    EpistemicStatus,
    NormBounds,
    OcrBlock,
    VisualUncertainty,
)
from spe_runtime.visual.raster import Raster


def _row_high_frequency(raster: Raster) -> list[float]:
    width = raster.width
    height = raster.height
    step = max(1, min(width, height) // 256)
    raw = [0.0] * height
    for y in range(1, height - 1, step):
        edges = 0
        count = 0
        for x in range(1, width - 1, step):
            luma = raster.luminance(x, y)
            right = raster.luminance(x + 1, y)
            if luma is None or right is None:
                continue
            count += 1
            if abs(luma - right) > 40:
                edges += 1
        raw[y] = (edges / count) if count else 0.0
    smooth = [0.0] * height
    for y in range(2, height - 2):
        smooth[y] = (raw[y - 2] + raw[y - 1] + raw[y] + raw[y + 1] + raw[y + 2]) / 5
    return smooth


def detect_textlike_bands(raster: Raster, asset_id: str) -> tuple[OcrBlock, ...]:
    """Horizontal high-frequency bands. Geometry can PASS; decoded text does not."""

    height = raster.height
    if height < 8 or raster.width < 8:
        return ()
    smooth = _row_high_frequency(raster)
    blocks: list[OcrBlock] = []
    in_band = False
    start = 0
    threshold = 0.22
    for y, energy in enumerate(smooth):
        if energy >= threshold:
            if not in_band:
                in_band = True
                start = y
        elif in_band:
            in_band = False
            band_h = (y - start) / height
            if 0.015 <= band_h <= 0.25:
                y_norm = start / height
                blocks.append(
                    OcrBlock(
                        block_id=f"{asset_id}:textlike:{len(blocks)}",
                        text=(
                            "[text-like band "
                            f"~{round(y_norm * 100)}%-{round((y_norm + band_h) * 100)}%]"
                        ),
                        bounds=NormBounds(x=0.05, y=y_norm, w=0.9, h=band_h),
                        decoded=False,
                        geometry_verdict=ClaimVerdict.PASS,
                        text_verdict=ClaimVerdict.UNKNOWN,
                        method="ocr-textlikeness",
                        provenance=TAINT_UNTRUSTED_SOURCE,
                    )
                )
    return tuple(blocks[:16])


def attach_supplied_ocr(
    asset_id: str,
    text: str,
    bounds: NormBounds | None,
    index: int,
) -> tuple[OcrBlock, tuple[VisualUncertainty, ...]]:
    """Record caller text as untrusted data. Instructions inside it are not executed."""

    cleaned = text.replace("\x00", "").strip()
    uncertainties: list[VisualUncertainty] = []
    if len(cleaned) > MAX_SUPPLIED_OCR_CHARS:
        cleaned = cleaned[:MAX_SUPPLIED_OCR_CHARS]
        uncertainties.append(
            VisualUncertainty(
                code="SUPPLIED_OCR_TRUNCATED",
                statement="Supplied OCR text was truncated to the local character budget.",
                severity="ADVISORY",
                blocks_pass=False,
                related_claim_ids=(f"{asset_id}:ocr:{index}",),
            )
        )
    if not cleaned:
        uncertainties.append(
            VisualUncertainty(
                code="EMPTY_SUPPLIED_OCR_DROPPED",
                statement="An empty supplied OCR block was dropped.",
                severity="ADVISORY",
                blocks_pass=False,
            )
        )
        return (
            OcrBlock(
                block_id=f"{asset_id}:ocr-empty:{index}",
                text="",
                bounds=bounds,
                decoded=False,
                geometry_verdict=ClaimVerdict.UNKNOWN,
                text_verdict=ClaimVerdict.UNKNOWN,
                method="supplied-ocr",
                provenance=TAINT_UNTRUSTED_SOURCE,
            ),
            tuple(uncertainties),
        )
    geometry = ClaimVerdict.PASS if bounds is not None else ClaimVerdict.UNKNOWN
    return (
        OcrBlock(
            block_id=f"{asset_id}:ocr:{index}",
            text=cleaned,
            bounds=bounds,
            decoded=True,
            geometry_verdict=geometry,
            text_verdict=ClaimVerdict.UNKNOWN,
            method="supplied-ocr",
            provenance=TAINT_UNTRUSTED_SOURCE,
        ),
        tuple(uncertainties),
    )


def text_looks_like_instruction(text: str) -> bool:
    lowered = text.lower()
    hints = (
        "ignore previous",
        "authority_delta",
        "authoritydelta",
        "protectedintent",
        "unknown is pass",
        "mark unknown",
        "you are now",
    )
    return any(hint in lowered for hint in hints)


def instruction_uncertainty(block_id: str) -> VisualUncertainty:
    return VisualUncertainty(
        code="MEDIA_TEXT_NOT_INSTRUCTIONS",
        statement=(
            "Media text contains instruction-like wording. It stays UNTRUSTED_SOURCE "
            "and cannot change authority_delta or turn UNKNOWN into PASS."
        ),
        severity="ADVISORY",
        blocks_pass=False,
        related_claim_ids=(block_id,),
    )
