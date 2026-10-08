"""SPE Ω Hybrid Switchboard: Proof-Aware Compute Placement & Intelligent Switcher.

Directs execution between local CPU deterministic code ($0), local neural models ($0 tokens),
and authorized paid cloud models with cryptographic budget escrow and privacy boundaries.
"""

from __future__ import annotations

import re
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from spe_runtime.cost_engine.deterministic_offloader import DeterministicOffloader
from spe_runtime.cost_engine.telemetry import (
    CostSource,
    TelemetryEvidence,
    compute_pinned_cost,
)
from spe_runtime.hybrid.cloud_gate import (
    BudgetEscrow,
    BudgetExceededError,
    CloudGate,
    EgressProhibitedError,
)
from spe_runtime.hybrid.device_profiler import DeviceProfiler
from spe_runtime.hybrid.models import (
    DataDisclosureScope,
    DeviceCapabilityProfile,
    ExecutionPlacementCertificate,
    ExecutionPlacementPlan,
    HybridPolicy,
    PlacementTarget,
    TaskRequirement,
)


def _re_math_search(query: str) -> Optional[str]:
    """Extracts candidate arithmetic expression from query."""
    m = re.search(r"(\d+[\d\s\+\-\*\/\%\(\)\.]+\d+)", query)
    return m.group(1).strip() if m else None


class HybridSwitchboard:
    """Intelligent Switchboard allocating compute between local engine and cloud tokens."""

    def __init__(
        self,
        profiler: Optional[DeviceProfiler] = None,
        cloud_gate: Optional[CloudGate] = None,
        offloader: Optional[DeterministicOffloader] = None,
        local_upstream_url: Optional[str] = None,
        cloud_upstream_url: Optional[str] = None,
    ) -> None:
        self.profiler = profiler or DeviceProfiler()
        self.cloud_gate = cloud_gate or CloudGate(policy=HybridPolicy.STRICT_OFFLINE)
        self.offloader = offloader or DeterministicOffloader()
        self.local_upstream_url = local_upstream_url
        self.cloud_upstream_url = cloud_upstream_url

    def plan(
        self,
        task: TaskRequirement,
        approval_token: Optional[str] = None,
        force_cloud_model: Optional[str] = None,
    ) -> ExecutionPlacementPlan:
        """Determines the least expensive qualified execution placement for a task."""
        plan_id = f"plan-{uuid.uuid4().hex[:12]}"

        # 1. Deterministic AST Offload Check (DACO) -> LOCAL_DETERMINISTIC ($0)
        math_expr = _re_math_search(task.prompt)
        if math_expr and self.offloader.can_offload_math(math_expr) and any(op in math_expr for op in "+-*/%"):
            return ExecutionPlacementPlan(
                plan_id=plan_id,
                task_id=task.task_id,
                target=PlacementTarget.LOCAL_DETERMINISTIC,
                policy=self.cloud_gate.policy,
                disclosure_scope=self.cloud_gate.disclosure_scope,
                estimated_cost_usd=0.0,
                justification=f"Task can be solved 100% deterministically via AST math offloader ({math_expr}). Zero cloud tokens used.",
            )

        # 2. Local Device Qualification Check -> LOCAL_NEURAL ($0 cloud spend)
        profile = self.profiler.profile()
        verdict = profile.qualify_for_task(
            task_complexity_score=task.complexity_score,
            context_tokens=task.estimated_tokens,
        )

        # If device qualifies and has a local model or local upstream engine configured
        if verdict.qualified:
            local_model = profile.installed_local_models[0] if profile.installed_local_models else "spe-zero-friction-local"
            return ExecutionPlacementPlan(
                plan_id=plan_id,
                task_id=task.task_id,
                target=PlacementTarget.LOCAL_NEURAL,
                policy=self.cloud_gate.policy,
                disclosure_scope=self.cloud_gate.disclosure_scope,
                estimated_cost_usd=0.0,
                local_backend_url=self.local_upstream_url or "http://127.0.0.1:11434",
                justification=f"User's device is qualified for local execution: {verdict.reason}. Running on local engine ($0 API cost).",
            )

        # 3. Device Not Qualified -> Evaluate Cloud Gate
        # Estimate cloud cost conservatively from pinned price table
        cloud_model = force_cloud_model or "gpt-4o"
        est_cost_usd, _, _ = compute_pinned_cost(
            prompt_tokens=task.estimated_tokens,
            completion_tokens=max(64, task.estimated_tokens // 2),
            model=cloud_model,
        )


        # Check policy eligibility
        eligible, reason = self.cloud_gate.check_eligibility(
            task=task,
            provider="openai",
            estimated_usd=est_cost_usd,
            approval_token=approval_token,
        )

        # If STRICT_OFFLINE or unauthorized: Cloud tokens cannot be released!
        if not eligible:
            if self.cloud_gate.policy == HybridPolicy.STRICT_OFFLINE:
                return ExecutionPlacementPlan(
                    plan_id=plan_id,
                    task_id=task.task_id,
                    target=PlacementTarget.LOCAL_RECOVERY,
                    policy=self.cloud_gate.policy,
                    disclosure_scope=self.cloud_gate.disclosure_scope,
                    estimated_cost_usd=0.0,
                    justification=f"STRICT_OFFLINE policy forbids cloud tokens. Switching to local deterministic recovery fallback ($0).",
                )
            else:
                return ExecutionPlacementPlan(
                    plan_id=plan_id,
                    task_id=task.task_id,
                    target=PlacementTarget.BLOCKED,
                    policy=self.cloud_gate.policy,
                    disclosure_scope=self.cloud_gate.disclosure_scope,
                    estimated_cost_usd=0.0,
                    justification=f"Cloud escalation blocked: {reason}.",
                )

        # 4. Hybrid Split vs Cloud Authorized
        # If task complexity is intermediate (0.75 - 0.90), we split: local preprocessing + cloud reasoning
        if 0.75 < task.complexity_score <= 0.90:
            target = PlacementTarget.HYBRID_SPLIT
            # Half of tokens handled locally, only remainder sent to cloud
            reduced_cloud_cost = round(est_cost_usd * 0.6, 6)
            subtask_splits = [
                {"stage": "local_preprocessing", "target": "LOCAL_DETERMINISTIC", "cost_usd": 0.0},
                {"stage": "cloud_synthesis", "target": "CLOUD_AUTHORIZED", "cost_usd": reduced_cloud_cost},
                {"stage": "local_verification", "target": "LOCAL_DETERMINISTIC", "cost_usd": 0.0},
            ]
            try:
                res = self.cloud_gate.open_gate(task, "openai", reduced_cloud_cost, approval_token)
                return ExecutionPlacementPlan(
                    plan_id=plan_id,
                    task_id=task.task_id,
                    target=target,
                    policy=self.cloud_gate.policy,
                    disclosure_scope=self.cloud_gate.disclosure_scope,
                    estimated_cost_usd=reduced_cloud_cost,
                    escrow_id=res.escrow_id,
                    cloud_provider="openai",
                    cloud_model_id=cloud_model,
                    subtask_splits=subtask_splits,
                    justification=f"Task split: local extraction & verification ($0) + cloud reasoning (${reduced_cloud_cost:.4f}).",
                )
            except BudgetExceededError as e:
                return ExecutionPlacementPlan(
                    plan_id=plan_id,
                    task_id=task.task_id,
                    target=PlacementTarget.LOCAL_RECOVERY,
                    policy=self.cloud_gate.policy,
                    disclosure_scope=self.cloud_gate.disclosure_scope,
                    estimated_cost_usd=0.0,
                    justification=f"Budget exceeded for hybrid split ({str(e)}). Fallback to local recovery.",
                )

        # Full Cloud Authorized
        try:
            res = self.cloud_gate.open_gate(task, "openai", est_cost_usd, approval_token)
            return ExecutionPlacementPlan(
                plan_id=plan_id,
                task_id=task.task_id,
                target=PlacementTarget.CLOUD_AUTHORIZED,
                policy=self.cloud_gate.policy,
                disclosure_scope=self.cloud_gate.disclosure_scope,
                estimated_cost_usd=est_cost_usd,
                escrow_id=res.escrow_id,
                cloud_provider="openai",
                cloud_model_id=cloud_model,
                justification=f"Cloud authorized: device cannot run task ({verdict.reason}). Reserved escrow ${est_cost_usd:.4f}.",
            )
        except BudgetExceededError as e:
            return ExecutionPlacementPlan(
                plan_id=plan_id,
                task_id=task.task_id,
                target=PlacementTarget.LOCAL_RECOVERY,
                policy=self.cloud_gate.policy,
                disclosure_scope=self.cloud_gate.disclosure_scope,
                estimated_cost_usd=0.0,
                justification=f"Budget exceeded for cloud escalation ({str(e)}). Fallback to local recovery.",
            )

    def certify(
        self,
        plan: ExecutionPlacementPlan,
        actual_spent_usd: float = 0.0,
        evidence: TelemetryEvidence = TelemetryEvidence.OBSERVED_USAGE,
    ) -> ExecutionPlacementCertificate:
        """Issues an immutable execution placement certificate with SHA-256 integrity hash."""
        now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        cert_id = f"cert-{uuid.uuid4().hex[:12]}"
        cost_source = CostSource.LOCAL_PINNED_PRICE_TABLE

        # Reconcile escrow if one was active
        if plan.escrow_id:
            self.cloud_gate.escrow.commit(plan.escrow_id, actual_spent_usd)

        remaining = self.cloud_gate.escrow.available_budget_usd

        return ExecutionPlacementCertificate.create(
            certificate_id=cert_id,
            plan_id=plan.plan_id,
            task_id=task_id if (task_id := plan.task_id) else "task-default",
            selected_target=plan.target,
            policy=plan.policy,
            budget_spent_usd=actual_spent_usd,
            budget_remaining_usd=remaining,
            evidence_class=evidence,
            cost_source=cost_source,
            timestamp_iso=now_iso,
        )
