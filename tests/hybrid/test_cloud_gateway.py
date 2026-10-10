"""Integration & Fault-Tolerance Tests for SPE Ω Cloud Gateway & 2PC Financial Escrow.

Verifies:
1. Multi-provider streaming adapters (Anthropic Claude 6.2, OpenAI GPT-6.1, Google Gemini 3.9 Pro).
2. Strict Two-Phase Commit (2PC) financial escrow with zero balance leakage.
3. 50-thread concurrent escrow operations without race conditions or financial drift.
4. Simulated HTTP 429 rate limit triggering automatic multi-provider failover.
5. Injected mid-stream network drop triggering PCSC minimal continuation cut (C* <= 500 tokens)
   and clean handoff to local engine without losing progress or leaking funds.
"""

from __future__ import annotations

import concurrent.futures
import threading
from typing import Iterator
import pytest

from spe_runtime.hybrid import (
    AnthropicStreamingAdapter,
    EscrowInvariantViolationError,
    GatewayExecutionResult,
    GeminiStreamingAdapter,
    LiveDropoutFailoverGateway,
    NanoUSD,
    NANOS_PER_USD,
    NetworkConnectionDroppedError,
    OpenAIStreamingAdapter,
    PlacementTarget,
    RateLimitExceededError,
    TwoPhaseCommitEscrow,
    UserLedger,
)


def test_multi_provider_streaming_adapters():
    """Validates parsing across Anthropic, OpenAI, and Gemini streaming payloads."""
    # 1. Anthropic SSE (Claude 6.2 / 6.1)
    anthropic_raw = 'data: {"type": "content_block_delta", "delta": {"text": "Hello from Claude"}}'
    assert AnthropicStreamingAdapter.parse_chunk(anthropic_raw) == "Hello from Claude"
    assert AnthropicStreamingAdapter.parse_chunk("data: [DONE]") is None

    # 2. OpenAI SSE (GPT-6.1 / o4 / o3)
    openai_raw = 'data: {"choices": [{"delta": {"content": "Hello from GPT-6.1"}}]}'
    assert OpenAIStreamingAdapter.parse_chunk(openai_raw) == "Hello from GPT-6.1"
    assert OpenAIStreamingAdapter.parse_chunk("data: [DONE]") is None

    # 3. Google Gemini (Gemini 3.9 Pro)
    gemini_raw = '{"candidates": [{"content": {"parts": [{"text": "Hello from Gemini"}]}}]}'
    assert GeminiStreamingAdapter.parse_chunk(gemini_raw) == "Hello from Gemini"


def test_two_phase_commit_escrow_conservation_of_funds():
    """
    Validates strict 2PC lifecycle and conservation of funds invariant:
    Balance_current + Spend_exact == Initial_balance ($0 balance leak).
    """
    initial_balance = 50_000_000  # $0.05 USD
    ledger = UserLedger(initial_balance_nanos=initial_balance)
    escrow = TwoPhaseCommitEscrow(ledger=ledger)

    # Phase 1: Prepare (lock $0.02 ceiling)
    ceiling_nanos = 20_000_000
    escrow_id = escrow.prepare(task_id="task_2pc_01", ceiling_nanos=ceiling_nanos)

    assert ledger.balance == 30_000_000  # 50M - 20M = 30M available

    # Phase 2 & 3: Commit (spent $0.012, unspent $0.008 refunded immediately)
    actual_spent = 12_000_000
    spent, refunded = escrow.commit(escrow_id=escrow_id, actual_consumed_nanos=actual_spent)

    assert spent == 12_000_000
    assert refunded == 8_000_000
    assert ledger.balance == 38_000_000  # 30M + 8M refund = 38M
    assert escrow.total_spent_nanos == 12_000_000

    # Invariant: 38M + 12M == 50M initial balance
    assert ledger.balance + escrow.total_spent_nanos == initial_balance


def test_two_phase_commit_escrow_abort_100_percent_refund():
    """Validates 2PC abort gives 100% refund of prepared ceiling back to user ledger."""
    initial_balance = 100_000_000
    ledger = UserLedger(initial_balance_nanos=initial_balance)
    escrow = TwoPhaseCommitEscrow(ledger=ledger)

    escrow_id = escrow.prepare(task_id="task_abort_01", ceiling_nanos=40_000_000)
    assert ledger.balance == 60_000_000

    refund = escrow.abort(escrow_id=escrow_id)
    assert refund == 40_000_000
    assert ledger.balance == initial_balance
    assert escrow.total_spent_nanos == 0


def test_concurrent_50_thread_escrow_no_race_conditions():
    """
    Simulates 50 concurrent threads executing financial escrows with commits and aborts.
    Asserts zero race conditions, zero deadlocks, and exact conservation of funds.
    """
    initial_balance = 500_000_000  # $0.50 USD
    ledger = UserLedger(initial_balance_nanos=initial_balance)
    escrow = TwoPhaseCommitEscrow(ledger=ledger)

    num_threads = 50
    reservation_each = 5_000_000   # $0.005 USD per thread (50 * 5M = 250M <= 500M)

    def worker_thread(tid: int):
        escrow_id = escrow.prepare(task_id=f"thread_task_{tid}", ceiling_nanos=reservation_each)
        if tid % 3 == 0:
            # Abort 1 in 3 threads
            escrow.abort(escrow_id=escrow_id)
        else:
            # Commit remaining threads with variable spend
            actual_spend = 2_000_000 + (tid * 50_000)  # less than 5M
            escrow.commit(escrow_id=escrow_id, actual_consumed_nanos=actual_spend)

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(worker_thread, i) for i in range(num_threads)]
        for f in concurrent.futures.as_completed(futures):
            f.result()  # Assert no unhandled exceptions or race condition crashes

    # Mathematical Invariant check across all 50 threads
    balance_final = ledger.balance
    total_spent = escrow.total_spent_nanos

    assert balance_final + total_spent == initial_balance
    assert total_spent > 0
    assert balance_final > 0


def test_live_rate_limit_http_429_automatic_failover():
    """
    Simulates Anthropic returning HTTP 429 Rate Limit.
    Gateway must intercept error, fail over to OpenAI, and complete execution without leaking funds.
    """
    initial_balance = 50_000_000
    ledger = UserLedger(initial_balance_nanos=initial_balance)
    escrow = TwoPhaseCommitEscrow(ledger=ledger)
    gateway = LiveDropoutFailoverGateway(escrow=escrow, nanos_per_token=50)

    def failing_anthropic_stream():
        # Raises HTTP 429 immediately
        raise RateLimitExceededError("HTTP 429: Too Many Requests from Anthropic API")

    def successful_openai_stream() -> Iterator[str]:
        yield "Response "
        yield "from "
        yield "OpenAI GPT-6.1."

    stream_generators = {
        "anthropic": failing_anthropic_stream,
        "openai": successful_openai_stream,
    }

    result = gateway.execute_with_resilience(
        task_id="task_failover_429",
        prompt="Analyze system logs",
        provider_chain=["anthropic", "openai"],
        stream_generators=stream_generators,
        max_budget_nanos=10_000_000,
    )

    assert result.failed_over is True
    assert "HTTP_429_RATE_LIMIT" in (result.failover_reason or "")
    assert result.provider_used == "openai"
    assert "OpenAI GPT-6.1" in result.text
    assert result.tokens_streamed > 0
    assert result.cost_nanos > 0

    # Invariant verified: balance + spend == initial
    assert ledger.balance + escrow.total_spent_nanos == initial_balance


def test_injected_mid_stream_disconnect_triggers_pcsc_local_fallback():
    """
    Simulates network drop mid-stream.
    Gateway must intercept drop, synthesize PCSC minimal continuation cut (C* <= 500 tokens),
    handoff cleanly to local engine, and commit exact consumed escrow with zero balance leak.
    """
    initial_balance = 50_000_000
    ledger = UserLedger(initial_balance_nanos=initial_balance)
    escrow = TwoPhaseCommitEscrow(ledger=ledger)
    gateway = LiveDropoutFailoverGateway(escrow=escrow, nanos_per_token=50)

    def dropping_stream() -> Iterator[str]:
        yield "Partial token analysis in progress..."
        yield " Processing block 1..."
        # Simulated socket connection reset mid-stream
        raise NetworkConnectionDroppedError("Connection reset by peer (ECONNRESET)")

    stream_generators = {
        "claude": dropping_stream,
    }

    result = gateway.execute_with_resilience(
        task_id="task_drop_pcsc",
        prompt="Synthesize AST contract specification",
        provider_chain=["claude"],
        stream_generators=stream_generators,
        max_budget_nanos=10_000_000,
    )

    # 1. Failover & Local Fallback verification
    assert result.failed_over is True
    assert "MID_STREAM_DISCONNECT" in (result.failover_reason or "")
    assert result.placement_target == PlacementTarget.LOCAL_RECOVERY
    assert "Completed locally via $0 SPE Local Engine" in result.text

    # 2. PCSC minimal continuation cut verification
    assert result.pcsc_continuation_cut is not None
    assert result.pcsc_token_count <= 500
    assert "[PCSC_CONTINUATION_CUT:" in result.pcsc_continuation_cut

    # 3. Escrow accounting integrity
    assert result.cost_nanos > 0
    assert ledger.balance + escrow.total_spent_nanos == initial_balance
