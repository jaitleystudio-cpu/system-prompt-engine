"""Tests for Evidence-Preserving Compression (Claim Correction 4.5)."""

from spe_runtime.compression.models import CompressionStatus
from spe_runtime.compression.optimizer import (
    EvidencePreservingCompressionEngine,
    evaluate_compression_candidate,
)


def test_evidence_preserving_compression_flow():
    engine = EvidencePreservingCompressionEngine()

    raw_prompt = (
        "Please note that as an AI language model you are a customer support agent.\n"
        "Kindly ensure that you never leak private financial records.\n"
        "Always respond in JSON format.\n"
    )
    pruned = engine.prune_candidate(raw_prompt)
    assert "as an AI language model" not in pruned
    assert "never leak private financial records" in pruned

    # Candidate evaluation passes all gates -> PROMOTABLE
    candidate_promotable = evaluate_compression_candidate(
        original_prompt=raw_prompt,
        pruned_prompt=pruned,
        protected_intent_check_fn=lambda orig, p: "never leak" in p,
        constraint_suite_check_fn=lambda p: "JSON" in p,
        held_out_eval_fn=lambda p: True,
        adversarial_suite_fn=lambda p: True,
    )
    assert candidate_promotable.status == CompressionStatus.PROMOTABLE
    assert candidate_promotable.tokens_saved_pct > 0.0

    # Candidate evaluation with dropped non-negotiable -> REJECTED_INTENT_MUTATED
    candidate_rejected = evaluate_compression_candidate(
        original_prompt=raw_prompt,
        pruned_prompt="You are a customer support agent.",  # Dropped safety rule
        protected_intent_check_fn=lambda orig, p: "never leak" in p,
        constraint_suite_check_fn=lambda p: True,
        held_out_eval_fn=lambda p: True,
        adversarial_suite_fn=lambda p: True,
    )
    assert candidate_rejected.status == CompressionStatus.REJECTED_INTENT_MUTATED
    assert candidate_rejected.intent_preserved is False
