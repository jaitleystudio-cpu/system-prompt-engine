"""Canonical K0 provenance vocabulary — categorical source, not a score."""

from __future__ import annotations

from enum import Enum


class Provenance(str, Enum):
    """Semantic origin of a requirement / intent atom.

    Provenance is categorical. Confidence, repetition, and handoff must not
    upgrade provenance.
    """

    USER_EXPLICIT = "USER_EXPLICIT"
    USER_CONFIRMED = "USER_CONFIRMED"
    SYSTEM_REQUIRED = "SYSTEM_REQUIRED"
    INFERRED = "INFERRED"
    MODEL_PROPOSED = "MODEL_PROPOSED"
    SPE_SUGGESTED = "SPE_SUGGESTED"
    EXTERNAL_EVIDENCE = "EXTERNAL_EVIDENCE"
    UNKNOWN = "UNKNOWN"


__all__ = ["Provenance"]
