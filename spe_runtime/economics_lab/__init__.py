"""SPE Ω — Inference Economics Lab (Claim Correction 4.4)."""

from .lab import InferenceEconomicsLab, compare_inference_economics
from .models import (
    EconomicsComparison,
    InferenceStack,
    StackMeasurement,
)

__all__ = [
    "InferenceStack",
    "StackMeasurement",
    "EconomicsComparison",
    "InferenceEconomicsLab",
    "compare_inference_economics",
]
