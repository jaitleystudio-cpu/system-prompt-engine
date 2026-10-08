"""Tests for Quantum Cost Supercompiler and 4 Cost Optimization Pillars."""

import pytest

from spe_runtime.cost_engine.cost_optimizer import QuantumCostOptimizer
from spe_runtime.cost_engine.deterministic_offloader import DeterministicOffloader
from spe_runtime.cost_engine.kv_aligner import PagedAttentionKVAligner
from spe_runtime.cost_engine.models import CostTier
from spe_runtime.cost_engine.speculative_cascade import EpistemicSpeculativeCascade


def test_deterministic_offloader_math_safety_and_savings():
    offloader = DeterministicOffloader()

    assert offloader.can_offload_math("45 * 12 + 100") is True
    assert offloader.can_offload_math("(500 / 25) - 3.5") is True
    assert offloader.can_offload_math("__import__('os').system('ls')") is False
    assert offloader.can_offload_math("eval('1+1')") is False

    val = offloader.evaluate_math("10 * (5 + 2)")
    assert val == 70.0

    res = offloader.execute_offload("calc_tax", "MATH", {"expression": "1000 * 0.18"})
    assert res.deterministic_success is True
    assert res.saved_tokens == 350
    assert res.saved_cost_usd > 0.0


def test_deterministic_offloader_regex_extraction():
    offloader = DeterministicOffloader()
    text = "User emails: alice@spe.ai, bob@defense.gov, charlie@corp.com"
    pattern = r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"

    assert offloader.can_offload_regex_extraction(text, pattern) is True
    matches = offloader.extract_with_regex(text, pattern)
    assert len(matches) == 3
    assert "alice@spe.ai" in matches

    res = offloader.execute_offload("extract_emails", "REGEX", {"text": text, "pattern": pattern})
    assert res.deterministic_success is True
    assert res.saved_tokens >= 200


def test_paged_attention_kv_aligner():
    aligner = PagedAttentionKVAligner(block_size=32)
    invariants = [
        "Rule B: Do not disclose confidential financial keys.",
        "Rule A: Adhere strictly to user privacy rules.",
        "Rule C: Validate output schema before sending.",
    ]
    tools = [
        {"name": "fetch_user", "parameters": {"id": "int"}},
        {"name": "auth_token", "parameters": {"jwt": "str"}},
    ]
    user_input = "Please summarize account #12345."

    layout = aligner.compile_layout(invariants, tools, user_input)

    # Prefix must be aligned to block_size (32)
    assert layout.prefix_tokens % 32 == 0
    assert layout.alignment_block_size == 32
    assert len(layout.canonical_prefix_hash) == 64
    assert "=== INVARIANT SPECIFICATION ===" in layout.canonical_prefix
    # Canonical ordering: Rule A must appear before Rule B
    pos_a = layout.canonical_prefix.find("Rule A")
    pos_b = layout.canonical_prefix.find("Rule B")
    assert pos_a < pos_b
    assert layout.dynamic_suffix == user_input


def test_speculative_cascade_success_and_deopt():
    cascade = EpistemicSpeculativeCascade()

    # Case 1: Speculation succeeds on Compact model
    spec_runner = lambda p: ("Compact output satisfies constraints", 120)
    front_runner = lambda p: ("Frontier output", 400)
    verifier = lambda o: "satisfies" in o

    res_ok = cascade.execute("task", spec_runner, front_runner, verifier)
    assert res_ok.committed_tier == CostTier.COMPACT
    assert res_ok.deoptimized is False
    assert res_ok.invariants_satisfied is True
    assert res_ok.cost_usd < 0.001

    # Case 2: Speculation fails invariant -> Deoptimizes to Frontier
    spec_bad = lambda p: ("Hallucinated bad output", 120)
    res_deopt = cascade.execute("task", spec_bad, front_runner, verifier)
    assert res_deopt.committed_tier == CostTier.FRONTIER
    assert res_deopt.deoptimized is True
    assert "deoptimized" in res_deopt.deopt_reason


def test_quantum_cost_optimizer_master_audit():
    optimizer = QuantumCostOptimizer()
    report = optimizer.run_economic_audit(
        task_count=1000,
        average_prompt_tokens=2500,
        average_completion_tokens=600,
        deterministic_task_ratio=0.35,
        speculative_success_rate=0.88,
        failure_rate=0.12,
    )

    assert report.baseline_naive_cost_usd > report.spe_optimized_cost_usd
    # Net reduction must fall between 70% and 92%
    assert 70.0 <= report.net_cost_reduction_percent <= 92.0
    assert report.kv_cache_savings_usd > 0.0
    assert report.deterministic_offload_savings_usd > 0.0
    assert report.speculative_cascade_savings_usd > 0.0
    assert report.essa_salvaged_compute_savings_usd > 0.0
    assert report.tokens_saved_total > 500_000
    assert report.projected_annual_savings_100k_tasks_usd > 500.0
