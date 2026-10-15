"""Unit tests for Privacy-Budgeted Evolution Python Runtime (Crown Breakthrough #3)."""

import unittest
from spe_runtime.website_evolution.privacy_budgeted_evolution import (
    PrivacyBudgetedEvolutionPy,
    MeasurementRequirementPy,
)


class TestPrivacyBudgetedEvolution(unittest.TestCase):
    def setUp(self) -> None:
        self.pbe = PrivacyBudgetedEvolutionPy(max_cumulative_epsilon=1.0)

    def test_compilation_strips_pii_and_coarsens(self) -> None:
        record, receipt = self.pbe.compile_minimal_telemetry(
            route="/create?user_ssn=123-45-6789",
            raw_viewport_width=390,
            raw_latency_ms=450.0,
            task_completed=True,
            feature_engaged="PROMPT_SYNTHESIZER",
            consent_state="GRANTED",
            raw_user_input_text="My private diagnosis",
            client_ip_address="10.0.0.1",
            cookie_header="auth_cookie=secret",
        )

        self.assertIsNotNone(record)
        self.assertEqual(record.route, "/create")
        self.assertEqual(record.coarse_viewport, "MOBILE")
        self.assertEqual(record.latency_bucket, "100_TO_500MS")
        self.assertTrue(record.task_completed)
        self.assertTrue(receipt.pii_detected)
        self.assertTrue(receipt.egress_permitted)

    def test_zero_egress_when_consent_denied_or_unset(self) -> None:
        rec_denied, rec_receipt = self.pbe.compile_minimal_telemetry(
            route="/pricing",
            raw_viewport_width=1200,
            raw_latency_ms=50.0,
            task_completed=False,
            feature_engaged="PRICING",
            consent_state="DENIED",
        )
        self.assertIsNone(rec_denied)
        self.assertFalse(rec_receipt.egress_permitted)
        self.assertTrue(rec_receipt.raw_payload_blocked)

        rec_unset, _ = self.pbe.compile_minimal_telemetry(
            route="/pricing",
            raw_viewport_width=1200,
            raw_latency_ms=50.0,
            task_completed=False,
            feature_engaged="PRICING",
            consent_state="UNSET",
        )
        self.assertIsNone(rec_unset)

    def test_dp_aggregate_query_and_budget_consumption(self) -> None:
        req = MeasurementRequirementPy(
            query_id="query-daily-users",
            question="Unique prompt sessions",
            target_route="/create",
            metric_type="COUNT",
            sensitivity_delta=1.0,
            requested_epsilon=0.40,
        )

        perturbed, eps, status = self.pbe.execute_differentially_private_aggregate(req, 5000.0)
        self.assertEqual(eps, 0.40)
        self.assertEqual(status.consumed_epsilon, 0.40)
        self.assertEqual(status.remaining_epsilon, 0.60)
        self.assertAlmostEqual(perturbed, 5000.0, delta=100.0)

    def test_privacy_budget_exhaustion_raises_error(self) -> None:
        req1 = MeasurementRequirementPy(
            query_id="query-1",
            question="Query 1",
            target_route="/",
            metric_type="COUNT",
            sensitivity_delta=1.0,
            requested_epsilon=0.80,
        )
        self.pbe.execute_differentially_private_aggregate(req1, 100.0)

        # Only 0.20 remaining, requesting 0.50 should fail
        req2 = MeasurementRequirementPy(
            query_id="query-2",
            question="Query 2",
            target_route="/",
            metric_type="COUNT",
            sensitivity_delta=1.0,
            requested_epsilon=0.50,
        )
        with self.assertRaises(ValueError) as ctx:
            self.pbe.execute_differentially_private_aggregate(req2, 200.0)

        self.assertIn("PRIVACY_BUDGET_EXHAUSTED", str(ctx.exception))

    def test_local_preferences(self) -> None:
        self.pbe.set_local_preference("hdr_mode", "on")
        self.assertEqual(self.pbe.get_local_preference("hdr_mode"), "on")
        self.assertIsNone(self.pbe.get_local_preference("unset_key"))


if __name__ == "__main__":
    unittest.main()
