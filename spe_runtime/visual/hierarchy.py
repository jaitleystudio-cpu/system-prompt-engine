"""Geometric reading order and area rank. Semantic roles stay UNKNOWN."""

from __future__ import annotations

from spe_runtime.visual.models import ClaimVerdict, HierarchyItem, VisualObject


def read_hierarchy(objects: tuple[VisualObject, ...], asset_id: str) -> tuple[HierarchyItem, ...]:
    if not objects:
        return ()
    by_area = sorted(objects, key=lambda item: item.area_share, reverse=True)
    rank_of = {item.object_id: index + 1 for index, item in enumerate(by_area)}
    reading = sorted(objects, key=lambda item: (item.bounds.y, item.bounds.x, item.object_id))
    items: list[HierarchyItem] = []
    for index, region in enumerate(reading):
        items.append(
            HierarchyItem(
                item_id=f"{asset_id}:hier:{index}",
                region_id=region.object_id,
                rank=rank_of[region.object_id],
                reading_order=index + 1,
                order_verdict=ClaimVerdict.PASS,
                role_label="UNKNOWN",
                role_verdict=ClaimVerdict.UNKNOWN,
                method="geometric-order",
            )
        )
    return tuple(items)
