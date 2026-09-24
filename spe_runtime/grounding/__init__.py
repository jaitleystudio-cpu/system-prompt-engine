"""Context grounding contracts — immutable need/capsule models + need compiler."""

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
    SupportStatus,
)
from spe_runtime.grounding.need import compile_context_need
from spe_runtime.grounding.policies import SourcePolicy, get_source_policy
from spe_runtime.grounding.privacy import MinimizedQuery, minimize_public_query
from spe_runtime.grounding.profiles import DomainProfile, get_domain_profile
from spe_runtime.grounding.recipes import ContextRecipe, get_context_recipe

__all__ = [
    "ContextCapsule",
    "ContextNeed",
    "ContextRecipe",
    "ContextType",
    "DomainProfile",
    "FreshnessState",
    "MinimizedQuery",
    "PrivacyClass",
    "RefreshPlan",
    "SourcePolicy",
    "SupportStatus",
    "compile_context_need",
    "freshness_state",
    "get_context_recipe",
    "get_domain_profile",
    "get_source_policy",
    "minimize_public_query",
    "plan_refresh",
    "sanitize_external_payload",
]
