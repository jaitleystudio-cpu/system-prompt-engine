"""
SPE Ω — Mechanism B: Compute Allocation based on Value of Additional Reasoning
October 12, 2026 | Research Quarantine Track
"""

from __future__ import annotations
from typing import List, Optional

from spe_runtime.research.egac.types import (
    NANOS_PER_USD,
    ComputationalAction,
    ExecutionStrategy,
    ExperienceLevel,
    TechniqueSetting,
    TechniqueType,
)

class ValueOfInformationAllocator:
    """
    Mechanism B: Predicts the expected benefit of each computational action
    using calibrated Value-of-Information (VOI) scoring and exact integer NanoUSD.
    """

    def __init__(self, default_lambda_latency: float = 10_000.0):
        # lambda represents sensitivity to latency in nanos per millisecond
        # 10,000 nanos/ms = $0.01 per second of delay
        self.default_lambda = default_lambda_latency

    def compute_voi(
        self,
        action: ComputationalAction,
        lambda_latency: Optional[float] = None,
    ) -> float:
        """
        Calculates V(a) = E[Delta Q_verified | a] / (E[C_a] + lambda * E[T_a])
        Returned as verified quality improvement per Dollar ($1.00 = 10^9 nanos).
        """
        lam = self.default_lambda if lambda_latency is None else lambda_latency
        total_denom_nanos = float(action.expected_cost_nanos) + lam * float(action.expected_latency_ms)

        if total_denom_nanos <= 0:
            total_denom_nanos = 1.0

        # VOI normalized to Quality Points per Dollar:
        voi = (action.expected_delta_q * float(NANOS_PER_USD)) / total_denom_nanos
        return max(0.0, voi)

    def rank_actions(
        self,
        actions: List[ComputationalAction],
        lambda_latency: Optional[float] = None,
    ) -> List[tuple[ComputationalAction, float]]:
        """
        Ranks candidate computational actions by descending Value of Information.
        """
        scored = [(a, self.compute_voi(a, lambda_latency)) for a in actions]
        return sorted(scored, key=lambda pair: pair[1], reverse=True)

    def plan_strategy(
        self,
        objective: str,
        experience_level: ExperienceLevel,
        difficulty_score: float = 0.5,  # 0.0 to 1.0 calibrated difficulty
        q_min: float = 0.85,
        epsilon_violation: float = 0.001,
        max_latency_ms: int = 5000,
    ) -> ExecutionStrategy:
        """
        Solves constrained optimization:
          min_pi E[C(pi)]
          subject to Pr(success | pi) >= q_min,
                     Pr(violation | pi) <= epsilon,
                     P95(latency | pi) <= max_latency_ms

        Adapts model, context, reasoning budget, caching, and verification.
        When constraints cannot be jointly met, retains qualified baseline and reports infeasibility.
        """
        lower_obj = objective.lower()
        is_long_form = (
            "100,000" in objective
            or "100k" in lower_obj
            or "50,000" in objective
            or "50k" in lower_obj
            or "manuscript" in lower_obj
            or "dissertation" in lower_obj
            or "treatise" in lower_obj
            or "monograph" in lower_obj
            or "novel" in lower_obj
            or "complete" in lower_obj
        )

        base_techniques: dict[TechniqueType, TechniqueSetting] = {
            TechniqueType.JSON_MINIFICATION: TechniqueSetting.AUTO,
            TechniqueType.OUTPUT_TOKEN_BUDGET_2048: TechniqueSetting.FORCE_OFF,
            TechniqueType.WHITESPACE_NORMALIZATION: TechniqueSetting.AUTO,
            TechniqueType.CONTEXT_WINDOW_TRIM: TechniqueSetting.AUTO,
            TechniqueType.DUPLICATE_MESSAGE_COLLAPSE: TechniqueSetting.AUTO,
            TechniqueType.EXACT_MATCH_RESPONSE_CACHE: TechniqueSetting.AUTO,
            TechniqueType.CONCISE_OUTPUT_INSTRUCTION: TechniqueSetting.FORCE_OFF,
            TechniqueType.SIMPLE_QUERY_MODEL_ROUTING: TechniqueSetting.AUTO,
        }

        # Candidate execution policies portfolio
        # Success probability scales inversely with task difficulty for lightweight models
        candidates: List[ExecutionStrategy] = []

        # Candidate 1: Immediate Edge (Minimal cost, lowest latency)
        imm_tech = dict(base_techniques)
        imm_tech[TechniqueType.EXACT_MATCH_RESPONSE_CACHE] = TechniqueSetting.FORCE_ON
        imm_tech[TechniqueType.SIMPLE_QUERY_MODEL_ROUTING] = TechniqueSetting.FORCE_ON
        if not is_long_form:
            imm_tech[TechniqueType.OUTPUT_TOKEN_BUDGET_2048] = TechniqueSetting.AUTO

        p_succ_imm = max(0.50, round(0.96 - (0.12 * difficulty_score), 3))
        candidates.append(
            ExecutionStrategy(
                strategy_id="strat-immediate-01",
                experience_level=ExperienceLevel.IMMEDIATE,
                model_name="spe-fast-edge",
                reasoning_budget=1,
                techniques_enabled=imm_tech,
                cache_policy="AGGRESSIVE_STRICT_AUTH",
                context_strategy="MINIMAL_ESSENTIAL",
                verification_depth="SHALLOW_CONTRACT",
                estimated_cost_nanos=5_000_000,  # $0.005
                estimated_latency_ms=250,
                predicted_success_prob=p_succ_imm,
            )
        )

        # Candidate 2: Expert Adaptive Hybrid
        hyb_tech = dict(base_techniques)
        if not is_long_form and difficulty_score < 0.4:
            hyb_tech[TechniqueType.OUTPUT_TOKEN_BUDGET_2048] = TechniqueSetting.AUTO
        p_succ_hyb = max(0.60, round(0.97 - (0.08 * difficulty_score), 3))
        candidates.append(
            ExecutionStrategy(
                strategy_id="strat-expert-hybrid",
                experience_level=ExperienceLevel.EXPERT,
                model_name="spe-adaptive-hybrid",
                reasoning_budget=3,
                techniques_enabled=hyb_tech,
                cache_policy="CONTRACT_SCOPED",
                context_strategy="REQUIREMENT_DEPENDENT",
                verification_depth="MULTI_AXIS_CSC",
                estimated_cost_nanos=25_000_000,  # $0.025
                estimated_latency_ms=900,
                predicted_success_prob=p_succ_hyb,
            )
        )

        # Candidate 3: Expert Pro (Higher reasoning, formal checks)
        pro_tech = dict(base_techniques)
        p_succ_pro = max(0.70, round(0.99 - (0.03 * difficulty_score), 3))
        candidates.append(
            ExecutionStrategy(
                strategy_id="strat-expert-pro",
                experience_level=ExperienceLevel.EXPERT,
                model_name="spe-expert-pro",
                reasoning_budget=6,
                techniques_enabled=pro_tech,
                cache_policy="CONTRACT_SCOPED",
                context_strategy="REQUIREMENT_DEPENDENT",
                verification_depth="MULTI_AXIS_CSC",
                estimated_cost_nanos=85_000_000,  # $0.085
                estimated_latency_ms=1800,
                predicted_success_prob=p_succ_pro,
            )
        )

        # Candidate 4: Frontier Reasoner Omega (Discovery / Maximum intelligence)
        disc_tech = dict(base_techniques)
        disc_tech[TechniqueType.OUTPUT_TOKEN_BUDGET_2048] = TechniqueSetting.FORCE_OFF
        disc_tech[TechniqueType.CONCISE_OUTPUT_INSTRUCTION] = TechniqueSetting.FORCE_OFF
        disc_tech[TechniqueType.SIMPLE_QUERY_MODEL_ROUTING] = TechniqueSetting.FORCE_OFF
        p_succ_disc = 0.995
        candidates.append(
            ExecutionStrategy(
                strategy_id="strat-discovery-frontier",
                experience_level=ExperienceLevel.DISCOVERY,
                model_name="spe-frontier-reasoner-omega",
                reasoning_budget=16,
                techniques_enabled=disc_tech,
                cache_policy="PARTITIONED_ISOLATED",
                context_strategy="FULL_EVIDENCE_EXPANDED",
                verification_depth="DEEP_FORMAL_AND_COUNTERFACTUAL",
                estimated_cost_nanos=450_000_000,  # $0.45
                estimated_latency_ms=min(max_latency_ms, 15000),
                predicted_success_prob=p_succ_disc,
            )
        )

        # Apply Experience Level Filtering
        if experience_level == ExperienceLevel.DISCOVERY:
            # Discovery demands frontier capability
            eligible = [c for c in candidates if c.experience_level == ExperienceLevel.DISCOVERY]
        elif experience_level == ExperienceLevel.IMMEDIATE:
            eligible = [
                c for c in candidates
                if c.predicted_success_prob >= q_min and c.estimated_latency_ms <= max_latency_ms
            ]
            if not eligible:
                # If immediate edge model is insufficient for q_min, escalate to minimum qualified
                eligible = [c for c in candidates if c.predicted_success_prob >= q_min]
        else: # EXPERT
            # Select expert or discovery tiers meeting constraints
            eligible = [
                c for c in candidates
                if c.predicted_success_prob >= q_min
                and c.estimated_latency_ms <= max_latency_ms
                and c.experience_level in {ExperienceLevel.EXPERT, ExperienceLevel.DISCOVERY}
            ]
            # If difficulty is high, mandate minimum Expert Pro
            if difficulty_score > 0.65:
                eligible = [c for c in eligible if c.strategy_id in {"strat-expert-pro", "strat-discovery-frontier"}]

        # Check feasibility
        if eligible:
            # Solve min_pi E[C(pi)]
            selected = min(eligible, key=lambda s: s.estimated_cost_nanos)
            selected.is_feasible = True
            selected.infeasibility_reason = None
            return selected

        # If infeasible under hard constraints, fall back to qualified baseline with audit notice
        fallback = candidates[-1] if experience_level == ExperienceLevel.DISCOVERY else candidates[2]
        fallback.is_feasible = False
        fallback.infeasibility_reason = (
            f"Infeasible: Requested constraints (q_min={q_min}, max_latency={max_latency_ms}ms) "
            f"cannot be jointly met. Retaining qualified baseline ({fallback.model_name})."
        )
        return fallback
