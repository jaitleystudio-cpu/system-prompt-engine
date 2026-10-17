"""SPE Ω — Autonomous Website Evolution Python Types & Dataclasses.

Mandate:
Grounded in SWE-bench Goes Live! (NeurIPS 2025), SAGEO Arena (KDD 2026),
Google Search Central (2026), and WCAG 2.2 specifications.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class AutonomyLevel(str, Enum):
    L0_OBSERVE = "L0_OBSERVE"
    L1_DIAGNOSE = "L1_DIAGNOSE"
    L2_PREPARE = "L2_PREPARE"
    L3_QUALIFY = "L3_QUALIFY"
    L4_LIMITED_AUTO_RELEASE = "L4_LIMITED_AUTO_RELEASE"
    L5_HUMAN_AUTHORIZED = "L5_HUMAN_AUTHORIZED"


class ChangeRiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class ProposalStatus(str, Enum):
    PROPOSED = "PROPOSED"
    REPRODUCED = "REPRODUCED"
    PATCH_PREPARED = "PATCH_PREPARED"
    QUALIFIED = "QUALIFIED"
    APPROVED_FOR_RELEASE = "APPROVED_FOR_RELEASE"
    PROMOTED = "PROMOTED"
    REJECTED = "REJECTED"
    ROLLED_BACK = "ROLLED_BACK"
    HELD_INCONCLUSIVE = "HELD_INCONCLUSIVE"


class DefectCategory(str, Enum):
    BROKEN_INTERNAL_LINK = "BROKEN_INTERNAL_LINK"
    CANONICAL_CONFLICT = "CANONICAL_CONFLICT"
    ACCIDENTAL_NOINDEX = "ACCIDENTAL_NOINDEX"
    SITEMAP_INCONSISTENCY = "SITEMAP_INCONSISTENCY"
    INVALID_STRUCTURED_DATA = "INVALID_STRUCTURED_DATA"
    KEYWORD_STUFFING = "KEYWORD_STUFFING"
    FABRICATED_CLAIM = "FABRICATED_CLAIM"
    DUPLICATE_PAGE = "DUPLICATE_PAGE"
    INELIGIBLE_INDEXING_API = "INELIGIBLE_INDEXING_API"
    MOBILE_CLIPPING = "MOBILE_CLIPPING"
    HIDDEN_CTA = "HIDDEN_CTA"
    KEYBOARD_NAV_BROKEN = "KEYBOARD_NAV_BROKEN"
    A11Y_SCREEN_READER = "A11Y_SCREEN_READER"
    LCP_REGRESSION = "LCP_REGRESSION"
    CLS_REGRESSION = "CLS_REGRESSION"
    HYDRATION_FAILURE = "HYDRATION_FAILURE"
    OBSERVABILITY_SILENT_ERROR = "OBSERVABILITY_SILENT_ERROR"
    FALSE_SUCCESS_CLAIM = "FALSE_SUCCESS_CLAIM"
    TEST_TAMPERING_REWARD_HACK = "TEST_TAMPERING_REWARD_HACK"
    PROMPT_INJECTION_EXTERNAL = "PROMPT_INJECTION_EXTERNAL"
    MODEL_NAME_REGISTRY_DRIFT = "MODEL_NAME_REGISTRY_DRIFT"
    SPE_COMPATIBILITY_REGRESSION = "SPE_COMPATIBILITY_REGRESSION"
    CONCURRENT_JOB_CONFLICT = "CONCURRENT_JOB_CONFLICT"
    INTERRUPTED_DEPLOYMENT = "INTERRUPTED_DEPLOYMENT"
    SPARSE_SEARCH_DATA = "SPARSE_SEARCH_DATA"
    GOOGLE_API_OUTAGE = "GOOGLE_API_OUTAGE"
    OSCILLATION_REPEATED_FAILURE = "OSCILLATION_REPEATED_FAILURE"
    UNAUTHORIZED_PRODUCTION_WRITE = "UNAUTHORIZED_PRODUCTION_WRITE"
    DECEPTIVE_VISUAL_PASS = "DECEPTIVE_VISUAL_PASS"
    ROLLBACK_FAILURE = "ROLLBACK_FAILURE"


@dataclass
class EvidenceReceipt:
    id: str
    source: str
    timestamp: str
    payload_digest: str
    is_finalized: bool
    confidence_score: float
    raw_details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class SearchConsoleQueryRow:
    query: str
    page: str
    country: str
    device: str
    date: str
    search_appearance: str
    impressions: int
    clicks: int
    ctr: float
    position: float
    is_finalized: bool


@dataclass
class IntentTaskMapping:
    query: str
    detected_intent: str
    authoritative_route: str
    expected_user_task: str
    title_aligned: bool
    cta_aligned: bool
    recommendation: str


@dataclass
class MinimalPatch:
    target_file: str
    original_chunk: str
    replacement_chunk: str
    line_count_diff: int


@dataclass
class FailingTestBeforeFix:
    test_name: str
    failing_output: str
    reproduced: bool


@dataclass
class QualificationResults:
    targeted_unit_tests_passed: bool
    regression_suite_passed: bool
    security_policy_passed: bool
    visual_a11y_passed: bool
    seo_policy_passed: bool
    oracle_integrity_preserved: bool
    anti_mutation_kill_rate: float


@dataclass
class ApprovalAuthority:
    status: ProposalStatus
    authorized_by: str
    authorization_timestamp: Optional[str] = None
    rejection_reason: Optional[str] = None


@dataclass
class RollbackReference:
    snapshot_commit: str
    rollback_recipe: str
    verified_rollback_capable: bool


@dataclass
class ProofCarryingChangeProposal:
    id: str
    defect_category: DefectCategory
    observed_evidence: EvidenceReceipt
    affected_routes: List[str]
    affected_components: List[str]
    root_cause_hypothesis: str
    minimal_patch: MinimalPatch
    failing_test_before_fix: FailingTestBeforeFix
    expected_user_benefit: str
    potential_harm: str
    risk_level: ChangeRiskLevel
    required_autonomy: AutonomyLevel
    qualification_results: QualificationResults
    approval_authority: ApprovalAuthority
    rollback_reference: RollbackReference
    verification_digest: str
