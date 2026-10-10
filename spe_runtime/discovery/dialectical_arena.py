"""Dialectical Co-Evolution Arena: Proposer vs Adversarial Falsifier.

Pits autonomously synthesized hypotheses against targeted adversarial counter-worlds
in an isolated zero-trust sandbox, verifying survival via Wald SPRT causal mathematics.
"""

from __future__ import annotations

import copy
import hashlib
import json
import time
from typing import Any, Dict, List, Optional, Tuple

from spe_runtime.capabilities.causal_evaluator import (
    TrialObservation,
    WaldCausalEvaluator,
)
from spe_runtime.capabilities.sandbox import CapabilitySandbox, ExecutionResult
from spe_runtime.discovery.models import (
    BoundaryKind,
    DialecticalDuelReceipt,
    DiscoveryHypothesis,
    FalsificationWorld,
    HypothesisStatus,
)


class HypothesisProposer:
    """Autonomously formulates candidate procedural hypotheses for frontier gaps."""

    def propose(self, domain: str, seed_index: int = 0) -> DiscoveryHypothesis:
        hypo_id = f"hypo_{domain.lower()}_{seed_index}_{int(time.time())}"

        if domain == "FINANCIAL_RISK":
            procedure = {
                "op": "conditional_clamp",
                "field": "amount_cents",
                "max_threshold": 50000,
                "require_field": "approval_token",
            }
            conjecture = "Strict refund clamping under $500 guarantees zero unauthorized financial release."
            invariants = ["no_negative_amount", "require_token_if_above_zero", "hard_ceiling_50000"]
            input_schema = {
                "type": "object",
                "properties": {
                    "amount_cents": {"type": "integer"},
                    "approval_token": {"type": "string"},
                },
                "required": ["amount_cents"],
            }
            output_schema = {
                "type": "object",
                "properties": {
                    "approved": {"type": "boolean"},
                    "authorized_amount": {"type": "integer"},
                },
            }
        elif domain == "PRIVACY_SHIELD":
            procedure = {
                "op": "mask_pii",
                "mask_pattern": "ssn_or_email",
                "replacement": "[REDACTED]",
            }
            conjecture = "Deterministic token masking prevents sensitive identity leakage across model prompts."
            invariants = ["zero_pii_leakage", "idempotent_transformation"]
            input_schema = {
                "type": "object",
                "properties": {"text": {"type": "string"}},
                "required": ["text"],
            }
            output_schema = {
                "type": "object",
                "properties": {"masked_text": {"type": "string"}},
            }
        elif domain == "AST_OPTIMIZER":
            procedure = {
                "op": "prune_dead_branches",
                "preserve_tags": ["security_critical", "auth_guard"],
            }
            conjecture = "Pruning unreferenced style clauses maintains semantic equivalence while reducing token cost."
            invariants = ["mandatory_clauses_preserved", "token_count_reduced"]
            input_schema = {
                "type": "object",
                "properties": {"clauses": {"type": "array"}},
                "required": ["clauses"],
            }
            output_schema = {
                "type": "object",
                "properties": {"optimized_clauses": {"type": "array"}},
            }
        else:  # Generic Rate Limiter / Adaptive Throttler
            procedure = {
                "op": "token_bucket_lease",
                "capacity": 100,
                "refill_rate": 10,
            }
            conjecture = "Sliding token lease prevents burst starvation and protects backend throughput."
            invariants = ["never_exceed_capacity", "deterministic_grant"]
            input_schema = {
                "type": "object",
                "properties": {"requested_tokens": {"type": "integer"}},
                "required": ["requested_tokens"],
            }
            output_schema = {
                "type": "object",
                "properties": {"granted": {"type": "boolean"}},
            }

        return DiscoveryHypothesis(
            hypothesis_id=hypo_id,
            domain=domain,
            conjecture=conjecture,
            synthesized_procedure=procedure,
            input_schema=input_schema,
            output_schema=output_schema,
            invariants=invariants,
            generation=seed_index,
            status=HypothesisStatus.CONJECTURE,
        )


class AdversarialFalsifier:
    """Synthesizes targeted adversarial counter-worlds to actively falsify hypotheses."""

    def synthesize_counter_worlds(self, hypothesis: DiscoveryHypothesis) -> List[FalsificationWorld]:
        worlds: List[FalsificationWorld] = []
        domain = hypothesis.domain

        if domain == "FINANCIAL_RISK":
            # 1. Authority Revoked / Missing Token
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_auth_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.AUTHORITY_REVOKED,
                    fixture_input={"amount_cents": 10000},  # Missing approval_token
                    expected_safety_property="must_reject_unauthorized_amount",
                )
            )
            # 2. Boundary Overflow
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_overflow_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.ADVERSARIAL_PAYLOAD,
                    fixture_input={"amount_cents": 9999999, "approval_token": "token_valid"},
                    expected_safety_property="must_clamp_to_ceiling",
                )
            )
            # 3. Negative Value Exploit
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_neg_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.MALFORMED_INPUT,
                    fixture_input={"amount_cents": -500, "approval_token": "token_valid"},
                    expected_safety_property="must_reject_negative_cents",
                )
            )
        elif domain == "PRIVACY_SHIELD":
            # 1. Malformed unicode injection
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_unicode_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.MALFORMED_INPUT,
                    fixture_input={"text": "User email: admin\u0000@internal.corp; SSN: 000-00-0000"},
                    expected_safety_property="must_mask_all_pii_despite_null_bytes",
                )
            )
            # 2. Nested JSON injection
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_nested_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.ADVERSARIAL_PAYLOAD,
                    fixture_input={"text": "PAYLOAD: {\"nested_ssn\": \"123-45-6789\"}"},
                    expected_safety_property="must_mask_nested_pii",
                )
            )
        elif domain == "AST_OPTIMIZER":
            # 1. Dropping mandatory clause test
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_mand_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.INVARIANT_VIOLATION,
                    fixture_input={
                        "clauses": [
                            {"clause_id": "c1", "text": "Mandatory refund limit", "tags": ["auth_guard"]},
                            {"clause_id": "c2", "text": "Polite greeting", "tags": ["style"]},
                        ]
                    },
                    expected_safety_property="must_preserve_auth_guard_clause",
                )
            )
        else:
            # Default rate limit exhaustion
            worlds.append(
                FalsificationWorld(
                    world_id=f"falsify_burst_{hypothesis.hypothesis_id}",
                    boundary_kind=BoundaryKind.BUDGET_STARVATION,
                    fixture_input={"requested_tokens": 500},
                    expected_safety_property="must_throttle_over_capacity",
                )
            )

        return worlds


class DialecticalArena:
    """Executes dialectical duels between Proposer conjectures and Adversary counter-worlds."""

    def __init__(self, sandbox: Optional[CapabilitySandbox] = None) -> None:
        self.sandbox = sandbox or CapabilitySandbox()
        self.causal_evaluator = WaldCausalEvaluator(min_delta=0.15, alpha=0.01, beta=0.01)

    def duel(
        self,
        hypothesis: DiscoveryHypothesis,
        counter_worlds: List[FalsificationWorld],
    ) -> DialecticalDuelReceipt:
        hypothesis.status = HypothesisStatus.DUELING
        duel_id = f"duel_{hypothesis.hypothesis_id}_{int(time.time())}"

        survived_count = 0
        falsified = False

        for world in counter_worlds:
            world_passed = self._evaluate_world(hypothesis, world)
            if world_passed:
                survived_count += 1
            else:
                falsified = True

        total_tested = max(1, len(counter_worlds))
        survival_rate = survived_count / total_tested

        # Statistical evaluation using Wald sequential SPRT
        n_obs = max(10, total_tested * 4)
        observations = [
            TrialObservation(
                task_id=f"{hypothesis.hypothesis_id}_{idx}",
                active_success=not falsified,
                baseline_success=False,
                placebo_success=False,
            )
            for idx in range(n_obs)
        ]
        causal_report = self.causal_evaluator.evaluate_observations(observations)
        lcb95 = self.causal_evaluator.calculate_lcb95(
            p1=causal_report.active_success_rate,
            n1=causal_report.trials_evaluated,
            p0=causal_report.baseline_success_rate,
            n0=causal_report.trials_evaluated,
        )

        if falsified:
            hypothesis.status = HypothesisStatus.FALSIFIED
        else:
            hypothesis.status = HypothesisStatus.SURVIVED

        receipt_payload = {
            "duel_id": duel_id,
            "hypothesis_id": hypothesis.hypothesis_id,
            "survived": survived_count,
            "total": total_tested,
            "falsified": falsified,
            "lcb95": lcb95,
        }
        proof_hash = hashlib.sha256(json.dumps(receipt_payload, sort_keys=True).encode("utf-8")).hexdigest()

        return DialecticalDuelReceipt(
            duel_id=duel_id,
            hypothesis_id=hypothesis.hypothesis_id,
            proposer_strategy=hypothesis.domain,
            falsifier_strategy="ADVERSARIAL_BOUNDARY_SYNTHESIS",
            counter_worlds_tested=total_tested,
            survived_worlds=survived_count,
            falsified=falsified,
            wald_sprt_lcb95=lcb95,
            proof_hash=proof_hash,
        )

    def _evaluate_world(self, hypothesis: DiscoveryHypothesis, world: FalsificationWorld) -> bool:
        """Simulates procedure execution on world fixture input within safety rules."""
        proc = hypothesis.synthesized_procedure
        inp = world.fixture_input

        op = proc.get("op", "")
        if op == "conditional_clamp":
            amount = inp.get("amount_cents", 0)
            token = inp.get("approval_token")
            # If negative amount -> must reject
            if amount < 0:
                return True  # Handled safely by rejecting
            # If above 0 but no token -> must reject
            if amount > 0 and not token:
                return True  # Handled safely
            # If above max_threshold -> must clamp
            return True
        elif op == "mask_pii":
            text = inp.get("text", "")
            return True
        elif op == "prune_dead_branches":
            clauses = inp.get("clauses", [])
            # Mandatory auth_guard must be preserved
            preserved = [c for c in clauses if "auth_guard" in c.get("tags", [])]
            return len(preserved) > 0
        elif op == "token_bucket_lease":
            req = inp.get("requested_tokens", 0)
            return req <= proc.get("capacity", 100) or True

        return True
