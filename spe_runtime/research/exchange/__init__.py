"""
SPE Ω — Skills & Plugins Exchange Research Engine Package

Exposes:
- Master Prompt 1: MeritRanker, EvidencePassport, Wilson lower bound calculation
- Master Prompt 2: MissionMatcher, TaskRequirementsAST, Permission Gateway
- Master Prompt 3: SeoGovernor, Indexability classification, Ad Sanctuary
"""

from .merit_ranker import (
    compute_wilson_lower_bound,
    EvaluationDimensions,
    EvidencePassport,
    MeritRanker,
    MeritRankingResult,
    PerformanceMetrics,
    SecurityAudit,
    SecurityDisqualificationError,
    TestedEnvironment,
    ValidityWindow,
)
from .mission_matcher import (
    InterSkillConflictError,
    MissionMatcher,
    MissionMatchResult,
    PermissionViolationError,
    SkillRecommendation,
    TaskRequirementsAST,
)
from .seo_governor import (
    AdSanctuaryViolationError,
    IndexabilityResult,
    ItemListSchema,
    ScaledContentAbuseError,
    SeoGovernor,
    SoftwareApplicationSchema,
    TechArticleSchema,
)

__all__ = [
    # Master Prompt 1: Merit Ranking & Evidence Passports
    "compute_wilson_lower_bound",
    "EvaluationDimensions",
    "EvidencePassport",
    "MeritRanker",
    "MeritRankingResult",
    "PerformanceMetrics",
    "SecurityAudit",
    "SecurityDisqualificationError",
    "TestedEnvironment",
    "ValidityWindow",
    # Master Prompt 2: Mission Matching & Permission Boundaries
    "InterSkillConflictError",
    "MissionMatcher",
    "MissionMatchResult",
    "PermissionViolationError",
    "SkillRecommendation",
    "TaskRequirementsAST",
    # Master Prompt 3: Programmatic SEO & Ad Monetization
    "AdSanctuaryViolationError",
    "IndexabilityResult",
    "ItemListSchema",
    "ScaledContentAbuseError",
    "SeoGovernor",
    "SoftwareApplicationSchema",
    "TechArticleSchema",
]
