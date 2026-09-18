"""K4 Privacy Projection — sole package for privacy_projection ownership.

Contract owner: K4 (privacy projection). Read-model only.
Canonical writer: project_privacy.
"""

from spe_runtime.privacy.models import (
    PrivacyDirective,
    PrivacyProjection,
    PrivacyProjectionEntry,
)
from spe_runtime.privacy.project import project_privacy
from spe_runtime.privacy.types import PrivacyClass, ProjectionAction, ProjectionScope

__all__ = [
    "PrivacyClass",
    "ProjectionAction",
    "ProjectionScope",
    "PrivacyDirective",
    "PrivacyProjectionEntry",
    "PrivacyProjection",
    "project_privacy",
]
