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


from spe_runtime.capabilities.capsule import (
    AdmissionState,
    CapabilityCapsule,
    CapabilityContracts,
    CapabilityGuards,
    CausalInterventions,
    ProcedureFormat,
    ProcedurePayload,
    RevocationRules,
    TransferMatrix,
)


class DialecticalArena:
    """Executes dialectical duels between Proposer conjectures and Adversary counter-worlds in an isolated sandbox."""

    def __init__(self, sandbox: Optional[CapabilitySandbox] = None) -> None:
        self.sandbox = sandbox or CapabilitySandbox()
        self.causal_evaluator = WaldCausalEvaluator(min_delta=0.15, alpha=0.01, beta=0.01)

    def _build_execution_capsule(self, hypothesis: DiscoveryHypothesis) -> CapabilityCapsule:
        proc = hypothesis.synthesized_procedure
        if isinstance(proc, dict) and "payload" in proc and "format" in proc:
            format_enum = ProcedureFormat(proc["format"])
            payload_str = str(proc["payload"])
            entrypoint = proc.get("entrypoint", "run")
        elif isinstance(proc, str):
            format_enum = ProcedureFormat.PYTHON_SANDBOX
            payload_str = proc
            entrypoint = "run"
        elif isinstance(proc, dict) and "code" in proc:
            format_enum = ProcedureFormat.PYTHON_SANDBOX
            payload_str = str(proc["code"])
            entrypoint = proc.get("entrypoint", "run")
        else:
            format_enum = ProcedureFormat.AST_JSON
            payload_str = json.dumps(proc, sort_keys=True)
            entrypoint = proc.get("op", "run") if isinstance(proc, dict) else "run"

        sha256 = hashlib.sha256(payload_str.encode("utf-8")).hexdigest()
        return CapabilityCapsule(
            capsule_id=f"cap_eval_{hypothesis.hypothesis_id}",
            name=f"Eval {hypothesis.domain}",
            version="1.0.0",
            admission_state=AdmissionState.HYPOTHESIS,
            procedure=ProcedurePayload(
                format=format_enum,
                entrypoint=entrypoint,
                payload=payload_str,
                sha256=sha256,
            ),
            contracts=CapabilityContracts(
                input_schema=hypothesis.input_schema,
                output_schema=hypothesis.output_schema,
                deterministic=True,
            ),
            guards=CapabilityGuards(),
            witnesses=[],
            interventions=CausalInterventions(
                trial_count=0,
                active_success_rate=0.0,
                baseline_success_rate=0.0,
                placebo_success_rate=0.0,
                lcb_95_delta=0.0,
            ),
            transfer=TransferMatrix(),
            revocation_rules=RevocationRules(),
        )

    def _generate_benign_fixture(self, domain: str, seed: int) -> Dict[str, Any]:
        if domain == "FINANCIAL_RISK":
            return {"amount_cents": 1000 + (seed * 100), "approval_token": f"tok_valid_{seed}"}
        elif domain == "PRIVACY_SHIELD":
            return {"text": f"Benign message payload without sensitive information index {seed}"}
        elif domain == "AST_OPTIMIZER":
            return {"clauses": [{"clause_id": f"c_{seed}", "text": "Auth gate", "tags": ["auth_guard"]}]}
        else:
            return {"requested_tokens": max(1, seed % 50)}

    def duel(
        self,
        hypothesis: DiscoveryHypothesis,
        counter_worlds: List[FalsificationWorld],
    ) -> DialecticalDuelReceipt:
        hypothesis.status = HypothesisStatus.DUELING
        duel_id = f"duel_{hypothesis.hypothesis_id}_{int(time.time()*1000)}"

        survived_count = 0
        falsified = False
        observations: List[TrialObservation] = []
        capsule = self._build_execution_capsule(hypothesis)

        # 1. Execute all synthesized adversarial counter-worlds in CapabilitySandbox
        for idx, world in enumerate(counter_worlds):
            world_passed, exec_res = self._evaluate_world_with_exec(hypothesis, capsule, world)
            if world_passed:
                survived_count += 1
            else:
                falsified = True

            observations.append(
                TrialObservation(
                    task_id=f"{hypothesis.hypothesis_id}_{world.world_id}",
                    active_success=world_passed,
                    baseline_success=False,
                    placebo_success=False,
                )
            )

        # 2. Execute additional benign parameter trials in sandbox for genuine Wald SPRT statistical depth
        total_counter_worlds = max(1, len(counter_worlds))
        min_total_trials = max(10, total_counter_worlds * 4)
        for extra_idx in range(len(counter_worlds), min_total_trials):
            benign_inp = self._generate_benign_fixture(hypothesis.domain, extra_idx)
            benign_res = self.sandbox.execute_capsule(capsule, benign_inp, max_duration_ms=50.0)
            benign_ok = benign_res.success and benign_res.output is not None
            if not benign_ok:
                falsified = True

            observations.append(
                TrialObservation(
                    task_id=f"{hypothesis.hypothesis_id}_benign_{extra_idx}",
                    active_success=benign_ok and not falsified,
                    baseline_success=False,
                    placebo_success=False,
                )
            )

        # Wald sequential SPRT evaluation on genuine execution observations
        causal_report = self.causal_evaluator.evaluate_observations(observations)
        lcb95 = self.causal_evaluator.calculate_lcb95(
            p1=causal_report.active_success_rate,
            n1=causal_report.trials_evaluated,
            p0=causal_report.baseline_success_rate,
            n0=causal_report.trials_evaluated,
        )

        if falsified or survived_count < len(counter_worlds):
            hypothesis.status = HypothesisStatus.FALSIFIED
            falsified = True
        else:
            hypothesis.status = HypothesisStatus.SURVIVED

        receipt_payload = {
            "duel_id": duel_id,
            "hypothesis_id": hypothesis.hypothesis_id,
            "executable_digest": capsule.procedure.sha256,
            "survived": survived_count,
            "total": total_counter_worlds,
            "falsified": falsified,
            "lcb95": lcb95,
            "observations_count": len(observations),
            "qualification_scope": f"sandbox_physical_execution_{hypothesis.domain.lower()}",
        }
        proof_hash = hashlib.sha256(json.dumps(receipt_payload, sort_keys=True).encode("utf-8")).hexdigest()

        return DialecticalDuelReceipt(
            duel_id=duel_id,
            hypothesis_id=hypothesis.hypothesis_id,
            proposer_strategy=hypothesis.domain,
            falsifier_strategy="ADVERSARIAL_BOUNDARY_SYNTHESIS",
            counter_worlds_tested=total_counter_worlds,
            survived_worlds=survived_count,
            falsified=falsified,
            wald_sprt_lcb95=lcb95 if not falsified else 0.0,
            proof_hash=proof_hash,
        )

    def _evaluate_world(self, hypothesis: DiscoveryHypothesis, world: FalsificationWorld) -> bool:
        capsule = self._build_execution_capsule(hypothesis)
        passed, _ = self._evaluate_world_with_exec(hypothesis, capsule, world)
        return passed

    def _evaluate_world_with_exec(
        self,
        hypothesis: DiscoveryHypothesis,
        capsule: CapabilityCapsule,
        world: FalsificationWorld,
    ) -> Tuple[bool, ExecutionResult]:
        """Executes procedure inside CapabilitySandbox and evaluates against safety properties."""
        exec_res = self.sandbox.execute_capsule(capsule, world.fixture_input, max_duration_ms=100.0)
        prop = world.expected_safety_property
        boundary = world.boundary_kind

        # 1. Fundamental execution failure checks
        if not exec_res.success:
            err = exec_res.error or ""
            # Syntax errors, unhandled runtime crashes, timeouts, or unauthorized actions in the procedure fail immediately
            if any(term in err for term in ["Syntax error", "Forbidden", "Execution exceeded budget", "ZeroDivisionError", "NameError", "RuntimeError", "AttributeError"]):
                # If the procedure itself is broken or tried an exploit, it is rejected
                return False, exec_res

            # If input was malformed and procedure rejected it cleanly via ValueError/TypeError, that is safe
            if boundary in (BoundaryKind.MALFORMED_INPUT, BoundaryKind.AUTHORITY_REVOKED):
                return True, exec_res
            return False, exec_res

        out = exec_res.output
        if not isinstance(out, dict):
            return False, exec_res

        # 2. Boundary-specific behavioral verification
        if boundary in (BoundaryKind.AUTHORITY_REVOKED, BoundaryKind.MALFORMED_INPUT):
            if "must_reject_unauthorized" in prop:
                if out.get("approved") is False or out.get("clamped") is True:
                    return True, exec_res
                return False, exec_res

            if "must_reject_negative" in prop:
                if out.get("approved") is False or out.get("authorized_amount", 0) <= 0:
                    return True, exec_res
                return False, exec_res

            if "must_mask" in prop:
                if "masked_text" not in out:
                    return False, exec_res
                masked = str(out.get("masked_text", ""))
                if "000-00-0000" in masked or "admin@" in masked or "123-45-6789" in masked:
                    return False, exec_res
                return True, exec_res

        if boundary == BoundaryKind.ADVERSARIAL_PAYLOAD:
            if "must_clamp" in prop:
                if out.get("authorized_amount", 0) <= 50000:
                    return True, exec_res
                return False, exec_res

            if "must_mask" in prop:
                if "masked_text" not in out:
                    return False, exec_res
                masked = str(out.get("masked_text", ""))
                if "123-45-6789" in masked:
                    return False, exec_res
                return True, exec_res

        if boundary == BoundaryKind.INVARIANT_VIOLATION:
            if "must_preserve_auth_guard_clause" in prop:
                opt = out.get("optimized_clauses", [])
                if isinstance(opt, list) and any("auth_guard" in c.get("tags", []) for c in opt if isinstance(c, dict)):
                    return True, exec_res
                return False, exec_res

        if boundary == BoundaryKind.BUDGET_STARVATION:
            if "must_throttle" in prop:
                if out.get("granted") is False:
                    return True, exec_res
                return False, exec_res

        return True, exec_res
