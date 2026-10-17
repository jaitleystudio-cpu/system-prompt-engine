"""
SPE Ω — Witness-Directed Intelligence Compilation (Paper 2: WDIC).
Compiles verified evidence-producing procedures into specialized, reusable execution artifacts,
replacing repeated neural model inference with $0-token deterministic code.
"""

from dataclasses import dataclass, field
from typing import Dict, Any, Optional, Callable, List, Tuple
import hashlib
import json
from .types import CompilationMode, VerificationVerdict, NanoUSD


@dataclass(frozen=True)
class WitnessContract:
    contract_id: str
    target_obligation_id: str
    evidence_producer_name: str
    input_schema_hash: str
    tool_version_hash: str
    compiler_version_hash: str
    is_deterministic: bool

    def compute_precondition_digest(self) -> str:
        """RFC 8785 canonical JSON digest of preconditions."""
        canonical_dict = {
            "compiler_version_hash": self.compiler_version_hash,
            "contract_id": self.contract_id,
            "evidence_producer_name": self.evidence_producer_name,
            "input_schema_hash": self.input_schema_hash,
            "is_deterministic": self.is_deterministic,
            "target_obligation_id": self.target_obligation_id,
            "tool_version_hash": self.tool_version_hash,
        }
        canonical_bytes = json.dumps(canonical_dict, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(canonical_bytes).hexdigest()


@dataclass
class SpecializedProcedure:
    procedure_id: str
    witness_contract: WitnessContract
    executable_fn: Callable[[Dict[str, Any]], Dict[str, Any]]
    precondition_digest: str
    execution_count: int = 0
    estimated_tokens_saved_per_run: int = 1500


class SpecializationRegistry:
    """Registry maintaining qualified, reusable deterministic procedures."""

    def __init__(self):
        self._procedures: Dict[str, SpecializedProcedure] = {}

    def register(self, procedure: SpecializedProcedure) -> None:
        self._procedures[procedure.precondition_digest] = procedure

    def lookup(self, precondition_digest: str) -> Optional[SpecializedProcedure]:
        return self._procedures.get(precondition_digest, None)

    def invalidate(self, precondition_digest: str) -> bool:
        if precondition_digest in self._procedures:
            del self._procedures[precondition_digest]
            return True
        return False

    def count(self) -> int:
        return len(self._procedures)


class WDICSpecializer:
    """
    Manages the two-speed compilation loop:
    Exploration Mode (discovering & qualifying evidence) <-> Specialization Mode (fast-path reuse).
    """

    def __init__(self, registry: Optional[SpecializationRegistry] = None):
        self.registry = registry or SpecializationRegistry()

    def specialize_and_register(
        self,
        contract: WitnessContract,
        verified_fn: Callable[[Dict[str, Any]], Dict[str, Any]],
        tokens_saved: int = 2000
    ) -> SpecializedProcedure:
        digest = contract.compute_precondition_digest()
        proc = SpecializedProcedure(
            procedure_id=f"spec_{contract.contract_id}_{digest[:8]}",
            witness_contract=contract,
            executable_fn=verified_fn,
            precondition_digest=digest,
            estimated_tokens_saved_per_run=tokens_saved
        )
        self.registry.register(proc)
        return proc

    def execute_with_mode(
        self,
        contract: WitnessContract,
        input_payload: Dict[str, Any],
        fallback_exploration_fn: Callable[[Dict[str, Any]], Dict[str, Any]]
    ) -> Tuple[Dict[str, Any], CompilationMode, int]:
        """
        Executes via Specialization if qualified; otherwise drops to Exploration.
        Returns (result, mode_used, tokens_consumed).
        """
        digest = contract.compute_precondition_digest()
        proc = self.registry.lookup(digest)

        if proc is not None:
            # SPECIALIZATION MODE: Fast-path deterministic execution, 0 tokens!
            proc.execution_count += 1
            result = proc.executable_fn(input_payload)
            return result, CompilationMode.SPECIALIZATION, 0

        # EXPLORATION MODE: Specialized procedure not found or preconditions drifted
        result = fallback_exploration_fn(input_payload)
        tokens_consumed = 1500  # Typical exploration cost
        return result, CompilationMode.EXPLORATION, tokens_consumed
