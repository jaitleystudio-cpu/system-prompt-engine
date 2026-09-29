"""Gilden SPE operations foundation.

Local contract and runner boundary. Not a live agency.
"""

from spe_runtime.gilden.contract import (
    CONTRACT_ID,
    EXTERNAL_ACTIONS,
    KINDS,
    NOT_AUTHORIZED,
    ReasonCode,
    closed_effect_flags,
    controls_register,
    evidence_digest,
    external_disposition,
)
from spe_runtime.gilden.runner import evaluate, judge_evidence, run_text

__all__ = [
    "CONTRACT_ID",
    "EXTERNAL_ACTIONS",
    "KINDS",
    "NOT_AUTHORIZED",
    "ReasonCode",
    "closed_effect_flags",
    "controls_register",
    "evaluate",
    "evidence_digest",
    "external_disposition",
    "judge_evidence",
    "run_text",
]
