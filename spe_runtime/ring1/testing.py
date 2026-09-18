"""Test-only deterministic effect destination (not a live provider)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class FakeDestination:
    """Idempotent local destination for G3 reconciliation proofs."""

    applied: dict[str, dict[str, Any]] = field(default_factory=dict)
    apply_count: dict[str, int] = field(default_factory=dict)
    force_fail_keys: set[str] = field(default_factory=set)
    force_timeout_keys: set[str] = field(default_factory=set)
    force_reset_keys: set[str] = field(default_factory=set)
    lookup_enabled: bool = True

    def lookup(self, idempotency_key: str) -> dict[str, Any] | None:
        if not self.lookup_enabled:
            return None
        return self.applied.get(idempotency_key)

    def apply(self, idempotency_key: str, request_digest: str) -> dict[str, Any]:
        if idempotency_key in self.force_timeout_keys:
            raise TimeoutError("simulated destination timeout")
        if idempotency_key in self.force_reset_keys:
            raise ConnectionResetError("simulated connection reset after send")
        if idempotency_key in self.force_fail_keys:
            result = {
                "status": "FAILURE",
                "operation_id": f"op-fail-{idempotency_key}",
                "response_digest": f"fail:{request_digest}",
            }
            # definitive failure before apply — not counted as applied
            return result
        if idempotency_key in self.applied:
            # idempotent: do not double-apply side effect
            return self.applied[idempotency_key]
        self.apply_count[idempotency_key] = self.apply_count.get(idempotency_key, 0) + 1
        result = {
            "status": "SUCCESS",
            "operation_id": f"op-{idempotency_key}",
            "response_digest": f"ok:{request_digest}",
        }
        self.applied[idempotency_key] = result
        return result

    def application_count(self, idempotency_key: str) -> int:
        # Count unique successful applications (idempotent destination: max 1 stored)
        if idempotency_key not in self.applied:
            return 0
        # For mutation tests that break idempotency, apply_count may exceed 1
        return self.apply_count.get(idempotency_key, 0)


__all__ = ["FakeDestination"]
