"""Adversarial score and mutation-shape checks for the existing optimizer."""

import math
import unittest

from spe_runtime.protocols.optimize import PromptCandidate, optimize_prompt


class OptimizerInputIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.candidate = PromptCandidate(
            protected_intent="keep my meaning",
            hard_constraints=("never upload",),
            execution_wording="original",
        )

    def test_nonfinite_baseline_scores_never_pass(self):
        for score in (math.nan, math.inf, -math.inf, "NaN", "Infinity"):
            with self.subTest(score=score), self.assertRaises(ValueError):
                optimize_prompt(self.candidate, lambda _: {"score": score})

    def test_boolean_mapping_score_never_passes_as_one(self):
        with self.assertRaises(TypeError):
            optimize_prompt(self.candidate, lambda _: {"score": True})

    def test_nonfinite_candidate_score_never_commits(self):
        calls = iter((
            {"score": 0.1, "proposal": {"execution_wording": "changed"}},
            {"score": math.nan},
        ))
        with self.assertRaises(ValueError):
            optimize_prompt(self.candidate, lambda _: next(calls))
        self.assertEqual(self.candidate.execution_wording, "original")

    def test_nonfinite_threshold_is_rejected(self):
        for threshold in (math.nan, math.inf, -math.inf):
            with self.subTest(threshold=threshold), self.assertRaises(ValueError):
                optimize_prompt(self.candidate, lambda _: 0.9, success_threshold=threshold)

    def test_string_collection_is_not_split_into_items(self):
        for field in ("optional_examples", "explanatory_order"):
            with self.subTest(field=field), self.assertRaises(TypeError):
                optimize_prompt(self.candidate, lambda _: {
                    "score": 0.1,
                    "proposal": {field: "malicious text"},
                })

    def test_allowed_update_preserves_structural_protections(self):
        calls = iter((
            {"score": 0.1, "proposal": {"execution_wording": "better"}},
            {"score": 0.9},
        ))
        result = optimize_prompt(self.candidate, lambda _: next(calls))
        self.assertEqual(result.final_candidate.execution_wording, "better")
        self.assertEqual(result.final_candidate.protected_intent, "keep my meaning")
        self.assertEqual(result.final_candidate.hard_constraints, ("never upload",))


if __name__ == "__main__":
    unittest.main()
