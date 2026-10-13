"""Offline adversarial gate tests: no live model, network or publisher."""
from types import SimpleNamespace
import unittest

from spe_runtime.failure_genome.incident_review import (
    ReviewState, review_failure_for_publication,
)


def specimen(**changes):
    base = dict(
        failure_id="SPE-FG-2026-001111", scope="GLOBAL", consent=True,
        model="example-model", model_version="revision-2026-10",
        minimal_reproducer="A deliberate minimal failing prompt",
        observations=["Observed failure under synthetic lab setup"],
        is_verified_by_reproduction=False, root_cause="Pending causal analysis",
        candidate_repairs=[],
    )
    return SimpleNamespace(**(base | changes))


def assess(entry, **changes):
    args = dict(source_urls=["https://status.example.org/incidents/1"],
                source_published_at="2026-10-13T11:00:00Z",
                source_observed_at="2026-10-13T11:01:00+00:00")
    return review_failure_for_publication(entry, **(args | changes))


class IncidentReviewTests(unittest.TestCase):
    def test_complete_metadata_only_reaches_independent_review(self):
        r = assess(specimen())
        self.assertEqual(r.state, ReviewState.READY_FOR_INDEPENDENT_REVIEW)
        self.assertFalse(r.claim_confirmed)
        self.assertFalse(r.root_cause_verified)
        self.assertFalse(r.repair_verified)
        self.assertFalse(r.publication_authorized)

    def test_legacy_reproduction_boolean_never_promotes_truth(self):
        r = assess(specimen(is_verified_by_reproduction=True,
                            root_cause="Attention caused it", candidate_repairs=["Use a longer prompt"]))
        self.assertIn("LEGACY_REPRODUCTION_FLAG_NOT_INDEPENDENT_PROOF", r.issue_codes)
        self.assertIn("CAUSAL_EXPLANATION_UNVERIFIED", r.issue_codes)
        self.assertIn("REPAIR_EFFECT_UNVERIFIED", r.issue_codes)
        self.assertFalse(r.publication_authorized)

    def test_private_cases_fail_closed_and_hide_sources(self):
        for change in [dict(scope="PRIVATE"), dict(consent=False), dict(consent=1)]:
            with self.subTest(change=change):
                r = assess(specimen(**change))
                self.assertEqual(r.state, ReviewState.HOLD)
                self.assertEqual(r.source_urls, ())

    def test_missing_owner_fields_fail_closed(self):
        for change in [dict(model_version="unknown"), dict(observations=[]),
                       dict(minimal_reproducer=" "), dict(failure_id="A")]:
            with self.subTest(change=change):
                self.assertEqual(assess(specimen(**change)).state, ReviewState.HOLD)

    def test_untrusted_and_internal_sources_rejected(self):
        for url in ["http://example.org/x", "https://127.0.0.1/x", "https://localhost/x",
                    "https://a.localhost/x", "https://bad@source.example.org/x",
                    "https://example.org:8443/x", "https://example.org/x#secret",
                    "https://example.org/x\nInjected: yes", "", "https://[::1]/x"]:
            with self.subTest(url=url):
                r = assess(specimen(), source_urls=[url])
                self.assertEqual(r.state, ReviewState.HOLD)
                self.assertIn("PRIMARY_SOURCE_UNVERIFIED", r.issue_codes)

    def test_empty_timestamp_timezone_and_inverted_order(self):
        cases = [dict(source_published_at=""),
                 dict(source_observed_at="2026-10-13T11:01:00"),
                 dict(source_observed_at="2026-10-13T10:59:00Z")]
        for change in cases:
            with self.subTest(change=change):
                self.assertEqual(assess(specimen(), **change).state, ReviewState.HOLD)

    def test_malformed_fields_fail_closed_without_crash(self):
        r = assess(specimen(model_version=None, minimal_reproducer=None), source_urls=[{"url": "https://example.org"}])
        self.assertEqual(r.state, ReviewState.HOLD)
        self.assertFalse(r.publication_authorized)

    def test_duplicate_sources_normalize_deterministically(self):
        url = "https://status.example.org/incidents/1"
        r = assess(specimen(), source_urls=[url, url])
        self.assertEqual(r.source_urls, (url,))


if __name__ == "__main__":
    unittest.main()
