"""Dual Compiler: compiles human intent into coupled Execution and Adversarial programs."""

from __future__ import annotations

import hashlib
import uuid
from typing import Any, Dict, List, Optional

from spe_runtime.supercompiler.models import (
    AdversarialFalsifier,
    DualProgram,
    ExecutionHarness,
    FalsifierStrategy,
    InstructionClause,
    ToolContract,
)


class DualCompiler:
    """Compiles ProtectedIntent specifications into dual (P_exec, P_falsify) programs."""

    def compile(self, intent_spec: Dict[str, Any]) -> DualProgram:
        """Compile a protected intent spec into a coupled DualProgram."""
        intent_id = intent_spec.get("intent_id", f"intent_{uuid.uuid4().hex[:8]}")
        hard_constraints = intent_spec.get("hard_constraints", [])
        tools_spec = intent_spec.get("tools", [])
        model_target = intent_spec.get("model_target", "generic-agent")
        
        # 1. Compile Executor clauses
        clauses: List[InstructionClause] = []
        for i, constraint in enumerate(hard_constraints):
            clause_id = f"clause_{i+1:03d}"
            clauses.append(
                InstructionClause(
                    clause_id=clause_id,
                    text=f"MANDATORY INVARIANT: {constraint}",
                    intent_source=f"{intent_id}/constraint_{i+1}",
                    tags=["safety", "hard_constraint"],
                    is_removable=False,
                )
            )

        # Baseline workflow clause
        task_desc = intent_spec.get("task_description", "Perform autonomous reasoning and action.")
        clauses.append(
            InstructionClause(
                clause_id="clause_task_main",
                text=f"TASK DIRECTIVE: {task_desc}",
                intent_source=f"{intent_id}/task",
                tags=["task_core"],
                is_removable=False,
            )
        )

        # 2. Compile Tool Contracts
        tools: List[ToolContract] = []
        for t in tools_spec:
            tools.append(
                ToolContract(
                    tool_name=t.get("name", "unnamed_tool"),
                    description=t.get("description", ""),
                    parameters_schema=t.get("parameters", {}),
                    required_capabilities=t.get("required_capabilities", []),
                    pre_conditions=t.get("pre_conditions", []),
                    post_conditions=t.get("post_conditions", []),
                )
            )

        # 3. Compile Baseline Validators
        validators: List[str] = [f"verify_{c.replace(' ', '_').lower()[:30]}" for c in hard_constraints]
        if not validators:
            validators.append("verify_output_schema")

        executor = ExecutionHarness(
            harness_id=f"harness_{uuid.uuid4().hex[:8]}",
            clauses=clauses,
            tools=tools,
            model_target=model_target,
            validators=validators,
            fallback_routes={"AUTH_FAIL": "route_to_human_escalation", "TIMEOUT": "route_to_safe_abort"},
            deopt_guards=["schema_version == 1", "network_isolated == True"],
            metadata={"source_intent_id": intent_id},
        )

        # 4. Compile Adversarial Falsifier
        falsifier_strategies = [
            FalsifierStrategy.STALE_DATA,
            FalsifierStrategy.REVOKED_AUTHORITY,
            FalsifierStrategy.TIMEOUT,
            FalsifierStrategy.PROMPT_INJECTION,
            FalsifierStrategy.INSTRUCTION_COLLISION,
            FalsifierStrategy.CONCURRENCY_RACE,
            FalsifierStrategy.BUDGET_EXHAUSTION,
            FalsifierStrategy.SCHEMA_CORRUPTION,
        ]

        falsifier = AdversarialFalsifier(
            falsifier_id=f"falsifier_{uuid.uuid4().hex[:8]}",
            target_invariants=list(hard_constraints),
            strategies=falsifier_strategies,
            search_budget=intent_spec.get("adversarial_budget", 100),
        )

        return DualProgram(
            intent_id=intent_id,
            executor=executor,
            falsifier=falsifier,
            synthesis_round=0,
        )
