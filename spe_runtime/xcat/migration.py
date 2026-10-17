"""XCAT taxonomy migration guards.

Legacy taxonomy version "1" collision labels (Plan/Verify/Recover/Privacy/…)
must never be silently reinterpreted as DOMAIN meanings (Translate/Learn/Code/…).
"""

from __future__ import annotations

from typing import Any, Mapping

CURRENT_TAXONOMY_VERSION = "2"
LEGACY_TAXONOMY_VERSION = "1"

# Collision IDs whose v1 English names must not be treated as DOMAIN semantics.
LEGACY_COLLISION_CATEGORY_IDS: frozenset[str] = frozenset(
    {
        "CAT:C04",  # Plan → Translate / Localize / Language Transform
        "CAT:C05",  # Verify → Learn
        "CAT:C08",  # Recover → Business
        "CAT:C09",  # Privacy → Code
        "CAT:C10",  # Authority → Multimedia
        "CAT:C11",  # Provenance → Career
        "CAT:C12",  # Capability → Creative / Story / Roleplay
    }
)

LEGACY_NAMES: dict[str, str] = {
    "CAT:C04": "Plan",
    "CAT:C05": "Verify",
    "CAT:C08": "Recover",
    "CAT:C09": "Privacy",
    "CAT:C10": "Authority",
    "CAT:C11": "Provenance",
    "CAT:C12": "Capability",
}


def validate_taxonomy_version(version: object) -> dict[str, str]:
    """Return ok|error disposition for a taxonomy version string."""
    if not isinstance(version, str) or not version.strip():
        return {
            "status": "error",
            "code": "UNKNOWN_TAXONOMY_VERSION",
            "message": "taxonomy_version must be a non-empty string",
        }
    v = version.strip()
    if v == CURRENT_TAXONOMY_VERSION:
        return {"status": "ok", "code": "CURRENT", "message": "taxonomy version current"}
    if v == LEGACY_TAXONOMY_VERSION:
        return {
            "status": "ok",
            "code": "LEGACY",
            "message": "legacy taxonomy — migration required before reinterpretation",
        }
    return {
        "status": "error",
        "code": "UNKNOWN_TAXONOMY_VERSION",
        "message": f"unknown taxonomy_version: {v!r}",
    }


def reject_legacy_payload_reinterpretation(
    taxonomy_version: object,
    category_id: str,
    payload: Mapping[str, Any] | None = None,
) -> None:
    """Reject unsafe reinterpretation of legacy collision-category payloads.

    If taxonomy_version == \"1\" and category is a collision ID (C04/C05/C08–C12),
    raise LEGACY_TAXONOMY_UNMIGRATED. Never treat old Privacy as Code, etc.
    """
    _ = payload  # payload inspected by callers; law applies to version+id alone
    check = validate_taxonomy_version(taxonomy_version)
    if check["code"] == "UNKNOWN_TAXONOMY_VERSION":
        raise ValueError(f"UNKNOWN_TAXONOMY_VERSION: {taxonomy_version!r}")
    if (
        str(taxonomy_version).strip() == LEGACY_TAXONOMY_VERSION
        and category_id in LEGACY_COLLISION_CATEGORY_IDS
    ):
        legacy = LEGACY_NAMES.get(category_id, "?")
        raise ValueError(
            f"LEGACY_TAXONOMY_UNMIGRATED: category {category_id} "
            f"(legacy name {legacy!r}) cannot be reinterpreted under "
            f"taxonomy_version={LEGACY_TAXONOMY_VERSION!r}; migrate to "
            f"{CURRENT_TAXONOMY_VERSION} first"
        )
