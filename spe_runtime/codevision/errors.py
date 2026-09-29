"""Contract failures for the CODEVISION structure foundation."""

from __future__ import annotations


class CodevisionContractError(ValueError):
    """A closed-contract refusal. `reason` is the stable code."""

    def __init__(self, reason: str, detail: str = "") -> None:
        self.reason = reason
        self.detail = detail
        message = reason if detail == "" else f"{reason}: {detail}"
        super().__init__(message)
