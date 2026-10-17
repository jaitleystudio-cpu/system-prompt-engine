"""Models for Evidence-Preserving Compression."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class CompressionStatus(str, Enum):
    CANDIDATE_ONLY = "CANDIDATE_ONLY"
    PROMOTABLE = "PROMOTABLE"
    REJECTED_INTENT_MUTATED = "REJECTED_INTENT_MUTATED"
    REJECTED_CONSTRAINT_FAILED = "REJECTED_CONSTRAINT_FAILED"
    REJECTED_TASK_INFERIOR = "REJECTED_TASK_INFERIOR"
    REJECTED_ADVERSARIAL_FAILED = "REJECTED_ADVERSARIAL_FAILED"


@dataclass
class CompressionCandidate:
    original_prompt: str
    pruned_prompt: str
    original_tokens: int
    pruned_tokens: int
    tokens_saved_pct: float
    intent_preserved: bool
    constraints_pass: bool
    held_out_noninferior: bool
    adversarial_pass: bool
    status: CompressionStatus
    evidence_trail: list[str]
