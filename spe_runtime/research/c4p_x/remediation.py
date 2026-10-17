"""
SPE Ω — C4P-X+ Remediation Analyzer.
Computes the Minimal Remediation Set R* when workflow continuation is blocked.
"""
from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Set, Optional, Any

from .kernel_repaired import NanoUSD

class RemediationActionType(str, Enum):
    GRANT_CLOUD_TOKEN_LEASE = "GRANT_CLOUD_TOKEN_LEASE"
    DOWNLOAD_QUALIFIED_LOCAL_MODEL = "DOWNLOAD_QUALIFIED_LOCAL_MODEL"
    EMIT_SUPPORTED_PARTIAL_REPORT = "EMIT_SUPPORTED_PARTIAL_REPORT"
    ALLOW_NETWORK_EGRESS = "ALLOW_NETWORK_EGRESS"
    SUPPLY_PREREQUISITE_INPUT = "SUPPLY_PREREQUISITE_INPUT"

@dataclass
class RemediationOption:
    option_id: str
    action_type: RemediationActionType
    title: str
    description: str
    estimated_cost_nanos: NanoUSD
    estimated_latency_ms: float
    unblocks_obligations: List[str]

@dataclass
class RemediationDiagnostic:
    task_name: str
    satisfied_obligations_count: int
    total_obligations_count: int
    spent_usd: float
    preserved_facts_summary: List[str]
    blocking_reasons: List[str]
    minimal_remediation_options: List[RemediationOption]

class RemediationAnalyzer:
    @classmethod
    def analyze_blockage(
        cls,
        task_name: str,
        satisfied_obligations: Set[str],
        all_obligations: Set[str],
        spent_nanos: NanoUSD,
        preserved_facts: Dict[str, Any],
        cloud_revoked: bool,
        required_capability: Optional[str] = None,
        available_budget_nanos: NanoUSD = 0,
        required_budget_nanos: NanoUSD = 0,
    ) -> RemediationDiagnostic:
        blocking_reasons = []
        options = []

        if cloud_revoked:
            blocking_reasons.append(
                f"Cloud inference revoked, but local execution lacks '{required_capability or 'FRONTIER'}' qualification"
            )
            # Option 1: 1-shot token lease
            options.append(RemediationOption(
                option_id="opt_1_cloud_lease",
                action_type=RemediationActionType.GRANT_CLOUD_TOKEN_LEASE,
                title="Grant 1-shot Cloud Token Lease",
                description="Authorizes a one-shot cloud token lease ($0.02 Max) to complete reasoning.",
                estimated_cost_nanos=20_000_000,
                estimated_latency_ms=1500.0,
                unblocks_obligations=list(all_obligations - satisfied_obligations),
            ))
            # Option 2: Download local SLM
            options.append(RemediationOption(
                option_id="opt_2_local_model",
                action_type=RemediationActionType.DOWNLOAD_QUALIFIED_LOCAL_MODEL,
                title="Download qualified local model 'qwen2.5-coder:7b' (4.2 GB)",
                description="Downloads local weights to run reasoning locally with zero cloud charges.",
                estimated_cost_nanos=0,
                estimated_latency_ms=120_000.0,
                unblocks_obligations=list(all_obligations - satisfied_obligations),
            ))
            # Option 3: Emit partial report
            options.append(RemediationOption(
                option_id="opt_3_partial_report",
                action_type=RemediationActionType.EMIT_SUPPORTED_PARTIAL_REPORT,
                title="Emit supported partial report (reproduction script + AST diff)",
                description="Finalizes safely with existing verified deterministic facts and diagnostic receipts.",
                estimated_cost_nanos=0,
                estimated_latency_ms=50.0,
                unblocks_obligations=[],
            ))

        if available_budget_nanos < required_budget_nanos:
            blocking_reasons.append(
                f"Budget deficit: required {required_budget_nanos} nanos, available {available_budget_nanos} nanos"
            )

        fact_summaries = [f"Verified fact '{k}'" for k in preserved_facts.keys()]

        return RemediationDiagnostic(
            task_name=task_name,
            satisfied_obligations_count=len(satisfied_obligations),
            total_obligations_count=len(all_obligations),
            spent_usd=round(spent_nanos / 1_000_000_000.0, 4),
            preserved_facts_summary=fact_summaries,
            blocking_reasons=blocking_reasons,
            minimal_remediation_options=options,
        )
