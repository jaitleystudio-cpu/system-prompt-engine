"""SPE Ω — Failure Genome Ω (M8)."""

from .evidence_generator import (
    BenchmarkShowdown,
    EvidenceGenerator,
    FailureGenomeReport,
    ModelPassport,
)
from .models import FailureClass, FailureGenomeEntry, Severity
from .store import FailureGenomeStore, PoisoningDetectionError

__all__ = [
    "FailureGenomeEntry",
    "FailureClass",
    "Severity",
    "FailureGenomeStore",
    "PoisoningDetectionError",
    "EvidenceGenerator",
    "FailureGenomeReport",
    "ModelPassport",
    "BenchmarkShowdown",
]

