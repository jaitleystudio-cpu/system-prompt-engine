"""SPE Universal Portability + Conformance (Sprint 4).

Contract-only: no platform clients, no network providers.
"""

from __future__ import annotations

from spe_runtime.portability.abi import (
    ABI_ID,
    ABI_MAJOR,
    ABI_MINOR,
    ABI_PATCH,
    AbiVersion,
    ImplementationDeclaration,
    declare_reference_implementation,
)
from spe_runtime.portability.capability import (
    CAPABILITY_IDS,
    CapabilityId,
    CapabilityStatus,
    evaluate_capability,
)
from spe_runtime.portability.canonical import (
    canonicalize,
    canonical_dumps,
    canonical_loads,
)
from spe_runtime.portability.conformance import (
    PLATFORM_REGISTRY,
    ReferenceRuntime,
    run_conformance_suite,
    semantic_equivalent,
    validate_round_trip,
)
from spe_runtime.portability.reasons import PortabilityReason

__all__ = [
    "ABI_ID",
    "ABI_MAJOR",
    "ABI_MINOR",
    "ABI_PATCH",
    "AbiVersion",
    "ImplementationDeclaration",
    "declare_reference_implementation",
    "CAPABILITY_IDS",
    "CapabilityId",
    "CapabilityStatus",
    "evaluate_capability",
    "canonicalize",
    "canonical_dumps",
    "canonical_loads",
    "PLATFORM_REGISTRY",
    "ReferenceRuntime",
    "run_conformance_suite",
    "semantic_equivalent",
    "validate_round_trip",
    "PortabilityReason",
]
