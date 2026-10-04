"""Context grounding contracts — immutable need/capsule models + compilers."""

from spe_runtime.grounding.compiler import (
    GroundingBundle,
    compile_context,
    research_capsules_to_c02_inputs,
)
from spe_runtime.grounding.firewall import sanitize_external_payload
from spe_runtime.grounding.freshness import (
    FreshnessState,
    RefreshPlan,
    freshness_state,
    plan_refresh,
)
from spe_runtime.grounding.models import (
    ContextCapsule,
    ContextNeed,
    ContextType,
    PrivacyClass,
    RetractionCheckStatus,
    SupportStatus,
)
from spe_runtime.grounding.need import compile_context_need
from spe_runtime.grounding.policies import SourcePolicy, get_source_policy
from spe_runtime.grounding.privacy import MinimizedQuery, minimize_public_query
from spe_runtime.grounding.profiles import DomainProfile, get_domain_profile
from spe_runtime.grounding.recipes import ContextRecipe, get_context_recipe
from spe_runtime.grounding.retraction import (
    RetractionCheckResult,
    classify_peer_review,
    classify_verification_mode,
    merge_retraction_checks,
)
from spe_runtime.grounding.live_fabric import (
    ADAPTERS_IMPLEMENTED,
    LIVE_INDEX,
    LIVE_RETRACTION,
    LivePromotionGateEvidence,
    count_identity_provider_agreement,
    evaluate_live_promotion_gate,
    may_promote_live_index,
    may_promote_live_retraction,
)
from spe_runtime.grounding.live_adapters import (
    acquire_scholarly_hits,
    hits_to_capsules,
)
from spe_runtime.grounding.research_journey import run_research_journey

__all__ = [
    "ContextCapsule",
    "ContextNeed",
    "ContextRecipe",
    "ContextType",
    "DomainProfile",
    "FreshnessState",
    "GroundingBundle",
    "MinimizedQuery",
    "PrivacyClass",
    "RefreshPlan",
    "SourcePolicy",
    "SupportStatus",
    "RetractionCheckStatus",
    "RetractionCheckResult",
    "merge_retraction_checks",
    "classify_peer_review",
    "classify_verification_mode",
    "LIVE_INDEX",
    "LIVE_RETRACTION",
    "ADAPTERS_IMPLEMENTED",
    "LivePromotionGateEvidence",
    "count_identity_provider_agreement",
    "evaluate_live_promotion_gate",
    "may_promote_live_index",
    "may_promote_live_retraction",
    "acquire_scholarly_hits",
    "hits_to_capsules",
    "run_research_journey",
    "compile_context",
    "compile_context_need",
    "freshness_state",
    "get_context_recipe",
    "get_domain_profile",
    "get_source_policy",
    "minimize_public_query",
    "plan_refresh",
    "research_capsules_to_c02_inputs",
    "sanitize_external_payload",
]
