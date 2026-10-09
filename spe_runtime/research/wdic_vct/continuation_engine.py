"""
WDIC-VCT — Continuation Engine: Automated Report Reviewer & Next-Task Compiler.
Part of SPE Ω Research Quarantine.

Core Capabilities:
1. Ingests raw agent reports (Gilden, Cursor, Claude Code, SWE-bench).
2. Deterministic Tier 0 claim-by-claim audit ($0, 0 tokens).
3. Anti-Omission check (catches unverified requirements despite passing tests).
4. Computes Proof Deficit and compiles the 6-clause Next Task Contract.
5. Tracks exact integer NanoUSD costs and token savings.
"""

import re
from typing import List, Dict, Any, Optional, Set
from spe_runtime.research.wdic_vct.types import (
    ClaimStatus,
    TaskClaim,
    TaskReport,
    ProofDeficit,
    NextTaskContract,
    ReviewSummary,
)


class WDICContinuationEngine:
    """
    Automated zero-subscription task-report review and continuation engine.
    """

    def __init__(self):
        pass

    def parse_report_text(self, raw_text: str, task_id: str = "task-001") -> TaskReport:
        """
        Extracts structured signals from agent output text using deterministic regex.
        """
        # Parse tests: e.g. "126 passed, 0 failed, 3 skipped" or "TESTS: 126 passed. 3 skipped. 0 failed."
        passed = 0
        failed = 0
        skipped = 0

        p_match = re.search(r"(\d+)\s+(?:passed|passing)", raw_text, re.IGNORECASE) or re.search(r"(?:passed|passing)\s*[:=]\s*(\d+)", raw_text, re.IGNORECASE)
        if p_match:
            passed = int(p_match.group(1))

        f_match = (
            re.search(r"(\d+)\s+(?:failed|failing)", raw_text, re.IGNORECASE)
            or re.search(r"(?:failed|failing)\s*[:=]\s*(\d+)", raw_text, re.IGNORECASE)
            or re.search(r"(?:failures|errors)\s*=\s*(\d+)", raw_text, re.IGNORECASE)
        )
        if f_match:
            failed = int(f_match.group(1))

        s_match = re.search(r"(\d+)\s+(?:skipped|ignored)", raw_text, re.IGNORECASE) or re.search(r"(?:skipped|ignored)\s*[:=]\s*(\d+)", raw_text, re.IGNORECASE)
        if s_match:
            skipped = int(s_match.group(1))

        # Parse exit code if present
        exit_code = 0
        exit_match = re.search(r"exit[ _-]?code\s*[:=]\s*(\d+)", raw_text, re.IGNORECASE)
        if exit_match:
            exit_code = int(exit_match.group(1))

        # Parse files modified: e.g. inline "FILES: session.py recovery.py" or multi-line / bulleted
        files: List[str] = []
        files_section_match = re.search(
            r"(?:FILES|FILES MODIFIED|CHANGED FILES|MODIFIED FILES):\s*([^\n]*(?:\n[ \t]*[-*•]?[ \t]*[^\n]+)*)",
            raw_text,
            re.IGNORECASE,
        )
        if files_section_match:
            raw_section = files_section_match.group(1)
            for line in raw_section.splitlines():
                line = line.strip()
                if not line:
                    continue
                # Stop if encountering another standard section header
                if re.match(r"^(?:TESTS|RESULT|COMMIT|SHA|R-\d+|COMMAND|EXIT|OBJECTIVE|SCOPE|ACCEPTANCE):", line, re.IGNORECASE):
                    break
                line = re.sub(r"^[-*•]\s*", "", line)
                tokens = [t.strip(",; ") for t in line.split() if t.strip(",; ")]
                for tok in tokens:
                    if tok not in ["-", "*", "•"] and not tok.startswith("-"):
                        files.append(tok)

        # Parse commit SHA if present
        commit_sha = ""
        commit_match = re.search(r"(?:COMMIT|SHA):\s*([a-f0-9]{7,40})", raw_text, re.IGNORECASE)
        if commit_match:
            commit_sha = commit_match.group(1)

        # Summary line
        summary = "Agent task execution report"
        res_match = re.search(r"RESULT:\s*([^\n]+)", raw_text, re.IGNORECASE)
        if res_match:
            summary = res_match.group(1).strip()

        return TaskReport(
            task_id=task_id,
            summary=summary,
            files_modified=files,
            tests_passed=passed,
            tests_failed=failed,
            tests_skipped=skipped,
            exit_code=exit_code,
            commit_sha=commit_sha,
            raw_text=raw_text
        )

    def audit_report_claims(
        self,
        report: TaskReport,
        required_requirements: List[str],
        prohibited_files: Optional[List[str]] = None
    ) -> List[TaskClaim]:
        """
        Audits claims claim-by-claim against frozen requirements.
        Enforces Anti-Omission Law: A requirement is UNVERIFIED unless
        explicit test evidence or assertions for it exist in the report.
        """
        claims: List[TaskClaim] = []
        prohibited_set = set(prohibited_files or [])

        # Check prohibited files violation
        for f in report.files_modified:
            if f in prohibited_set:
                claims.append(TaskClaim(
                    id=f"claim-prohibited-{f}",
                    requirement_id="SCOPE_SECURITY",
                    description=f"Agent illegally modified prohibited file: {f}",
                    status=ClaimStatus.CONTRADICTED,
                    evidence_details="Scope boundary violation"
                ))

        # If tests failed or exit code is non-zero, record contradiction
        if report.tests_failed > 0 or getattr(report, "exit_code", 0) != 0:
            claims.append(TaskClaim(
                id="claim-tests-failed",
                requirement_id="TEST_REGRESSION",
                description=f"{report.tests_failed} tests failed (exit code {getattr(report, 'exit_code', 0)}) in execution",
                status=ClaimStatus.CONTRADICTED,
                evidence_details="Failing test execution receipt"
            ))

        # Audit each required requirement
        for req in required_requirements:
            # Check if report raw text explicitly mentions this requirement
            # and provides verification evidence
            pattern = re.escape(req)
            is_mentioned = bool(re.search(pattern, report.raw_text, re.IGNORECASE))

            # Does it have an explicit verified tag or dedicated test?
            has_explicit_test = bool(
                re.search(rf"{pattern}.*?(?:passed|verified|covered|asserted)", report.raw_text, re.IGNORECASE)
            )

            if is_mentioned and has_explicit_test and report.tests_failed == 0 and getattr(report, "exit_code", 0) == 0:
                claims.append(TaskClaim(
                    id=f"claim-{req}",
                    requirement_id=req,
                    description=f"Requirement {req} tested and verified",
                    status=ClaimStatus.VERIFIED,
                    evidence_details=f"Explicitly verified in test run ({report.tests_passed} passed)"
                ))
            else:
                # Anti-Omission: Even if 126 tests passed, if req was not tested, it is UNVERIFIED!
                claims.append(TaskClaim(
                    id=f"claim-{req}",
                    requirement_id=req,
                    description=f"Requirement {req} has no admissible verification evidence in report",
                    status=ClaimStatus.UNVERIFIED,
                    evidence_details="Omission: No matching test receipt found in report"
                ))

        return claims

    def compute_proof_deficit(
        self,
        claims: List[TaskClaim],
        required_requirements: List[str]
    ) -> ProofDeficit:
        """
        Calculates the proof deficit: requirements that are unverified or contradicted.
        """
        verified_reqs = {c.requirement_id for c in claims if c.status == ClaimStatus.VERIFIED}
        contradicted_reqs = [c.requirement_id for c in claims if c.status == ClaimStatus.CONTRADICTED]

        open_reqs = [r for r in required_requirements if r not in verified_reqs]

        return ProofDeficit(
            open_requirements=open_reqs,
            contradicted_requirements=contradicted_reqs,
            deficit_count=len(open_reqs) + len(contradicted_reqs)
        )

    def compile_next_task_contract(
        self,
        deficit: ProofDeficit,
        baseline_ref: str,
        allowed_files: Optional[List[str]] = None,
        prohibited_files: Optional[List[str]] = None
    ) -> Optional[NextTaskContract]:
        """
        Compiles the 6-clause Next Task Contract from the proof deficit.
        """
        if deficit.deficit_count == 0:
            return None  # All requirements qualified!

        allowed = allowed_files or ["session.py", "recovery.py", "test_recovery.py"]
        prohibited = prohibited_files or [".env", "config/production.json"]

        # Case 1: Contradictions take immediate priority
        if deficit.contradicted_requirements:
            target_req = deficit.contradicted_requirements[0]
            return NextTaskContract(
                task_title=f"Repair Contradiction: {target_req}",
                baseline_ref=baseline_ref,
                objective=f"Fix regression or violation affecting requirement '{target_req}'.",
                allowed_files=allowed,
                prohibited_files=prohibited,
                execution_steps=[
                    f"Inspect failure trace for {target_req}.",
                    "Revert or repair any invalid changes.",
                    "Execute regression test suite to confirm zero failures."
                ],
                acceptance_criteria=f"Zero failing tests; full conformance to {target_req}.",
                stop_boundaries=[
                    "Do NOT modify unrelated files.",
                    "Do NOT deploy or claim release completion."
                ],
                tier_used="T0_DETERMINISTIC",
                cost_nano_usd=0,
                saved_tokens=4500
            )

        # Case 2: Open unverified requirement
        target_req = deficit.open_requirements[0]
        return NextTaskContract(
            task_title=f"Verify Unfulfilled Requirement: {target_req}",
            baseline_ref=baseline_ref,
            objective=f"Establish proof for requirement '{target_req}' with focused regression test.",
            allowed_files=allowed,
            prohibited_files=prohibited,
            execution_steps=[
                f"Inspect current implementation relevant to {target_req}.",
                f"Add focused test case validating {target_req}.",
                f"Execute targeted test runner.",
                "If defect confirmed, apply minimal authorized repair.",
                "Re-run full verification battery."
            ],
            acceptance_criteria=f"Admissible test receipt proving {target_req}; exit code 0.",
            stop_boundaries=[
                "Do NOT refactor unrelated modules.",
                "Do NOT weaken or delete existing tests.",
                "Do NOT claim release qualification."
            ],
            tier_used="T0_DETERMINISTIC",
            cost_nano_usd=0,
            saved_tokens=4200
        )

    def review_and_continue(
        self,
        raw_report: str,
        required_requirements: List[str],
        current_commit: str = "main-HEAD",
        prohibited_files: Optional[List[str]] = None
    ) -> ReviewSummary:
        """
        Full 4-tier pipeline: Ingests report, audits claims, computes deficit,
        and compiles the next task contract at $0.00 cost.
        """
        report = self.parse_report_text(raw_report)
        claims = self.audit_report_claims(report, required_requirements, prohibited_files)
        deficit = self.compute_proof_deficit(claims, required_requirements)
        next_contract = self.compile_next_task_contract(deficit, baseline_ref=current_commit)

        verified_count = sum(1 for c in claims if c.status == ClaimStatus.VERIFIED)
        unverified_count = len(deficit.open_requirements)
        contradicted_count = len(deficit.contradicted_requirements)

        if contradicted_count > 0:
            verdict = "BLOCKED_CONTRADICTION"
        elif unverified_count > 0:
            verdict = "DEFICIT_DETECTED"
        else:
            verdict = "QUALIFIED"

        # Economic savings calculation:
        # A typical ChatGPT Pro conversation reviewing a report and generating next steps
        # consumes ~4,000 tokens ($0.03 to $0.12 depending on model).
        saved_tokens = 4200 if next_contract else 2000
        saved_usd = (saved_tokens / 1000.0) * 0.015

        return ReviewSummary(
            total_requirements=len(required_requirements),
            verified_count=verified_count,
            unverified_count=unverified_count,
            contradicted_count=contradicted_count,
            verdict=verdict,
            deficit=deficit,
            next_contract=next_contract,
            tier_used="T0_DETERMINISTIC",
            cost_nano_usd=0,
            estimated_savings_tokens=saved_tokens,
            estimated_savings_usd=round(saved_usd, 4)
        )
