"""Universal SPE ABI version + implementation declaration."""

from __future__ import annotations

from dataclasses import dataclass


ABI_ID = "spe.universal-abi.v1"
ABI_MAJOR = 1
ABI_MINOR = 0
ABI_PATCH = 0


@dataclass(frozen=True)
class AbiVersion:
    abi_id: str
    major: int
    minor: int
    patch: int

    def as_tuple(self) -> tuple[int, int, int]:
        return (self.major, self.minor, self.patch)

    def to_dict(self) -> dict[str, object]:
        return {
            "abi_id": self.abi_id,
            "major": self.major,
            "minor": self.minor,
            "patch": self.patch,
        }


@dataclass(frozen=True)
class ImplementationDeclaration:
    implementation_id: str
    platform_id: str
    abi_version: AbiVersion
    capabilities: frozenset[str]
    network_mode: str
    status: str

    def to_dict(self) -> dict[str, object]:
        return {
            "implementation_id": self.implementation_id,
            "platform_id": self.platform_id,
            "abi_version": self.abi_version.to_dict(),
            "capabilities": sorted(self.capabilities),
            "network_mode": self.network_mode,
            "status": self.status,
        }


def declare_reference_implementation(
    capabilities: frozenset[str] | set[str] | None = None,
) -> ImplementationDeclaration:
    """Honest Python reference declaration — never fake RELEASED/PASS."""
    caps = frozenset(capabilities or [])
    return ImplementationDeclaration(
        implementation_id="spe-python-reference",
        platform_id="PLATFORM:PYTHON_REFERENCE",
        abi_version=AbiVersion(ABI_ID, ABI_MAJOR, ABI_MINOR, ABI_PATCH),
        capabilities=caps,
        network_mode="NONE",
        status="CONFORMANCE_PARTIAL",
    )
