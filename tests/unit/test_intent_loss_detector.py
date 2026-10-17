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

    def test_three_letter_acronym_not_ignored(self) -> None:
        source = "Must use JWT"
        # Prompt completely omits JWT
        report_dropped = self.detector.evaluate_intent_fidelity(source, "Create an HTML page with blue background")
        self.assertEqual(report_dropped.dropped_count, 1)
        self.assertEqual(report_dropped.findings[0].state, "DROPPED")

        # Prompt includes JWT
        report_preserved = self.detector.evaluate_intent_fidelity(source, "Enforce JWT authentication header on requests")
        self.assertEqual(report_preserved.preserved_count, 1)
        self.assertEqual(report_preserved.findings[0].state, "PRESERVED")

    def test_affirmative_double_negation(self) -> None:
        source = "Never fail to include external styles; Do not forget to encrypt passwords"
        reqs = self.extractor.extract_from_text(source)
        self.assertEqual(len(reqs), 2)
        self.assertFalse(reqs[0].is_negative)
        self.assertFalse(reqs[1].is_negative)

        # Output obeys the double negation by including external styles and encrypting passwords
        prompt = "Always include external styles in head. Encrypt passwords using bcrypt."
        report = self.detector.evaluate_intent_fidelity(source, prompt)
        self.assertEqual(report.contradicted_count, 0)
        self.assertEqual(report.preserved_count, 2)
        self.assertTrue(report.passed)

    def test_compound_negative_positive_clause(self) -> None:
        source = "Must not use external CDNs, use local cache instead"
        reqs = self.extractor.extract_from_text(source)
        self.assertEqual(len(reqs), 2)
        self.assertTrue(reqs[0].is_negative)
        self.assertFalse(reqs[1].is_negative)

        prompt = "Do not use external CDNs. Use local cache."
        report = self.detector.evaluate_intent_fidelity(source, prompt)
        self.assertEqual(report.contradicted_count, 0)
        self.assertEqual(report.preserved_count, 2)
        self.assertTrue(report.passed)


if __name__ == "__main__":
    unittest.main()
