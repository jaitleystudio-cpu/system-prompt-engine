"""VisualInputEnvelope — the only accepted ingress for Lane E."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from spe_runtime.visual.constants import (
    AUTHORITY_DELTA_FROM_MEDIA,
    MAX_ASSETS,
    MAX_SUPPLIED_OCR_BLOCKS,
    MAX_USER_GOAL_CHARS,
)
from spe_runtime.visual.errors import VisualAuthorityError, VisualInputError
from spe_runtime.visual.models import InputMode, NormBounds
from spe_runtime.visual.raster import Raster

_FORBIDDEN_KEYS = frozenset(
    {
        "protected_intent",
        "protectedIntent",
        "ProtectedIntent",
        "requirement_graph",
        "requirementGraph",
        "xcat",
        "xcat_envelope",
        "k3",
        "quality",
        "quality_record",
        "massive_intent",
        "scholarly",
        "search_seo",
    }
)


@dataclass(frozen=True, eq=False)
class VisualAsset:
    asset_id: str
    raster: Raster
    source_width: int
    source_height: int
    file_name: str | None = None
    mime_type: str | None = None
    role: str = "unspecified"

    def __post_init__(self) -> None:
        if not str(self.asset_id).strip():
            raise VisualInputError("asset_id is required")
        if self.source_width < 1 or self.source_height < 1:
            raise VisualInputError("source dimensions must be positive")
        if self.source_width > 100_000 or self.source_height > 100_000:
            raise VisualInputError("source dimensions exceed the local record cap")


@dataclass(frozen=True, eq=False)
class SuppliedOcr:
    asset_id: str
    text: str
    bounds: NormBounds | None = None


@dataclass(frozen=True, eq=False)
class VisualInputEnvelope:
    envelope_id: str
    assets: tuple[VisualAsset, ...]
    mode: InputMode
    supplied_ocr: tuple[SuppliedOcr, ...] = ()
    user_goal: str = ""
    declared_at: str = ""
    rejected_ownership_keys: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if not str(self.envelope_id).strip():
            raise VisualInputError("envelope_id is required")
        mode = self.mode if isinstance(self.mode, InputMode) else InputMode(str(self.mode))
        object.__setattr__(self, "mode", mode)
        assets = tuple(self.assets)
        if len(assets) > MAX_ASSETS:
            raise VisualInputError(f"at most {MAX_ASSETS} assets")
        ids = [asset.asset_id for asset in assets]
        if len(ids) != len(set(ids)):
            raise VisualInputError("asset ids must be unique")
        supplied = tuple(self.supplied_ocr)
        if len(supplied) > MAX_SUPPLIED_OCR_BLOCKS:
            raise VisualInputError("too many supplied OCR blocks")
        goal = str(self.user_goal)
        if len(goal) > MAX_USER_GOAL_CHARS:
            raise VisualInputError("user_goal exceeds local character budget")
        if len(str(self.declared_at)) > 200:
            raise VisualInputError("declared_at exceeds local character budget")
        object.__setattr__(self, "assets", assets)
        object.__setattr__(self, "supplied_ocr", supplied)
        object.__setattr__(self, "user_goal", goal)
        object.__setattr__(self, "rejected_ownership_keys", tuple(self.rejected_ownership_keys))


def create_envelope(
    *,
    envelope_id: str,
    assets: tuple[VisualAsset, ...],
    mode: InputMode | str,
    supplied_ocr: tuple[SuppliedOcr, ...] = (),
    user_goal: str = "",
    declared_at: str = "",
    authority_delta: int = AUTHORITY_DELTA_FROM_MEDIA,
) -> VisualInputEnvelope:
    """Typed constructor. A non-zero authority delta is refused before analysis."""

    if int(authority_delta) != AUTHORITY_DELTA_FROM_MEDIA:
        raise VisualAuthorityError("authority_delta from media must be 0")
    return VisualInputEnvelope(
        envelope_id=envelope_id,
        assets=assets,
        mode=InputMode(mode),
        supplied_ocr=supplied_ocr,
        user_goal=user_goal,
        declared_at=declared_at,
    )


def _bounds(value: object) -> NormBounds | None:
    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise VisualInputError("OCR bounds must be an object")
    return NormBounds(
        x=float(value["x"]),
        y=float(value["y"]),
        w=float(value["w"]),
        h=float(value["h"]),
    )


def _raster_from_mapping(value: Mapping[str, Any]) -> Raster:
    width = value.get("width")
    height = value.get("height")
    rgba = value.get("rgba")
    if isinstance(width, bool) or isinstance(height, bool):
        raise VisualInputError("raster dimensions must be integers")
    if not isinstance(width, int) or not isinstance(height, int):
        raise VisualInputError("raster dimensions must be integers")
    if isinstance(rgba, bytearray):
        raw = bytes(rgba)
    elif isinstance(rgba, bytes):
        raw = rgba
    elif isinstance(rgba, list):
        if any(isinstance(channel, bool) or not isinstance(channel, int) for channel in rgba):
            raise VisualInputError("rgba list must be integers")
        raw = bytes(rgba)
    else:
        raise VisualInputError("rgba must be bytes or a list of integers")
    return Raster(width, height, raw)


def envelope_from_mapping(payload: Mapping[str, Any]) -> VisualInputEnvelope:
    rejected = tuple(sorted(key for key in payload if key in _FORBIDDEN_KEYS))
    envelope_id = payload.get("envelope_id")
    if not isinstance(envelope_id, str) or not envelope_id.strip():
        raise VisualInputError("envelope_id is required")
    mode = payload.get("mode")
    if not isinstance(mode, str):
        raise VisualInputError("mode is required")
    raw_assets = payload.get("assets", [])
    if not isinstance(raw_assets, list):
        raise VisualInputError("assets must be a list")
    assets: list[VisualAsset] = []
    for item in raw_assets:
        if not isinstance(item, Mapping):
            raise VisualInputError("asset must be an object")
        asset_id = item.get("asset_id")
        if not isinstance(asset_id, str):
            raise VisualInputError("asset_id is required")
        raster = _raster_from_mapping(item)
        source_width = item.get("source_width", raster.width)
        source_height = item.get("source_height", raster.height)
        if isinstance(source_width, bool) or isinstance(source_height, bool):
            raise VisualInputError("source dimensions must be integers")
        if not isinstance(source_width, int) or not isinstance(source_height, int):
            raise VisualInputError("source dimensions must be integers")
        file_name = item.get("file_name")
        mime_type = item.get("mime_type")
        role = item.get("role", "unspecified")
        if file_name is not None and not isinstance(file_name, str):
            raise VisualInputError("file_name must be a string")
        if mime_type is not None and not isinstance(mime_type, str):
            raise VisualInputError("mime_type must be a string")
        if not isinstance(role, str):
            raise VisualInputError("role must be a string")
        assets.append(
            VisualAsset(
                asset_id=asset_id,
                raster=raster,
                source_width=source_width,
                source_height=source_height,
                file_name=file_name,
                mime_type=mime_type,
                role=role,
            )
        )
    raw_ocr = payload.get("supplied_ocr", [])
    if not isinstance(raw_ocr, list):
        raise VisualInputError("supplied_ocr must be a list")
    supplied: list[SuppliedOcr] = []
    for item in raw_ocr:
        if not isinstance(item, Mapping):
            raise VisualInputError("supplied OCR block must be an object")
        text = item.get("text", "")
        asset_id = item.get("asset_id", "")
        if not isinstance(text, str) or not isinstance(asset_id, str):
            raise VisualInputError("supplied OCR text and asset_id must be strings")
        supplied.append(SuppliedOcr(asset_id=asset_id, text=text, bounds=_bounds(item.get("bounds"))))
    user_goal = payload.get("user_goal", "")
    declared_at = payload.get("declared_at", "")
    if not isinstance(user_goal, str) or not isinstance(declared_at, str):
        raise VisualInputError("user_goal and declared_at must be strings")
    return VisualInputEnvelope(
        envelope_id=envelope_id,
        assets=tuple(assets),
        mode=InputMode(mode),
        supplied_ocr=tuple(supplied),
        user_goal=user_goal,
        declared_at=declared_at,
        rejected_ownership_keys=rejected,
    )
