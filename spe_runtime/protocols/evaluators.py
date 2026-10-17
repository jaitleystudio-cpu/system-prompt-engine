"""Category outcome evaluators — scoped quality measurements, never authority."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

_DATA_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "protocols"
    / "evaluator_registry.json"
)

_STATUS_ALIASES: dict[Any, str] = {
    True: "PASS",
    False: "FAIL",
    "PASS": "PASS",
    "FAIL": "FAIL",
    "UNKNOWN": "UNKNOWN",
    "NOT_APPLICABLE": "NOT_APPLICABLE",
    "N/A": "NOT_APPLICABLE",
    "NA": "NOT_APPLICABLE",
}

_FORBIDDEN_EVIDENCE_KEYS = frozenset(
    {
        "permit",
        "permits",
        "verified_outcome",
        "verified_success",
        "VERIFIED_SUCCESS",
        "execution_grant",
        "authority",
        "receipt",
        "receipts",
    }
)


class EvaluatorStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    UNKNOWN = "UNKNOWN"
    NOT_APPLICABLE = "NOT_APPLICABLE"

    def to_dict(self) -> str:
        return self.value


@dataclass(frozen=True)
class EvaluatorResult:
    """One criterion outcome. Cannot mint XCAT authority or VERIFIED_SUCCESS."""

    criterion_id: str
    status: EvaluatorStatus
    evidence_ref: str | None = None
    measurement: Any = None
    message: str = ""

    def __post_init__(self) -> None:
        if not self.criterion_id:
            raise ValueError("criterion_id must be non-empty")
        if isinstance(self.status, str):
            object.__setattr__(self, "status", EvaluatorStatus(self.status))
        elif not isinstance(self.status, EvaluatorStatus):
            raise TypeError("status must be EvaluatorStatus or str")

    def to_dict(self) -> dict[str, Any]:
        return {
            "criterion_id": self.criterion_id,
            "status": self.status.to_dict(),
            "evidence_ref": self.evidence_ref,
            "measurement": self.measurement,
            "message": self.message,
        }

    @classmethod
    def from_dict(cls, raw: Mapping[str, Any]) -> EvaluatorResult:
        return cls(
            criterion_id=str(raw["criterion_id"]),
            status=EvaluatorStatus(str(raw["status"])),
            evidence_ref=(
                None if raw.get("evidence_ref") is None else str(raw["evidence_ref"])
            ),
            measurement=raw.get("measurement"),
            message=str(raw.get("message", "")),
        )


@lru_cache(maxsize=1)
def _load_indexes() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    with _DATA_PATH.open(encoding="utf-8") as fh:
        payload = json.load(fh)
    evaluators = payload.get("evaluators")
    if not isinstance(evaluators, list):
        raise ValueError("evaluator_registry.json must contain an evaluators list")
    by_protocol: dict[str, dict[str, Any]] = {}
    by_domain: dict[str, dict[str, Any]] = {}
    for item in evaluators:
        protocol_id = str(item["protocol_id"])
        domain_id = str(item["domain_id"])
        if protocol_id in by_protocol:
            raise ValueError(f"duplicate protocol_id: {protocol_id}")
        if domain_id in by_domain:
            raise ValueError(f"duplicate domain_id: {domain_id}")
        by_protocol[protocol_id] = item
        by_domain[domain_id] = item
    return by_protocol, by_domain


def list_evaluator_domains() -> tuple[str, ...]:
    _, by_domain = _load_indexes()
    return tuple(sorted(by_domain.keys()))


def _resolve_evaluator(protocol_id: str) -> dict[str, Any]:
    by_protocol, by_domain = _load_indexes()
    if protocol_id in by_protocol:
        return by_protocol[protocol_id]
    for suffix in (".quick", ".standard", ".deep", ".critical"):
        if protocol_id.endswith(suffix):
            base = protocol_id[: -len(suffix)]
            if base in by_protocol:
                return by_protocol[base]
    if protocol_id in by_domain:
        return by_domain[protocol_id]
    raise KeyError(f"unknown evaluator protocol_id: {protocol_id}")


def _coerce_status(raw: object) -> EvaluatorStatus:
    if isinstance(raw, EvaluatorStatus):
        return raw
    if isinstance(raw, Mapping):
        if "status" in raw:
            return _coerce_status(raw["status"])
        return EvaluatorStatus.UNKNOWN
    key: Any = raw
    if isinstance(raw, str):
        key = raw.strip().upper()
    aliased = _STATUS_ALIASES.get(key)
    if aliased is None:
        return EvaluatorStatus.UNKNOWN
    return EvaluatorStatus(aliased)


def _result_from_evidence(
    criterion_id: str,
    evidence: Mapping[str, object],
) -> EvaluatorResult:
    if criterion_id not in evidence:
        return EvaluatorResult(
            criterion_id=criterion_id,
            status=EvaluatorStatus.UNKNOWN,
            message="no evidence provided",
        )
    raw = evidence[criterion_id]
    evidence_ref: str | None = None
    measurement: Any = None
    message = ""
    if isinstance(raw, Mapping):
        status = _coerce_status(raw.get("status", raw))
        evidence_ref = (
            None if raw.get("evidence_ref") is None else str(raw.get("evidence_ref"))
        )
        measurement = raw.get("measurement")
        message = str(raw.get("message", ""))
    else:
        status = _coerce_status(raw)
        if not isinstance(raw, (bool, str)):
            measurement = raw
    return EvaluatorResult(
        criterion_id=criterion_id,
        status=status,
        evidence_ref=evidence_ref,
        measurement=measurement,
        message=message,
    )


def evaluate_result(
    protocol_id: str,
    evidence: Mapping[str, object],
) -> tuple[EvaluatorResult, ...]:
    """Evaluate evidence against the paired protocol evaluator criteria.

    Results are scoped quality measurements only. They never mint XCAT
    authority, permits, or ``VERIFIED_SUCCESS``.
    """
    if not isinstance(evidence, Mapping):
        raise TypeError("evidence must be a mapping")
    bad = _FORBIDDEN_EVIDENCE_KEYS & set(evidence.keys())
    if bad:
        raise ValueError(
            f"evaluator evidence must not mint authority; forbidden keys: {sorted(bad)}"
        )

    family = _resolve_evaluator(protocol_id)
    criteria = family.get("criteria") or []
    results: list[EvaluatorResult] = []
    for item in criteria:
        criterion_id = str(item["criterion_id"])
        results.append(_result_from_evidence(criterion_id, evidence))
    return tuple(results)
