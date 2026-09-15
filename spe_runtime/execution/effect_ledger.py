"""Effect ledger — one logical operation_id produces at most one side effect."""

from __future__ import annotations


class EffectLedger:
    """In-process duplicate-effect guard (local fixture; no network)."""

    def __init__(self) -> None:
        self._claimed: set[str] = set()

    def already_claimed(self, operation_id: str) -> bool:
        return operation_id in self._claimed

    def claim(self, operation_id: str) -> bool:
        """Claim operation_id for a side effect. False => duplicate (refuse)."""
        if not operation_id:
            return False
        if operation_id in self._claimed:
            return False
        self._claimed.add(operation_id)
        return True

    def __len__(self) -> int:
        return len(self._claimed)
