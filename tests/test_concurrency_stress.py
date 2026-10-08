"""Tests for Multi-Agent Concurrent Stress Testing and Race Condition Prevention."""

import shutil
import tempfile
from pathlib import Path
import pytest

from spe_runtime.concurrency.models import StressTestConfig, StressTestReceipt
from spe_runtime.concurrency.stress_tester import ConcurrencyStressTester


def test_concurrent_stress_harness_1000_transactions():
    temp_dir = Path(tempfile.mkdtemp(prefix="spe_stress_test_"))
    try:
        config = StressTestConfig(
            concurrency_threads=16,
            total_transactions=1000,
            initial_wallet_balance_usd=500.0,
            failure_injection_rate=0.05,
            lease_expiry_rate=0.05,
        )
        tester = ConcurrencyStressTester(config=config, work_dir=temp_dir)
        receipt: StressTestReceipt = tester.run_stress_test()

        # 1. Total transactions executed
        assert receipt.total_transactions == 1000

        # 2. Concurrency throughput and duration
        assert receipt.duration_seconds > 0.0
        assert receipt.throughput_tps > 0.0

        # 3. Zero deadlocks
        assert receipt.deadlocks_detected == 0

        # 4. Successful commits occurred
        assert receipt.successful_commits > 0

        # 5. Race conditions (replays) prevented
        assert receipt.race_conditions_prevented > 0

        # 6. Unauthorized attempts rejected
        assert receipt.rejected_unauthorized > 0

        # 7. Over-budget attempts properly rejected
        assert receipt.rejected_insufficient_budget > 0

        # 8. Cryptographic and financial ledger integrity mathematically verified
        assert receipt.ledger_integrity_verified is True
        assert receipt.final_wallet_balance_usd >= 0.0
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
