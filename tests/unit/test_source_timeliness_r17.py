"""R17 anti-replay/source-claimed freshness and first-to-report false-proof tests."""
from __future__ import annotations

import json
from dataclasses import replace

import pytest

from spe_runtime.failure_genome.event_journal import EventKind
from spe_runtime.failure_genome.source_timeliness import assess_source_timeliness
from spe_runtime.failure_genome.source_watch import (
    FeedResponse, PublicStatusFeedObserver, TrustedStatusFeed,
)

URL = "https://status.example.org/api/v2/incidents.json"
T0 = "2026-10-14T00:00:00Z"
T1 = "2026-10-14T00:02:00Z"
T2 = "2026-10-14T00:04:00Z"
T3 = "2026-10-14T00:06:00Z"


def source(*, content="first version", updated=T0, event_id="inc-1001", status="investigating"):
    return {
        "id": event_id,
        "name": "Illustrative provider incident",
        "updated_at": updated,
        "created_at": T0,
        "status": status,
        "incident_updates": [{"body": content}],
    }


def page(*events):
    return FeedResponse(200, URL, "application/json",
                        json.dumps({"incidents": list(events)}).encode("utf-8"))


def watcher(*responses, initial=None):
    queue = iter(responses)
    obj = PublicStatusFeedObserver(
        (TrustedStatusFeed("official", "status.example.org", enabled=True),),
        max_requests=20, journal=initial,
        transport=lambda *_: next(queue),
    )
    return obj


def test_source_changed_content_with_older_revision_is_quarantined():
    a = watcher(page(source()), page(source(content="replayed old version", updated="2026-10-13T23:00:00Z")))
    first = a.poll("official", allow_network=True, observed_at=T1)
    second = a.poll("official", allow_network=True, observed_at=T3)
    assert first.added == 1
    assert second.added == 0
    assert second.held == 1
    assert second.stale_revision_holds == 1
    assert second.status == "PARTIAL_HOLD"
    assert len(a.journal.entries) == 1
    assert a.journal.verify_chain()


def test_changed_content_with_same_source_time_is_quarantined():
    a = watcher(page(source()), page(source(content="different source content", updated=T0)))
    assert a.poll("official", allow_network=True, observed_at=T1).added == 1
    r = a.poll("official", allow_network=True, observed_at=T2)
    assert r.added == 0
    assert r.stale_revision_holds == 1
    assert len(a.journal.entries) == 1


def test_sequential_revisions_remain_monotonic_and_individually_recorded():
    a = watcher(
        page(source()),
        page(source(content="new revision", updated=T1, status="monitoring")),
        page(source(content="latest revision", updated=T2, status="resolved")),
    )
    r1 = a.poll("official", allow_network=True, observed_at=T1)
    r2 = a.poll("official", allow_network=True, observed_at=T2)
    r3 = a.poll("official", allow_network=True, observed_at=T3)
    assert (r1.added, r2.added, r3.added) == (1, 1, 1)
    assert [e.event_kind for e in a.journal.entries] == [EventKind.NOTICE, EventKind.UPDATE, EventKind.UPDATE]
    assert r3.first_seen_source_age_seconds == (120,)
    assert all(not r.first_to_report_verified for r in (r1, r2, r3))
    assert all(not e.publication_authorized for e in a.journal.entries)
    assert a.journal.verify_chain()


def test_duplicate_does_not_claim_new_observation_or_headline_latency():
    a = watcher(page(source()), page(source()))
    r1 = a.poll("official", allow_network=True, observed_at=T1)
    r2 = a.poll("official", allow_network=True, observed_at=T3)
    assert r1.first_seen_source_age_seconds == (120,)
    assert r2.added == 0
    assert r2.duplicates == 1
    assert r2.first_seen_source_age_seconds == ()
    assert r2.source_age_measurements_only
    assert not r2.first_to_report_verified
    assert not r2.external_incident_confirmed


def test_old_source_is_archived_metadata_not_current_headline():
    old_time = "2026-10-01T00:00:00Z"
    a = watcher(page(source(updated=old_time)))
    r = a.poll("official", allow_network=True, observed_at=T3)
    assert r.added == 1
    assert r.archival_observations == 1
    assert r.first_seen_source_age_seconds[0] > 86400
    assert not r.first_to_report_verified
    assert not r.external_incident_confirmed
    assert not r.publication_authorized


@pytest.mark.parametrize("published,observed,prior,changed,expected", [
    (T0, T1, None, True, "CURRENT_SOURCE_METADATA"),
    (T0, T1, T0, True, "HOLD"),
    (T0, T1, T0, False, "CURRENT_SOURCE_METADATA"),
    ("2026-10-13T23:30:00Z", T1, T0, True, "HOLD"),
    (T2, T1, None, True, "HOLD"),
    ("2026-10-01T00:00:00Z", T1, None, True, "ARCHIVAL_SOURCE_METADATA"),
    ("2026-10-14T05:00:00+05:00", T1, None, True, "CURRENT_SOURCE_METADATA"),
    (T0, "2026-10-14T00:02:00", None, True, "HOLD"),
    ("invalid", T1, None, True, "HOLD"),
])
def test_source_time_decisions_are_deterministic(published, observed, prior, changed, expected):
    r = assess_source_timeliness(
        source_published_at=published, observed_at=observed,
        predecessor_published_at=prior, changed_content=changed,
    )
    assert r.state == expected
    assert not r.public_event_verified
    assert not r.first_to_report_verified
    assert not r.headline_ready


def test_false_speed_claims_cannot_be_derived_from_source_updated_at():
    r = assess_source_timeliness(source_published_at=T0, observed_at=T1)
    assert r.state == "CURRENT_SOURCE_METADATA"
    assert r.claimed_revision_age_seconds == 120
    assert "SOURCE_CLAIMED_TIMESTAMP_UNVERIFIED" in r.reason_codes
    assert not r.first_to_report_verified
    assert not r.headline_ready


@pytest.mark.parametrize("max_seconds", [0, 59, 31 * 86400, True, -7])
def test_unsafe_freshness_policy_rejected(max_seconds):
    with pytest.raises(ValueError, match="UNSAFE_FRESHNESS_POLICY"):
        assess_source_timeliness(
            source_published_at=T0, observed_at=T1,
            archival_threshold_seconds=max_seconds,
        )



def test_same_batch_duplicate_source_ids_cannot_choose_ambiguous_order():
    a = watcher(page(
        source(content="one"),
        source(content="two", updated=T1),
    ))
    r = a.poll("official", allow_network=True, observed_at=T2)
    assert r.status == "HOLD"
    assert r.reason_codes == ("AMBIGUOUS_DUPLICATE_SOURCE_IDS",)
    assert a.journal.entries == ()
    assert not r.first_to_report_verified
