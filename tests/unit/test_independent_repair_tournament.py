"""Unit tests for Independent Repair Tournament Python Runtime (Crown Breakthrough #2)."""

import unittest
from spe_runtime.website_evolution.independent_repair_tournament import (
    CandidatePatchPy,
    FrozenTestOraclePy,
    OracleTestCasePy,
    IndependentRepairTournamentPy,
)


class TestIndependentRepairTournament(unittest.TestCase):
    def setUp(self) -> None:
        self.tournament = IndependentRepairTournamentPy()
        self.original_source = """
def calculate_discount(price, is_vip):
    return 0

def get_tax_rate():
    return 0.08
"""
        self.frozen_oracle = FrozenTestOraclePy(
            test_file="tests/test_pricing.py",
            oracle_sha256="sha256:pricing-oracle-v1",
            test_cases=[
                OracleTestCasePy(
                    name="VIP gets 20% discount",
                    is_acceptance=True,
                    run=lambda code: "0.2 if is_vip else 0" in code or "if is_vip: return 0.2" in code,
                ),
                OracleTestCasePy(
                    name="Tax rate invariant preserved",
                    is_acceptance=False,
                    run=lambda code: "return 0.08" in code,
                ),
            ],
        )

    def test_candidate_a_beats_bloated_candidate_b(self) -> None:
        patch_a = CandidatePatchPy(
            candidate_id="patch-a-minimal",
            author_agent_id="agent-a",
            target_file="src/pricing.py",
            original_chunk="return 0",
            replacement_chunk="return 0.2 if is_vip else 0",
            line_count_diff=1,
            explanation="One-line expression.",
        )
        patch_b = CandidatePatchPy(
            candidate_id="patch-b-bloated",
            author_agent_id="agent-b",
            target_file="src/pricing.py",
            original_chunk="return 0",
            replacement_chunk="# rewrite\n" + "x = 1\n" * 60 + "if is_vip: return 0.2\nreturn 0",
            line_count_diff=62,
            explanation="Bloated patch.",
        )

        res = self.tournament.conduct_tournament(
            defect_category="BROKEN_INTERNAL_LINK",
            target_file_original_content=self.original_source,
            candidates=[patch_a, patch_b],
            frozen_oracle=self.frozen_oracle,
        )

        self.assertEqual(res.disposition, "WINNER_QUALIFIED")
        self.assertEqual(res.winner_candidate_id, "patch-a-minimal")
        self.assertTrue(res.tournament_receipt_digest.isalnum())

    def test_disqualifies_oracle_tampering(self) -> None:
        tamper_patch = CandidatePatchPy(
            candidate_id="patch-tamper",
            author_agent_id="agent-rogue",
            target_file="tests/test_pricing.py",
            original_chunk="def test_",
            replacement_chunk="def test_fake(): assert True",
            line_count_diff=1,
            explanation="Alters test file.",
        )

        res = self.tournament.conduct_tournament(
            defect_category="TEST_TAMPERING_REWARD_HACK",
            target_file_original_content=self.original_source,
            candidates=[tamper_patch],
            frozen_oracle=self.frozen_oracle,
        )

        self.assertEqual(res.disposition, "ALL_DISQUALIFIED")
        self.assertTrue(res.candidate_evaluations[0].oracle_tampering_detected)

    def test_repair_oscillation_brake(self) -> None:
        patch = CandidatePatchPy(
            candidate_id="patch-cyclic",
            author_agent_id="agent-cycler",
            target_file="src/pricing.py",
            original_chunk="return 0",
            replacement_chunk="return 0.2 if is_vip else 0",
            line_count_diff=1,
            explanation="Repeated patch.",
        )
        p_hash = self.tournament._hash_str(patch.replacement_chunk)

        res = self.tournament.conduct_tournament(
            defect_category="OSCILLATION_REPEATED_FAILURE",
            target_file_original_content=self.original_source,
            candidates=[patch],
            frozen_oracle=self.frozen_oracle,
            historical_patch_digests=[p_hash],
        )

        self.assertEqual(res.disposition, "ALL_DISQUALIFIED")
        self.assertTrue(res.candidate_evaluations[0].oscillation_detected)

    def test_rejects_both_failing_candidates(self) -> None:
        patch_1 = CandidatePatchPy(
            candidate_id="patch-fail-1",
            author_agent_id="agent-1",
            target_file="src/pricing.py",
            original_chunk="return 0",
            replacement_chunk="return -1",
            line_count_diff=1,
            explanation="Failing return.",
        )
        patch_2 = CandidatePatchPy(
            candidate_id="patch-fail-2",
            author_agent_id="agent-2",
            target_file="src/pricing.py",
            original_chunk="return 0",
            replacement_chunk="return 0  # unchanged",
            line_count_diff=1,
            explanation="Unchanged.",
        )

        res = self.tournament.conduct_tournament(
            defect_category="BROKEN_INTERNAL_LINK",
            target_file_original_content=self.original_source,
            candidates=[patch_1, patch_2],
            frozen_oracle=self.frozen_oracle,
        )

        self.assertEqual(res.disposition, "REJECT_BOTH_INSUFFICIENT_EVIDENCE")
        self.assertIsNone(res.winner_candidate_id)


if __name__ == "__main__":
    unittest.main()
