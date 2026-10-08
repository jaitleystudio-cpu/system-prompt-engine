"""Data models for SPE Ω Dual-Compiled Counterexample-Closed Supercompiler."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class FalsifierStrategy(str, Enum):
    """Hostile perturbation strategies synthesized from ProtectedIntent."""
    STALE_DATA = "STALE_DATA"
    REVOKED_AUTHORITY = "REVOKED_AUTHORITY"
    TIMEOUT = "TIMEOUT"
    PROMPT_INJECTION = "PROMPT_INJECTION"
    INSTRUCTION_COLLISION = "INSTRUCTION_COLLISION"
    CONCURRENCY_RACE = "CONCURRENCY_RACE"
    BUDGET_EXHAUSTION = "BUDGET_EXHAUSTION"
    SCHEMA_CORRUPTION = "SCHEMA_CORRUPTION"


@dataclass(frozen=True)
class InstructionClause:
    """An individual compiled instruction element within a harness."""
    clause_id: str
    text: str
    intent_source: str
    tags: List[str] = field(default_factory=list)
    is_removable: bool = True


@dataclass(frozen=True)
class ToolContract:
    """Tool specification including runtime preconditions and effect boundaries."""
    tool_name: str
    description: str
    parameters_schema: Dict[str, Any]
    required_capabilities: List[str] = field(default_factory=list)
    pre_conditions: List[str] = field(default_factory=list)
    post_conditions: List[str] = field(default_factory=list)


@dataclass
class ExecutionHarness:
    """The synthesized executable harness (P_exec)."""
    harness_id: str
    clauses: List[InstructionClause]
    tools: List[ToolContract]
    model_target: str
    validators: List[str]
    fallback_routes: Dict[str, str] = field(default_factory=dict)
    deopt_guards: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def compute_digest(self) -> str:
        payload = {
            "harness_id": self.harness_id,
            "clauses": [c.clause_id for c in self.clauses],
            "tools": [t.tool_name for t in self.tools],
            "model_target": self.model_target,
            "validators": self.validators,
            "deopt_guards": self.deopt_guards,
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()

    def token_estimate(self) -> int:
        return sum(len(c.text.split()) * 2 for c in self.clauses) + len(self.validators) * 20


@dataclass(frozen=True)
class Counterexample:
    """A concrete counterexample synthesized to invalidate an execution harness."""
    counterexample_id: str
    strategy: FalsifierStrategy
    violated_invariant: str
    perturbation: Dict[str, Any]
    severity: str = "HIGH"
    reproducer_trace: Optional[str] = None


@dataclass
class AdversarialFalsifier:
    """The synthesized adversarial search program (P_falsify)."""
    falsifier_id: str
    target_invariants: List[str]
    strategies: List[FalsifierStrategy]
    search_budget: int = 100


@dataclass
class DualProgram:
    """Coupled execution and adversarial programs compiled from human intent."""
    intent_id: str
    executor: ExecutionHarness
    falsifier: AdversarialFalsifier
    synthesis_round: int = 0


@dataclass
class CostFrontier:
    """Economic cost characteristics of a compiled harness."""
    estimated_tokens: int
    estimated_cost_usd: float
    model_calls: int
    validator_count: int
    cdi_score: float


@dataclass
class ProofCarryingHarness:
    """Final compiled executable harness carrying its survival certificates."""
    harness: ExecutionHarness
    surviving_adversarial_suite: List[Counterexample]
    passed_invariants: List[str]
    cost_frontier: CostFrontier
    diagnosability_score: float
    canonical_digest: str
