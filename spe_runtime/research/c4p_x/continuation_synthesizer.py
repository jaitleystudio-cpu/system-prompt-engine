"""
SPE Ω — C4P-X+ Proof-Carrying Semantic Continuation (PCSC) Synthesizer.
Computes the Minimum Sufficient Continuation Cut C* <= Sigma.
"""
from typing import Dict, Set, Any, Tuple
import json

from .state_ledger import ExecutionStateSigma, RecordedFact
from .kernel_repaired import EvidenceStatus

class ContinuationSynthesizer:
    @staticmethod
    def _is_well_founded(fact: RecordedFact, all_facts: Dict[str, RecordedFact], visited: Set[str] = None) -> bool:
        """Recursively checks that fact has well-founded dependency closure and no cycles."""
        if visited is None:
            visited = set()
        if fact.fact_id in visited:
            return False  # Circular dependency
        visited.add(fact.fact_id)
        for dep_id in fact.dependencies:
            if dep_id not in all_facts:
                return False
            if not ContinuationSynthesizer._is_well_founded(all_facts[dep_id], all_facts, visited.copy()):
                return False
        return True

    @classmethod
    def synthesize_continuation_cut(
        cls,
        sigma: ExecutionStateSigma,
        destination_model_version: str,
        destination_capabilities: Set[str],
    ) -> Tuple[Dict[str, Any], int, float]:
        """
        Synthesizes the minimum sufficient continuation cut C* <= Sigma.
        Returns:
            cut: Dictionary representing the continuation package C*
            transferred_tokens: Estimated token count of the continuation package
            compression_ratio: Raw tokens / transferred tokens (CCR)
        """
        preserved_facts: Dict[str, Dict[str, Any]] = {}

        for fact_id, fact in sigma.facts.items():
            # Check dependency closure
            if not cls._is_well_founded(fact, sigma.facts):
                continue  # Discard orphan or broken fact

            if fact.is_deterministic or fact.evidence_status == EvidenceStatus.FORMALLY_SUFFICIENT:
                # Deterministic or formally proven facts are transferred as VERIFIED_REUSABLE
                preserved_facts[fact.key] = {
                    "fact_id": fact.fact_id,
                    "value": fact.value,
                    "digest": fact.digest,
                    "status": "VERIFIED_REUSABLE",
                }
            elif fact.evidence_status == EvidenceStatus.EMPIRICALLY_QUALIFIED and not fact.is_deterministic:
                # Untrusted neural model output transferred strictly as UNVERIFIED_CANDIDATE_HYPOTHESIS
                preserved_facts[fact.key] = {
                    "fact_id": fact.fact_id,
                    "value": fact.value,
                    "digest": fact.digest,
                    "status": "UNVERIFIED_CANDIDATE_HYPOTHESIS",
                    "provenance_model": fact.source_model_version,
                }
            elif fact.evidence_status == EvidenceStatus.EMPIRICALLY_QUALIFIED and fact.is_deterministic:
                preserved_facts[fact.key] = {
                    "fact_id": fact.fact_id,
                    "value": fact.value,
                    "digest": fact.digest,
                    "status": "EMPIRICALLY_QUALIFIED",
                }

        cut = {
            "continuation_cut_id": f"cut_{destination_model_version}",
            "destination_model": destination_model_version,
            "preserved_facts": preserved_facts,
            "unfulfilled_obligations": sorted(list(sigma.unfulfilled_obligations)),
        }

        # Token estimation heuristic (RFC 8785 JSON representation / 4)
        serialized_cut = json.dumps(cut, sort_keys=True, separators=(",", ":"), default=str)
        transferred_tokens = max(1, len(serialized_cut) // 4)

        raw_tokens = max(transferred_tokens, sigma.total_raw_transcript_tokens)
        compression_ratio = round(raw_tokens / transferred_tokens, 2)

        return cut, transferred_tokens, compression_ratio
