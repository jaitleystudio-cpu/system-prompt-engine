"""SPE Ω — Independent Repair Tournament (IRT) Python Runtime
Crown Breakthrough Capability #2

Epistemic Grounding:
- Detect–Repair–Verify for LLM-Generated Code (2026, arXiv:2603.23633)
- Do LLMs Generate Useful Test Oracles? (ASE 2025)
- When Agent Evaluation Becomes Unreliable (2026, arXiv:2610.16067)
- SWE-bench Goes Live! (NeurIPS 2025)
"""

from __future__ import annotations
import hashlib
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Set, Callable, Dict, Any


@dataclass
class CandidatePatchPy:
    candidate_id: str
    author_agent_id: str
    target_file: str
    original_chunk: str
    replacement_chunk: str
    line_count_diff: int
    explanation: str


@dataclass
class OracleTestCasePy:
    name: str
    is_acceptance: bool
    run: Callable[[str], bool]


@dataclass
class FrozenTestOraclePy:
    test_file: str
    oracle_sha256: str
    test_cases: List[OracleTestCasePy] = field(default_factory=list)


@dataclass
class CandidateEvaluationResultPy:
    candidate_id: str
    acceptance_passed: bool
    regression_passed: bool
    oracle_tampering_detected: bool
    oscillation_detected: bool
    mutants_generated: int
    mutants_killed: int
    mutation_kill_rate: float
    blast_radius_score: float
    overall_score: float
    disqualified_reason: Optional[str] = None


@dataclass
class TournamentResultPy:
    tournament_id: str
    defect_category: str
    timestamp: str
    candidates_evaluated: int
    winner_candidate_id: Optional[str]
    disposition: str  # "WINNER_QUALIFIED", "REJECT_BOTH_INSUFFICIENT_EVIDENCE", "ALL_DISQUALIFIED"
    winning_patch: Optional[CandidatePatchPy]
    candidate_evaluations: List[CandidateEvaluationResultPy]
    reason: str
    tournament_receipt_digest: str


class IndependentRepairTournamentPy:
    """Evaluates competing code repairs against frozen independent test oracles."""

    def __init__(self, max_allowed_diff_lines: int = 50, min_mutation_kill_rate: float = 0.80) -> None:
        self.max_allowed_diff_lines = max_allowed_diff_lines
        self.min_mutation_kill_rate = min_mutation_kill_rate
        self.recent_patch_hashes: Set[str] = set()

    def conduct_tournament(
        self,
        defect_category: str,
        target_file_original_content: str,
        candidates: List[CandidatePatchPy],
        frozen_oracle: FrozenTestOraclePy,
        historical_patch_digests: Optional[List[str]] = None,
    ) -> TournamentResultPy:
        tournament_id = f"irt-py-{int(time.time()):x}"
        now = datetime.now(timezone.utc).isoformat()

        if historical_patch_digests:
            for h in historical_patch_digests:
                self.recent_patch_hashes.add(h)

        evaluations: List[CandidateEvaluationResultPy] = []
        for candidate in candidates:
            ev = self._evaluate_candidate(
                candidate, target_file_original_content, frozen_oracle
            )
            evaluations.append(ev)

        qualified = [
            e
            for e in evaluations
            if not e.oracle_tampering_detected
            and not e.oscillation_detected
            and e.acceptance_passed
            and e.regression_passed
            and e.mutation_kill_rate >= self.min_mutation_kill_rate
            and e.overall_score >= 75.0
        ]

        qualified.sort(key=lambda x: x.overall_score, reverse=True)

        winner_id: Optional[str] = None
        winning_patch: Optional[CandidatePatchPy] = None
        disposition = "REJECT_BOTH_INSUFFICIENT_EVIDENCE"
        reason = "Neither candidate satisfied all independent verification gates and mutation hurdles."

        if qualified:
            winner_id = qualified[0].candidate_id
            winning_patch = next(
                (c for c in candidates if c.candidate_id == winner_id), None
            )
            disposition = "WINNER_QUALIFIED"
            reason = (
                f"Candidate {winner_id} won with score {qualified[0].overall_score:.1f}/100, "
                f"mutation kill rate {qualified[0].mutation_kill_rate * 100:.0f}%, and zero test tampering."
            )
            if winning_patch:
                self.recent_patch_hashes.add(
                    self._hash_str(winning_patch.replacement_chunk)
                )
        elif all(e.oracle_tampering_detected or e.oscillation_detected for e in evaluations):
            disposition = "ALL_DISQUALIFIED"
            reason = "All candidates disqualified due to test tampering or repair oscillation."

        receipt_digest = self._hash_str(
            f"{tournament_id}:{defect_category}:{winner_id}:{disposition}"
        )

        return TournamentResultPy(
            tournament_id=tournament_id,
            defect_category=defect_category,
            timestamp=now,
            candidates_evaluated=len(candidates),
            winner_candidate_id=winner_id,
            disposition=disposition,
            winning_patch=winning_patch,
            candidate_evaluations=evaluations,
            reason=reason,
            tournament_receipt_digest=receipt_digest,
        )

    def _evaluate_candidate(
        self,
        candidate: CandidatePatchPy,
        original_content: str,
        oracle: FrozenTestOraclePy,
    ) -> CandidateEvaluationResultPy:
        # Check tampering
        has_tamper = (
            re.search(r"(?:^|[\s;])def\s+test_", candidate.replacement_chunk) is not None
            or re.search(r"\bassert\s+", candidate.replacement_chunk) is not None
        )
        if candidate.target_file == oracle.test_file or has_tamper:
            return CandidateEvaluationResultPy(
                candidate_id=candidate.candidate_id,
                acceptance_passed=False,
                regression_passed=False,
                oracle_tampering_detected=True,
                oscillation_detected=False,
                mutants_generated=0,
                mutants_killed=0,
                mutation_kill_rate=0.0,
                blast_radius_score=0.0,
                overall_score=0.0,
                disqualified_reason="ORACLE_TAMPERING_DETECTED: Patch modified test oracle.",
            )

        # Check oscillation
        p_hash = self._hash_str(candidate.replacement_chunk)
        if p_hash in self.recent_patch_hashes:
            return CandidateEvaluationResultPy(
                candidate_id=candidate.candidate_id,
                acceptance_passed=False,
                regression_passed=False,
                oracle_tampering_detected=False,
                oscillation_detected=True,
                mutants_generated=0,
                mutants_killed=0,
                mutation_kill_rate=0.0,
                blast_radius_score=0.0,
                overall_score=0.0,
                disqualified_reason="REPAIR_OSCILLATION_DETECTED: Patch identical to a previously rejected cycle.",
            )

        # Apply patch (replace single targeted occurrence)
        if candidate.original_chunk in original_content:
            patched = original_content.replace(
                candidate.original_chunk, candidate.replacement_chunk, 1
            )
        else:
            patched = original_content + "\n" + candidate.replacement_chunk

        # Run oracle tests
        acceptance_passed = True
        regression_passed = True
        for tc in oracle.test_cases:
            res = tc.run(patched)
            if tc.is_acceptance and not res:
                acceptance_passed = False
            if not tc.is_acceptance and not res:
                regression_passed = False

        # Mutation battery
        mutants = self._generate_mutants(patched, candidate.replacement_chunk)
        mutants_killed = 0
        for m in mutants:
            survived = True
            for tc in oracle.test_cases:
                if not tc.run(m):
                    survived = False
                    break
            if not survived:
                mutants_killed += 1

        kill_rate = mutants_killed / len(mutants) if mutants else 1.0

        # Blast radius
        diff_lines = max(1, candidate.line_count_diff)
        blast_score = (
            0.0
            if diff_lines > self.max_allowed_diff_lines
            else max(0.1, 1.0 - diff_lines / self.max_allowed_diff_lines)
        )

        overall = 0.0
        if acceptance_passed and regression_passed:
            overall = 40.0 + 20.0 + (kill_rate * 25.0) + (blast_score * 15.0)

        return CandidateEvaluationResultPy(
            candidate_id=candidate.candidate_id,
            acceptance_passed=acceptance_passed,
            regression_passed=regression_passed,
            oracle_tampering_detected=False,
            oscillation_detected=False,
            mutants_generated=len(mutants),
            mutants_killed=mutants_killed,
            mutation_kill_rate=kill_rate,
            blast_radius_score=round(blast_score, 2),
            overall_score=round(overall, 1),
        )

    def _generate_mutants(self, patched: str, replacement: str) -> List[str]:
        mutants: List[str] = []
        if "True" in replacement:
            mutants.append(patched.replace(replacement, replacement.replace("True", "False")))
        elif "False" in replacement:
            mutants.append(patched.replace(replacement, replacement.replace("False", "True")))

        if "return " in replacement:
            mutants.append(patched.replace(replacement, "return None"))

        if re.search(r"[><]=?|==|!=", replacement):
            def _invert_op(match: re.Match) -> str:
                op = match.group(0)
                return {
                    "==": "!=",
                    "!=": "==",
                    "<=": ">",
                    ">=": "<",
                    "<": ">=",
                    ">": "<=",
                }.get(op, op)

            inverted = re.sub(r"==|!=|<=|>=|<|>", _invert_op, replacement)
            if inverted != replacement:
                mutants.append(patched.replace(replacement, inverted))

        mutants.append(patched.replace(replacement, "# mutated omitted"))
        return mutants[:5]

    def _hash_str(self, s: str) -> str:
        return hashlib.sha256(s.encode()).hexdigest()[:16]
