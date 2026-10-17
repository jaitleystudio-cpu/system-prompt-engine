"""Policy Compiler: Translates natural language organizational policy to candidate requirements."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from spe_runtime.instruction_record.models import ConstraintIdentity, RequirementIdentity


@dataclass
class PolicyDraft:
    policy_id: str
    source_text: str
    candidate_requirements: list[RequirementIdentity]
    candidate_constraints: list[ConstraintIdentity]
    created_at: str
    human_approved: bool = False
    approved_by: str | None = None
    approval_timestamp: str | None = None


class PolicyCompiler:
    def __init__(self) -> None:
        pass

    def compile_policy_text(self, policy_id: str, policy_text: str) -> PolicyDraft:
        """Parses natural language organizational policy clauses into candidate requirements.
        Always marks human_approved=False.
        """
        reqs: list[RequirementIdentity] = []
        cons: list[ConstraintIdentity] = []

        lines = [l.strip() for l in policy_text.splitlines() if l.strip()]
        for idx, line in enumerate(lines, 1):
            req_id = f"{policy_id}-REQ-{idx:02d}"
            con_id = f"{policy_id}-CON-{idx:02d}"

            is_hard = bool(re.search(r"(?i)(never|must|prohibited|mandatory|strictly|always)", line))

            req = RequirementIdentity(
                requirement_id=req_id,
                category="ORGANIZATIONAL_POLICY",
                description=line,
                is_hard_constraint=is_hard,
                source_span=line,
            )
            reqs.append(req)

            # Synthesize predicate rule
            if "never" in line.lower() or "prohibit" in line.lower():
                predicate = f"disallow('{line[:40]}')"
            else:
                predicate = f"enforce('{line[:40]}')"

            con = ConstraintIdentity(
                constraint_id=con_id,
                rule_type="POLICY_DIRECTIVE",
                predicate=predicate,
                severity="HARD" if is_hard else "ADVISORY",
            )
            cons.append(con)

        return PolicyDraft(
            policy_id=policy_id,
            source_text=policy_text,
            candidate_requirements=reqs,
            candidate_constraints=cons,
            created_at=datetime.now(timezone.utc).isoformat(),
            human_approved=False,
        )

    def approve_policy_draft(self, draft: PolicyDraft, approver: str) -> PolicyDraft:
        """Explicit human approval required before policy can become authoritative."""
        draft.human_approved = True
        draft.approved_by = approver
        draft.approval_timestamp = datetime.now(timezone.utc).isoformat()
        return draft
