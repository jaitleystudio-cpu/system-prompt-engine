"""SPE Ω — Evidence-Preserving Compression (Claim Correction 4.5)."""

from .models import (
    CompressionCandidate,
    CompressionStatus,
)
from .optimizer import (
    EvidencePreservingCompressionEngine,
    evaluate_compression_candidate,
)

__all__ = [
    "CompressionStatus",
    "CompressionCandidate",
    "EvidencePreservingCompressionEngine",
    "evaluate_compression_candidate",
]
