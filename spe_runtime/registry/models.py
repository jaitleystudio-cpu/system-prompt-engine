"""Models for Signed SPE Package Registry."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class PackageType(str, Enum):
    INSTRUCTION_PACK = "INSTRUCTION_PACK"
    ASSURANCE_PACK = "ASSURANCE_PACK"
    ORACLE_PACK = "ORACLE_PACK"
    POLICY_PACK = "POLICY_PACK"
    BENCHMARK_PACK = "BENCHMARK_PACK"


class QuarantineStatus(str, Enum):
    CLEAN = "CLEAN"
    QUARANTINED = "QUARANTINED"
    REVOKED = "REVOKED"


@dataclass
class RegistryPackage:
    namespace: str   # e.g. "@spe", "@acme"
    name: str        # e.g. "sql-safe-agent"
    version: str     # e.g. "1.0.0"
    package_type: PackageType
    digest_sha256: str
    signature_ed25519: str
    publisher_public_key: str
    license: str
    supported_models: list[str]
    test_coverage_pct: float
    known_limitations: list[str]
    published_at: str
    download_count: int = 0
    quarantine_status: QuarantineStatus = QuarantineStatus.CLEAN
    pricing_tier: str = "FREE"  # FREE, PRO, TEAM, ENTERPRISE
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def identifier(self) -> str:
        return f"{self.namespace}/{self.name}@{self.version}"
