"""K6 storage — .spe semantic artifact + lineage (G1R-8 / G1R-8R).

Canonical writers:
  build_spe_artifact  — spe_artifact_identity + direct parent lineage

Earned claim scope:
  PORTABLE_SEMANTIC_BINDING_ARTIFACT
  (ProtectedIntent/RequirementGraph embedded; snapshot/prompt/ledger DIGEST_ONLY)

Import/parse validates content-addressed integrity + digest↔payload consistency.
It does NOT grant authority, mint proof, upgrade provenance, or qualify production.
"""

from spe_runtime.storage.build import build_spe_artifact
from spe_runtime.storage.models import (
    ARTIFACT_ID_PREFIX,
    FORMAT_NAME,
    FORMAT_VERSION,
    IDENTITY_BEARING_FIELDS,
    SpeArtifact,
)
from spe_runtime.storage.serialize import dumps_spe, load_spe, loads_spe, save_spe
from spe_runtime.storage.validate import compute_artifact_id, validate_spe_artifact

__all__ = [
    "FORMAT_NAME",
    "FORMAT_VERSION",
    "ARTIFACT_ID_PREFIX",
    "IDENTITY_BEARING_FIELDS",
    "SpeArtifact",
    "build_spe_artifact",
    "compute_artifact_id",
    "validate_spe_artifact",
    "dumps_spe",
    "loads_spe",
    "save_spe",
    "load_spe",
]
