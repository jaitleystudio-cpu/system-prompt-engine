"""Closed names for the CODEVISION v1 structure contract.

The six targets are the only outputs of the structure compiler. They are
structural censuses of a supplied screenshot observation. None of them is a
visual-fidelity measurement.
"""

from __future__ import annotations

OBSERVATION_SCHEMA_VERSION = "spe.codevision.observation.v1"
STRUCTURE_SCHEMA_VERSION = "spe.codevision.structure.v1"
PROOF_SCHEMA_VERSION = "spe.codevision.visual-fidelity-proof.v1"

SOURCE_KIND = "screenshot_observation"

# Screenshot observation in. These six structure targets out. Order is part
# of the contract.
SIX_TARGETS: tuple[str, ...] = (
    "region_tree",
    "element_inventory",
    "text_runs",
    "style_observations",
    "spatial_relations",
    "repeat_groups",
)

NODE_KINDS: tuple[str, ...] = (
    "frame",
    "region",
    "text",
    "image",
    "control",
    "icon",
    "unknown",
)

RELATION_KINDS: tuple[str, ...] = (
    "contains",
    "stacked_above",
    "beside",
    "aligned_x_start",
    "aligned_x_center",
    "aligned_y_start",
    "aligned_y_center",
)

ALIGNMENT_TOLERANCE_PX = 2
# Center compare uses integer half-pixel units: abs((2x+extent) difference).
# 2px of tolerance is 4 half-pixels. This is a rule input, not a score.
ALIGNMENT_TOLERANCE_HALF_PX = ALIGNMENT_TOLERANCE_PX * 2

REPEAT_MATCH = "exact_box_and_kind"
REPEAT_NOTE = (
    "Exact width, height, and kind among direct siblings. "
    "A one-pixel difference does not match. This is not a similarity score."
)

MAX_NODES = 500
MAX_DEPTH = 32
MAX_TEXT_LENGTH = 2000
CANVAS_MAX_PX = 16384
Z_INDEX_MAX = 10000

VISUAL_FIDELITY_STATUS = "UNPROVEN"
COUNTS_ARE = "structure_emission_census"
STRUCTURE_CONTRACT_STATUS = "CHECKED"
CLAIM_BOUNDARY = (
    "This proof records that a structure document was emitted and schema-checked. "
    "It does not measure or prove visual fidelity."
)
UNMEASURED_CLAIMS: tuple[str, ...] = (
    "pixel_perfect",
    "perceptual_match",
    "rendered_rescreenshot_match",
    "human_visual_rating",
    "numeric_fidelity_score",
)
