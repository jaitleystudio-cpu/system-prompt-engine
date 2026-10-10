"""Level 5: Autonomous Open-Ended Discovery & Self-Directing Ontology Engine Models.

Defines the core data contracts for open-ended hypothesis formulation,
falsification worlds, dialectical duels, discovered axioms, and MAP-Elites archives.
"""

from __future__ import annotations

import hashlib
import json
import time
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class BoundaryKind(str, Enum):
    AUTHORITY_REVOKED = "AUTHORITY_REVOKED"
    BUDGET_STARVATION = "BUDGET_STARVATION"
    MALFORMED_INPUT = "MALFORMED_INPUT"
    ADVERSARIAL_PAYLOAD = "ADVERSARIAL_PAYLOAD"
    STOCHASTIC_DRIFT = "STOCHASTIC_DRIFT"
    INVARIANT_VIOLATION = "INVARIANT_VIOLATION"


class HypothesisStatus(str, Enum):
    CONJECTURE = "CONJECTURE"
    DUELING = "DUELING"
    FALSIFIED = "FALSIFIED"
    SURVIVED = "SURVIVED"
    GRADUATED_AXIOM = "GRADUATED_AXIOM"


@dataclass
class DiscoveryHypothesis:
    """An autonomously formulated capability conjecture generated without human prompts."""
    hypothesis_id: str
    domain: str
    conjecture: str
    synthesized_procedure: Dict[str, Any]
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    invariants: List[str]
    generation: int = 0
    status: HypothesisStatus = HypothesisStatus.CONJECTURE
    created_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))

    def compute_digest(self) -> str:
        payload = {
            "hypothesis_id": self.hypothesis_id,
            "domain": self.domain,
            "conjecture": self.conjecture,
            "synthesized_procedure": self.synthesized_procedure,
            "invariants": sorted(self.invariants),
        }
        return hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()


@dataclass
class FalsificationWorld:
    """An adversarial test environment synthesized to actively falsify a hypothesis."""
    world_id: str
    boundary_kind: BoundaryKind
    fixture_input: Dict[str, Any]
    expected_safety_property: str
    falsification_probe_score: float = 1.0


@dataclass
class DialecticalDuelReceipt:
    """Cryptographic certificate recording the adversarial duel between Proposer and Falsifier."""
    duel_id: str
    hypothesis_id: str
    proposer_strategy: str
    falsifier_strategy: str
    counter_worlds_tested: int
    survived_worlds: int
    falsified: bool
    wald_sprt_lcb95: float
    proof_hash: str
    timestamp: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


@dataclass
class DiscoveredAxiom:
    """A proven invariant or procedure that survived all adversarial counter-worlds."""
    axiom_id: str
    statement: str
    domain: str
    formal_contract: Dict[str, Any]
    witness_receipt_hash: str
    capsule_id: Optional[str] = None
    promoted_at: str = field(default_factory=lambda: time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))


@dataclass
class EliteRecord:
    """An elite capability stored in the Quality-Diversity (MAP-Elites) archive."""
    cell_coordinates: tuple[int, int, int]
    hypothesis: DiscoveryHypothesis
    fitness_score: float
    reasoning_complexity: float
    token_sparsity: float
    domain_generality: int
    duel_receipt: DialecticalDuelReceipt
