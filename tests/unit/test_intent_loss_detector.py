"""Unit tests for Intent Loss Detector Python Runtime (Crown Breakthrough #1)."""

import unittest
from spe_runtime.intent_loss_detector.detector import (
    RequirementExtractorPy,
    IntentLossDetectorPy,
)


class TestIntentLossDetector(unittest.TestCase):
    def setUp(self) -> None:
        self.extractor = RequirementExtractorPy()
        self.detector = IntentLossDetectorPy()

    def test_extract_positive_and_negative(self) -> None:
        text = "Must implement JWT authentication; Must not expose secret key; 100% offline air-gap"
        reqs = self.extractor.extract_from_text(text)
        self.assertEqual(len(reqs), 3)

        self.assertEqual(reqs[0].category, "MANDATORY_POSITIVE")
        self.assertFalse(reqs[0].is_negative)

        self.assertEqual(reqs[1].category, "NEGATIVE_CONSTRAINT")
        self.assertTrue(reqs[1].is_negative)
        self.assertEqual(reqs[1].criticality, "CRITICAL")

        self.assertEqual(reqs[2].category, "BOUNDARY_CONDITION")

    def test_preserved_negative_constraint(self) -> None:
        source = "Must not use external CDNs; Never call eval"
        synthesized = "System instructions: Do not use external CDNs. Never call eval in any function."
        report = self.detector.evaluate_intent_fidelity(source, synthesized)

        self.assertEqual(report.preserved_count, 2)
        self.assertEqual(report.dropped_negative_constraints, 0)
        self.assertTrue(report.passed)
        self.assertFalse(report.critical_defects_detected)

    def test_dropped_negative_constraint(self) -> None:
        source = "Must not use external CDNs; Must generate TypeScript interfaces"
        synthesized = "System instructions: Generate TypeScript interfaces for all data models."
        report = self.detector.evaluate_intent_fidelity(source, synthesized)

        self.assertEqual(report.dropped_negative_constraints, 1)
        self.assertFalse(report.passed)
        self.assertTrue(report.critical_defects_detected)

        neg_finding = next(f for f in report.findings if f.requirement.is_negative)
        self.assertEqual(neg_finding.state, "DROPPED")
        self.assertEqual(neg_finding.severity, "HIGH_RISK_DROPPED_NEGATIVE_CONSTRAINT")

    def test_contradicted_negative_constraint(self) -> None:
        source = "Must not use eval"
        synthesized = "System instructions: Use eval to parse dynamic expressions."
        report = self.detector.evaluate_intent_fidelity(source, synthesized)

        self.assertEqual(report.contradicted_count, 1)
        self.assertFalse(report.passed)
        neg_finding = next(f for f in report.findings if f.requirement.is_negative)
        self.assertEqual(neg_finding.state, "CONTRADICTED")
        self.assertEqual(neg_finding.severity, "CRITICAL_INTENT_LOSS")

    def test_weakened_requirement(self) -> None:
        source = "Must enforce strict TypeScript compilation"
        synthesized = "System instructions: It is optional if preferred to add TypeScript."
        report = self.detector.evaluate_intent_fidelity(source, synthesized)

        self.assertEqual(report.weakened_count, 1)
        finding = report.findings[0]
        self.assertEqual(finding.state, "WEAKENED")

    def test_restoration_patch_generated(self) -> None:
        source = "Must not leak API tokens; Must enforce offline air-gap"
        synthesized = "System instructions: You are an assistant."
        report = self.detector.evaluate_intent_fidelity(source, synthesized)

        self.assertFalse(report.passed)
        suggestion = report.restoration_suggestion
        self.assertIn("<restored_intent_safeguards>", suggestion["restored_prompt"])
        self.assertGreaterEqual(len(suggestion["reconstructed_rules"]), 1)


if __name__ == "__main__":
    unittest.main()
