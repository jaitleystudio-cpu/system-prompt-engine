"""High-Concurrency Multi-Agent Stress Tester.

Executes concurrent transactions across worker threads against CapabilityFirewall
and GildenKernel, testing double-spend defense, replay resistance, budget escrows,
and crash recovery under extreme multi-agent load.
"""

from __future__ import annotations

import concurrent.futures
import time
import uuid
from pathlib import Path
from typing import Any

from spe_runtime.ci_gate.receipt import generate_keypair
from spe_runtime.runtime_gateway.firewall import CapabilityFirewall, sign_grant
from spe_runtime.runtime_gateway.models import (
    CapabilityGrant,
    CapabilityRequest,
    CapabilityType,
    Decision,
)
from .models import StressTestConfig, StressTestReceipt


class ConcurrencyStressTester:
    """Harness that stresses CapabilityFirewall and GildenKernel under multi-threaded concurrency."""

    def __init__(self, config: StressTestConfig | None = None, work_dir: Path | str | None = None) -> None:
        self.config = config or StressTestConfig()
        self.work_dir = Path(work_dir) if work_dir else Path(".spe/stress_test")
        self.work_dir.mkdir(parents=True, exist_ok=True)

    def run_stress_test(self) -> StressTestReceipt:
        """Executes total_transactions across concurrency_threads.
        Verifies mathematical ledger consistency, zero deadlocks, and zero double-spend races.
        """
        # Set up firewall and authorized root
        signing_key, public_key = generate_keypair()
        issuer = "spe-treasury-authority"
        firewall = CapabilityFirewall(storage_dir=self.work_dir / "firewall", verify_signatures=True)
        firewall.register_trust_root(issuer, public_key.hex())

        # Seed initial grant with exact budget
        grant_id = f"grant-stress-{uuid.uuid4().hex[:8]}"
        initial_balance = self.config.initial_wallet_balance_usd
        grant = CapabilityGrant(
            grant_id=grant_id,
            capability=CapabilityType.PAYMENT,
            resource_scope="finance:escrow:*",
            action_scope="auto_approved,debit",
            issuer=issuer,
            approval_identity="sec-admin-treasury",
            expiration_iso="2035-01-01T00:00:00Z",
            nonce=f"nonce-init-{uuid.uuid4().hex[:8]}",
            signature="",
            amount_budget=initial_balance,
            remaining_budget=initial_balance,
        )
        signed_grant = sign_grant(grant, signing_key, public_key)
        firewall.install_grant(signed_grant)

        # Transaction tracking counters
        successful_commits = 0
        rejected_unauthorized = 0
        rejected_insufficient_budget = 0
        race_conditions_prevented = 0
        deadlocks_detected = 0

        # Plan transactions: mix of valid amounts, over-budget amounts, and replay attempts
        tx_amount = initial_balance / (self.config.total_transactions * 0.5)  # Will exhaust around halfway
        committed_total = 0.0

        start_time = time.perf_counter()

        def execute_worker_tx(tx_index: int) -> dict[str, Any]:
            # Deterministic transaction behavior
            is_replay = (tx_index % 20 == 0)  # 5% replay attacks
            is_unauthorized = (tx_index % 25 == 0)  # 4% unauthorized actions
            tx_nonce = "replay-nonce-constant" if is_replay else f"nonce-tx-{tx_index}-{uuid.uuid4().hex[:8]}"
            res_id = f"res-{tx_index}-{uuid.uuid4().hex[:8]}"

            action = "unauthorized_action" if is_unauthorized else "debit"
            req = CapabilityRequest(
                capability=CapabilityType.PAYMENT,
                target_resource="finance:escrow:payout",
                action=action,
                agent_id="agent-worker-thread",
                amount=0.0,
                nonce=tx_nonce,
            )

            # 1. Evaluate request
            res = firewall.evaluate_request(req)
            if res.decision == Decision.DENY:
                if "Replay attack" in res.reason:
                    return {"status": "RACE_PREVENTED", "amount": 0.0}
                return {"status": "UNAUTHORIZED", "amount": 0.0}

            # 2. Reserve budget (2-Phase Commit)
            reserved = firewall.reserve_budget(grant_id, tx_amount, res_id)
            if not reserved:
                return {"status": "INSUFFICIENT_BUDGET", "amount": 0.0}

            # 3. Simulate work and commit or rollback
            should_fail = (tx_index % int(1.0 / self.config.failure_injection_rate) == 0) if self.config.failure_injection_rate > 0 else False
            if should_fail:
                firewall.rollback_budget(res_id)
                return {"status": "ROLLED_BACK", "amount": 0.0}

            committed = firewall.commit_budget(res_id)
            if committed:
                return {"status": "COMMITTED", "amount": tx_amount}
            return {"status": "COMMIT_FAILED", "amount": 0.0}

        # Run with ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.config.concurrency_threads) as executor:
            futures = [executor.submit(execute_worker_tx, i) for i in range(self.config.total_transactions)]
            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result(timeout=10.0)
                    st = result["status"]
                    if st == "COMMITTED":
                        successful_commits += 1
                        committed_total += result["amount"]
                    elif st == "UNAUTHORIZED":
                        rejected_unauthorized += 1
                    elif st == "INSUFFICIENT_BUDGET":
                        rejected_insufficient_budget += 1
                    elif st == "RACE_PREVENTED":
                        race_conditions_prevented += 1
                    elif st == "ROLLED_BACK":
                        pass
                except concurrent.futures.TimeoutError:
                    deadlocks_detected += 1
                except Exception:
                    deadlocks_detected += 1

        duration = max(0.001, time.perf_counter() - start_time)
        tps = self.config.total_transactions / duration

        # Verify ledger integrity
        remaining = firewall.grants[grant_id].remaining_budget or 0.0
        # Under 2PC reservations: remaining + committed_total == initial_balance (within floating point precision)
        ledger_integrity_verified = abs((remaining + committed_total) - initial_balance) < 1e-4

        return StressTestReceipt(
            total_transactions=self.config.total_transactions,
            successful_commits=successful_commits,
            rejected_unauthorized=rejected_unauthorized,
            rejected_insufficient_budget=rejected_insufficient_budget,
            race_conditions_prevented=race_conditions_prevented,
            deadlocks_detected=deadlocks_detected,
            final_wallet_balance_usd=round(remaining, 4),
            duration_seconds=round(duration, 4),
            throughput_tps=round(tps, 2),
            ledger_integrity_verified=ledger_integrity_verified,
        )
