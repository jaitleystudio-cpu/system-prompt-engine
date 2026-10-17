"""Tests for Inference Economics Lab (Claim Correction 4.4)."""

from spe_runtime.economics_lab.lab import (
    InferenceEconomicsLab,
    compare_inference_economics,
)
from spe_runtime.economics_lab.models import InferenceStack


def test_inference_economics_measurement_and_defensible_claim():
    lab = InferenceEconomicsLab()

    # Measure unaligned baseline
    base = lab.measure_prompt_on_stack(
        stack=InferenceStack.VLLM,
        prompt_tokens=1024,
        is_aligned=False,
    )
    assert base.stack == InferenceStack.VLLM
    assert base.cache_hit_ratio == 0.0

    # Measure aligned candidate
    cand = lab.measure_prompt_on_stack(
        stack=InferenceStack.VLLM,
        prompt_tokens=1024,
        is_aligned=True,
    )
    assert cand.cache_hit_ratio > 0.9

    comp = compare_inference_economics(base, cand)
    assert comp.prefill_delta_pct < 0.0  # Prefill time reduced
    assert "Generic cross-stack savings are NOT claimed" in comp.defensible_statement
    assert "vLLM" in comp.defensible_statement
    assert comp.evidence_class == "CALIBRATED_ESTIMATE"
