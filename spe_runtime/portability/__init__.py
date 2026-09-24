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
    abi_compatible,
    declare_reference_implementation,
)
from spe_runtime.portability.capability import (
    CAPABILITY_IDS,
    CapabilityId,
    CapabilityStatus,
    detect_capability_escalation,
    evaluate_capability,
)
from spe_runtime.portability.canonical import (
    canonicalize,
    canonical_dumps,
    canonical_loads,
    strict_equal,
)
from spe_runtime.portability.conformance import (
    PLATFORM_REGISTRY,
    ReferenceRuntime,
    detect_attack,
    detect_fake_platform_status,
    run_conformance_suite,
    semantic_equivalent,
    validate_round_trip,
)
from spe_runtime.portability.oracle import oracle_detect
from spe_runtime.portability.reasons import PortabilityReason
from spe_runtime.portability.spe_artifact import (
    CONTEXT_PROTOCOL_LINEAGE_KEY,
    SPE_FORMAT_V1,
    SPE_FORMAT_V2,
    build_context_protocol_lineage,
    build_spe_artifact,
    dumps_spe_artifact,
    loads_spe_artifact,
    protected_intent_of,
    refresh_stale_context,
    roundtrip_spe_artifact,
    verify_integrity,
)

__all__ = [
    "ABI_ID",
    "ABI_MAJOR",
    "ABI_MINOR",
    "ABI_PATCH",
    "AbiVersion",
    "ImplementationDeclaration",
    "abi_compatible",
    "declare_reference_implementation",
    "CAPABILITY_IDS",
    "CapabilityId",
    "CapabilityStatus",
    "detect_capability_escalation",
    "evaluate_capability",
    "canonicalize",
    "canonical_dumps",
    "canonical_loads",
    "strict_equal",
    "PLATFORM_REGISTRY",
    "ReferenceRuntime",
    "detect_attack",
    "detect_fake_platform_status",
    "run_conformance_suite",
    "semantic_equivalent",
    "validate_round_trip",
    "oracle_detect",
    "PortabilityReason",
    "CONTEXT_PROTOCOL_LINEAGE_KEY",
    "SPE_FORMAT_V1",
    "SPE_FORMAT_V2",
    "build_context_protocol_lineage",
    "build_spe_artifact",
    "dumps_spe_artifact",
    "loads_spe_artifact",
    "protected_intent_of",
    "refresh_stale_context",
    "roundtrip_spe_artifact",
    "verify_integrity",
]
