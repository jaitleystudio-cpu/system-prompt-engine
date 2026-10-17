"""
SPE Ω — CEC Cross-Model & Multi-Agent Handoff Protocol.
Implements secure delegation generation, transition witness construction,
and cryptographic Ed25519 verification.
"""

import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Set, Optional, Tuple

from spe_runtime.ci_gate.receipt import (
    generate_keypair,
    ed25519_sign,
    ed25519_verify,
)
from .types import (
    ConservedContract,
    ObligationRecord,
    TransitionWitness,
    InformationLabel,
)
from .transition_validator import TransitionValidator


class HandoffProtocol:
    """Orchestrates compliant contract transformations and cryptographic attestation."""

    @staticmethod
    def delegate_task(
        parent: ConservedContract,
        child_agent_id: str,
        delegated_obligation_ids: Set[str],
        delegated_authorities: Set[str],
        signing_key: bytes,
        public_key: bytes,
    ) -> Tuple[ConservedContract, TransitionWitness]:
        """
        Creates an attenuated child contract with verified obligation partition.
        """
        # Ensure authority attenuation: A_child ⊆ A_parent
        attenuated_auth = delegated_authorities.intersection(parent.permitted_authorities)

        # Partition obligations: O_parent = O_delegated ∪ O_retained
        delegated_obs: Dict[str, ObligationRecord] = {}
        retained_ids: List[str] = []

        for oid, ob in parent.obligations.items():
            if oid in delegated_obligation_ids:
                # Assign to child agent
                delegated_obs[oid] = ObligationRecord(
                    obligation_id=ob.obligation_id,
                    requirement_ref=ob.requirement_ref,
                    predicate_spec=ob.predicate_spec,
                    disposition=ob.disposition,
                    assigned_agent_id=child_agent_id,
                    witness_receipt_ref=ob.witness_receipt_ref,
                    is_mandatory=ob.is_mandatory,
                )
            else:
                retained_ids.append(oid)

        child_contract_id = f"contract-{uuid.uuid4().hex[:12]}"
        child = ConservedContract(
            contract_id=child_contract_id,
            protected_intent_ref=parent.protected_intent_ref,
            root_commitment=parent.root_commitment,
            obligations=delegated_obs,
            permitted_authorities=attenuated_auth,
            information_label=parent.information_label,
            environment_fingerprint=parent.environment_fingerprint,
            parent_contract_id=parent.contract_id,
            delegation_depth=parent.delegation_depth + 1,
            schema_version=parent.schema_version,
        )

        # Construct transition witness
        witness_id = f"wit-{uuid.uuid4().hex[:12]}"
        witness_payload = f"{parent.contract_id}->{child.contract_id}:{parent.canonical_hash()}->{child.canonical_hash()}"
        sig = ed25519_sign(signing_key, public_key, witness_payload.encode("utf-8")).hex()

        witness = TransitionWitness(
            witness_id=witness_id,
            source_contract_id=parent.contract_id,
            target_contract_id=child.contract_id,
            source_hash=parent.canonical_hash(),
            target_hash=child.canonical_hash(),
            transition_type="DELEGATION",
            issuer_agent_id="parent_orchestrator",
            signature=sig,
            timestamp_iso=datetime.now(timezone.utc).isoformat(),
            reconciliation_details={
                "retained_obligations": retained_ids,
                "child_agent_id": child_agent_id,
            },
        )

        child.transition_witness_ref = witness.witness_id
        return child, witness

    @staticmethod
    def verify_witness_signature(
        witness: TransitionWitness,
        public_key: bytes,
    ) -> bool:
        """Verifies Ed25519 cryptographic signature of a transition witness."""
        if not witness.signature:
            return False
        witness_payload = f"{witness.source_contract_id}->{witness.target_contract_id}:{witness.source_hash}->{witness.target_hash}"
        try:
            sig_bytes = bytes.fromhex(witness.signature)
            return ed25519_verify(public_key, witness_payload.encode("utf-8"), sig_bytes)
        except Exception:
            return False
