"""
SPE Ω — Counterfactual Specification Closure (CSC) Feedback Governor.
Mechanism D: Real-World Feedback Without Semantic Drift.
Governs candidate obligation proposals generated from empirical failures.
Enforces strict human authority before modifying Protected Intent or promote formal obligations.
"""

from __future__ import annotations

import hashlib
from typing import Dict, Any, List, Optional, Tuple

from .models import CandidateObligationProposal


class FeedbackGovernor:
    """
    Mechanism D: Real-World Feedback Governor (Anti-Semantic Drift).
    Ensures that empirical failures propose candidate obligations to the user,
    while strictly preventing unilateral AI rewriting of Protected Intent.
    """

    def __init__(self, valid_human_tokens: Optional[List[str]] = None):
        self._proposals: Dict[str, CandidateObligationProposal] = {}
        self.valid_human_tokens = set(valid_human_tokens or [])

    def propose_candidate_obligation(
        self,
        target_intent_ref: str,
        proposed_requirement: str,
        rationale: str,
        evidence_source_ref: str,
        proposal_id: Optional[str] = None,
    ) -> CandidateObligationProposal:
        """
        Proposes a new candidate obligation from a reality gap or counterexample.
        Status is initially PENDING_AUTHORIZATION.
        """
        pid = proposal_id or f"prop_{hashlib.sha256(f'{target_intent_ref}:{proposed_requirement}'.encode('utf-8')).hexdigest()[:10]}"
        proposal = CandidateObligationProposal(
            proposal_id=pid,
            target_intent_ref=target_intent_ref,
            proposed_requirement=proposed_requirement,
            rationale=rationale,
            evidence_source_ref=evidence_source_ref,
            status="PENDING_AUTHORIZATION",
        )
        self._proposals[pid] = proposal
        return proposal

    def adopt_candidate_obligation(
        self,
        proposal_id: str,
        auth_token: str,
        formal_obligation_ref: Optional[str] = None,
    ) -> Tuple[bool, Optional[CandidateObligationProposal], Optional[str]]:
        """
        Adopts a candidate obligation into the formal specification.
        Requires explicit human authorization token.
        Rejects unilateral AI agent mutations to prevent semantic drift.
        """
        proposal = self._proposals.get(proposal_id)
        if proposal is None:
            return False, None, f"Proposal '{proposal_id}' not found."

        if proposal.status == "APPROVED":
            return True, proposal, "Proposal already approved."

        if not auth_token or auth_token not in self.valid_human_tokens:
            return (
                False,
                None,
                "Unilateral intent modification prohibited: human authorization token invalid or missing (Anti-Semantic Drift).",
            )

        promoted_ref = formal_obligation_ref or f"ob_promoted_{proposal.proposal_id}"
        approved = CandidateObligationProposal(
            proposal_id=proposal.proposal_id,
            target_intent_ref=proposal.target_intent_ref,
            proposed_requirement=proposal.proposed_requirement,
            rationale=proposal.rationale,
            evidence_source_ref=proposal.evidence_source_ref,
            status="APPROVED",
            authorized_by=auth_token,
            promoted_obligation_ref=promoted_ref,
        )
        self._proposals[proposal_id] = approved
        return True, approved, None

    def reject_candidate_obligation(
        self,
        proposal_id: str,
        reason: str,
    ) -> Optional[CandidateObligationProposal]:
        """Marks a candidate obligation as rejected by human review."""
        proposal = self._proposals.get(proposal_id)
        if proposal is None:
            return None

        rejected = CandidateObligationProposal(
            proposal_id=proposal.proposal_id,
            target_intent_ref=proposal.target_intent_ref,
            proposed_requirement=proposal.proposed_requirement,
            rationale=proposal.rationale,
            evidence_source_ref=proposal.evidence_source_ref,
            status="REJECTED",
            rejection_reason=reason,
        )
        self._proposals[proposal_id] = rejected
        return rejected

    def get_proposal(self, proposal_id: str) -> Optional[CandidateObligationProposal]:
        return self._proposals.get(proposal_id)

    def list_pending(self) -> List[CandidateObligationProposal]:
        return [p for p in self._proposals.values() if p.status == "PENDING_AUTHORIZATION"]

    def list_approved(self) -> List[CandidateObligationProposal]:
        return [p for p in self._proposals.values() if p.status == "APPROVED"]
