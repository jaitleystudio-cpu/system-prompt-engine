"""Gilden Policy Kernel, Store, BudgetGuard, and EffectObserver.

Enforces:
1. Append-only operational log (GildenStore) with crash-restart recovery.
2. Duplicate job idempotency.
3. Budget exhaustion stops.
4. Effect verification and EFFECT_RECEIPT generation.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class BudgetExhaustionError(Exception):
    """Raised when an operation attempts to exceed the granted budget."""


class UnauthorizedActionError(Exception):
    """Raised when an action is executed without external authority."""


@dataclass
class EffectReceipt:
    receipt_id: str
    job_id: str
    action: str
    expected_effect: dict[str, Any]
    observed_effect: dict[str, Any]
    verification_status: str  # VERIFIED, FAILED, UNKNOWN
    cost_usd: float
    timestamp: str
    payload_digest: str


@dataclass
class GildenJob:
    job_id: str
    idempotency_key: str
    action: str
    authority_grant_id: str
    budget_allocated: float
    budget_consumed: float
    expected_effect: dict[str, Any]
    observed_effect: dict[str, Any]
    status: str  # CLAIMED, OBSERVED, VERIFIED, UNKNOWN, FAILED
    created_at: str
    completed_at: str | None = None
    effect_receipt: EffectReceipt | None = None


class GildenStore:
    """Crash-safe append-only ledger for Gilden operations."""

    def __init__(self, storage_dir: Path | str = ".spe/gilden") -> None:
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.ledger_file = self.storage_dir / "gilden_ledger.jsonl"
        self._jobs: dict[str, GildenJob] = {}
        self._idempotency_map: dict[str, str] = {}
        self._load()

    def record_job(self, job: GildenJob) -> None:
        self._jobs[job.job_id] = job
        self._idempotency_map[job.idempotency_key] = job.job_id
        self._append(job)

    def get_job(self, job_id: str) -> GildenJob | None:
        return self._jobs.get(job_id)

    def find_by_idempotency_key(self, idempotency_key: str) -> GildenJob | None:
        job_id = self._idempotency_map.get(idempotency_key)
        return self._jobs.get(job_id) if job_id else None

    def _append(self, job: GildenJob) -> None:
        row = asdict(job)
        with self.ledger_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")

    def _load(self) -> None:
        if not self.ledger_file.exists():
            return
        with self.ledger_file.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                d = json.loads(line)
                receipt_d = d.pop("effect_receipt", None)
                receipt = EffectReceipt(**receipt_d) if receipt_d else None
                job = GildenJob(**d, effect_receipt=receipt)
                self._jobs[job.job_id] = job
                self._idempotency_map[job.idempotency_key] = job.job_id


class BudgetGuard:
    """Guards against budget exhaustion."""

    def __init__(self, max_budget_usd: float) -> None:
        self.max_budget_usd = max_budget_usd
        self.consumed_budget_usd: float = 0.0

    @property
    def remaining_budget_usd(self) -> float:
        return max(0.0, self.max_budget_usd - self.consumed_budget_usd)

    def allocate(self, amount: float) -> None:
        if self.consumed_budget_usd + amount > self.max_budget_usd:
            raise BudgetExhaustionError(
                f"Requested allocation ${amount:.2f} exceeds remaining budget ${self.remaining_budget_usd:.2f} "
                f"(max: ${self.max_budget_usd:.2f}, consumed: ${self.consumed_budget_usd:.2f})."
            )
        self.consumed_budget_usd += amount


class GildenKernel:
    """Core operating kernel managing job lifecycle, recovery, and external effect proof."""

    def __init__(
        self,
        storage_dir: Path | str = ".spe/gilden",
        max_budget_usd: float = 100.0,
        authority_grant_id: str | None = None,
    ) -> None:
        self.store = GildenStore(storage_dir)
        self.budget_guard = BudgetGuard(max_budget_usd)
        self.authority_grant_id = authority_grant_id

    def execute_job(
        self,
        job_id: str,
        idempotency_key: str,
        action: str,
        cost_usd: float,
        expected_effect: dict[str, Any],
        actor_fn: Any,
    ) -> GildenJob:
        # 1. Authority validation
        if not self.authority_grant_id or "self" in self.authority_grant_id.lower():
            raise UnauthorizedActionError("Gilden cannot execute actions without external authority grant.")

        # 2. Duplicate job idempotency check
        existing = self.store.find_by_idempotency_key(idempotency_key)
        if existing:
            return existing

        # 3. Budget guard check
        self.budget_guard.allocate(cost_usd)

        now = datetime.now(timezone.utc).isoformat()
        job = GildenJob(
            job_id=job_id,
            idempotency_key=idempotency_key,
            action=action,
            authority_grant_id=self.authority_grant_id,
            budget_allocated=cost_usd,
            budget_consumed=cost_usd,
            expected_effect=expected_effect,
            observed_effect={},
            status="CLAIMED",
            created_at=now,
        )

        # 4. Act
        try:
            observed = actor_fn()
            job.observed_effect = observed
            job.status = "OBSERVED"
        except Exception as e:
            job.status = "FAILED"
            job.observed_effect = {"error": str(e)}
            self.store.record_job(job)
            raise

        # 5. Verify effect
        is_verified = all(
            job.observed_effect.get(k) == v
            for k, v in expected_effect.items()
        )
        job.status = "VERIFIED" if is_verified else "FAILED"
        job.completed_at = datetime.now(timezone.utc).isoformat()

        # 6. Generate cryptographic effect receipt
        payload_bytes = json.dumps({
            "job_id": job.job_id,
            "action": job.action,
            "expected": expected_effect,
            "observed": job.observed_effect,
            "status": job.status,
            "cost": cost_usd,
        }, sort_keys=True).encode("utf-8")
        digest = hashlib.sha256(payload_bytes).hexdigest()

        receipt = EffectReceipt(
            receipt_id=f"RECEIPT-{hashlib.sha256(job_id.encode()).hexdigest()[:12]}",
            job_id=job.job_id,
            action=job.action,
            expected_effect=expected_effect,
            observed_effect=job.observed_effect,
            verification_status=job.status,
            cost_usd=cost_usd,
            timestamp=job.completed_at,
            payload_digest=digest,
        )
        job.effect_receipt = receipt

        # 7. Persist to append-only store
        self.store.record_job(job)
        return job
