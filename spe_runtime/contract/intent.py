"""Thin re-export alias — not a second semantic owner."""

from spe_runtime.contract.protected import (
    ContractValidity,
    ProtectedIntentContract,
    confirm_requirement,
    propose_requirement,
)

__all__ = [
    "ContractValidity",
    "ProtectedIntentContract",
    "propose_requirement",
    "confirm_requirement",
]
