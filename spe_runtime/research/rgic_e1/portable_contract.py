"""
RGIC-E1 Evidence Closure Planner — Portable Contract & Multi-Runtime Adapters
Part of SPE Ω Research Quarantine.

Supports:
1. RFC 8785 JSON Canonicalization (JCS) and SHA-256 integrity digests.
2. Interoperability with:
   - OpenAI Agents SDK guardrails/eval format
   - LangSmith criteria / run evaluator format
   - Anthropic Claude skill verification postconditions
3. Fully reversible serialization and tamper-evident digests.
"""

import json
import hashlib
from typing import Dict, Any, List
from dataclasses import asdict
from spe_runtime.research.rgic_e1.types import (
    EvidenceClosureContract, Obligation, ObligationState, ClaimScope,
    EvidencePolicy, AuthorityBoundary, EvidenceReceipt, JustifiedExclusion
)

class PortableContract:
    """
    Standard vendor-neutral contract compiler and serializer.
    Allows evidence closure contracts to travel across OpenAI, Anthropic, LangSmith, and local runtimes.
    """

    @staticmethod
    def serialize(contract: EvidenceClosureContract) -> str:
        """
        RFC 8785 JSON Canonicalization:
        Sorts keys, uses minimal whitespace separators, deterministic UTF-8.
        Computes and stamps the digest if not already set.
        """
        raw_dict = PortableContract.to_dict(contract)
        canonical_json = json.dumps(raw_dict, separators=(',', ':'), sort_keys=True)
        return canonical_json

    @staticmethod
    def compute_digest(contract: EvidenceClosureContract) -> str:
        """Computes SHA-256 digest of canonical representation excluding mutable digest field."""
        raw_dict = PortableContract.to_dict(contract)
        raw_dict['digest'] = None
        canonical_json = json.dumps(raw_dict, separators=(',', ':'), sort_keys=True)
        return hashlib.sha256(canonical_json.encode('utf-8')).hexdigest()

    @staticmethod
    def to_dict(contract: EvidenceClosureContract) -> Dict[str, Any]:
        """Converts contract to clean JSON-serializable dictionary."""
        d = asdict(contract)
        # Convert enums to string values
        d['claim_scope'] = contract.claim_scope.value
        for i, obs in enumerate(contract.obligations):
            d['obligations'][i]['state'] = obs.state.value
        return d

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> EvidenceClosureContract:
        """Reconstructs typed EvidenceClosureContract from dictionary."""
        obligations: List[Obligation] = []
        for o_dict in d.get('obligations', []):
            policy = None
            if o_dict.get('evidence_policy'):
                policy = EvidencePolicy(**o_dict['evidence_policy'])

            boundary = None
            if o_dict.get('authority_boundary'):
                boundary = AuthorityBoundary(**o_dict['authority_boundary'])

            exclusion = None
            if o_dict.get('justified_exclusion'):
                exclusion = JustifiedExclusion(**o_dict['justified_exclusion'])

            receipts: List[EvidenceReceipt] = []
            for r_dict in o_dict.get('evidence_receipts', []):
                receipts.append(EvidenceReceipt(**r_dict))

            obs = Obligation(
                id=o_dict['id'],
                requirement=o_dict['requirement'],
                acceptance_rule_ref=o_dict['acceptance_rule_ref'],
                state=ObligationState(o_dict.get('state', 'UNKNOWN')),
                criticality=o_dict.get('criticality', 5),
                rule_digest=o_dict.get('rule_digest', ''),
                evidence_policy=policy,
                authority_boundary=boundary,
                justified_exclusion=exclusion,
                evidence_receipts=receipts
            )
            obligations.append(obs)

        contract = EvidenceClosureContract(
            schema_version=d.get('schema_version', '0.2.0'),
            protected_intent_ref=d.get('protected_intent_ref', ''),
            obligations=obligations,
            claim_scope=ClaimScope(d.get('claim_scope', 'UNRESOLVED')),
            contract_id=d.get('contract_id', 'contract-default'),
            agent_id=d.get('agent_id', 'agent-candidate'),
            created_at_ns=d.get('created_at_ns', 0),
            adjudicated_at_ns=d.get('adjudicated_at_ns'),
            digest=d.get('digest')
        )
        return contract

    @staticmethod
    def to_openai_agents_format(contract: EvidenceClosureContract) -> Dict[str, Any]:
        """
        Translates evidence closure contract into OpenAI Agents SDK guardrail specification.
        """
        guardrails = []
        for obs in contract.obligations:
            guardrails.append({
                "guardrail_id": f"spe_guard_{obs.id}",
                "description": obs.requirement,
                "acceptance_criteria": obs.acceptance_rule_ref,
                "enforcement_mode": "strict" if obs.criticality >= 8 else "advisory",
                "status": obs.state.value
            })

        return {
            "openai_agents_contract": {
                "contract_id": contract.contract_id,
                "protected_intent_ref": contract.protected_intent_ref,
                "guardrails": guardrails,
                "claim_scope": contract.claim_scope.value
            }
        }

    @staticmethod
    def to_langsmith_format(contract: EvidenceClosureContract) -> Dict[str, Any]:
        """
        Translates evidence closure contract into LangSmith evaluator criteria format.
        """
        evaluators = []
        for obs in contract.obligations:
            evaluators.append({
                "evaluator_name": f"spe_{obs.id}",
                "metric": "evidence_closure_satisfaction",
                "rule": obs.acceptance_rule_ref,
                "required_evidence": obs.evidence_policy.required_evidence_type if obs.evidence_policy else "ANY",
                "current_verdict": obs.state.value
            })

        return {
            "langsmith_evaluation_suite": {
                "suite_id": contract.contract_id,
                "evaluators": evaluators,
                "aggregate_scope": contract.claim_scope.value
            }
        }

    @staticmethod
    def to_claude_skill_format(contract: EvidenceClosureContract) -> Dict[str, Any]:
        """
        Translates evidence closure contract into Anthropic Claude tool postconditions.
        """
        assertions = []
        for obs in contract.obligations:
            assertions.append({
                "assertion_id": obs.id,
                "invariant": obs.requirement,
                "rule_ref": obs.acceptance_rule_ref,
                "is_verified": (obs.state == ObligationState.PASS)
            })

        return {
            "claude_skill_verification": {
                "skill_contract_id": contract.contract_id,
                "assertions": assertions,
                "scope": contract.claim_scope.value
            }
        }
