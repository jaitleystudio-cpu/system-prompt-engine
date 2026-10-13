"""R6 public incident source observer: authorization, DNS/URL and provenance gates.

No test makes a network request. Transports inject deterministic public fixtures.
"""
from __future__ import annotations

import hashlib
import json

import pytest

from spe_runtime.failure_genome.event_journal import EventKind
from spe_runtime.failure_genome.source_watch import (
    FeedResponse, PublicStatusFeedObserver, TrustedStatusFeed,
    _global_ip, _safe_feed_config,
)


FEED_URL = "https://status.example.org/api/v2/incidents.json"
T0 = "2026-10-14T00:00:00Z"
T1 = "2026-10-14T00:03:00Z"
T2 = "2026-10-14T00:05:00Z"


def record(*, content="Investigating", status="investigating", updated="2026-10-14T00:00:00Z"):
    return {
        "id": "inc-1001",
        "name": "Illustrative provider service incident",
        "status": status,
        "created_at": "2026-10-14T00:00:00Z",
        "updated_at": updated,
        "incident_updates": [{"body": content, "status": status}],
    }


def reply(*incidents, url=FEED_URL, mime="application/json; charset=UTF-8", status=200):
    body = json.dumps({"incidents": list(incidents)}).encode("utf-8")
    return FeedResponse(status, url, mime, body)


def observer(*, enabled=True, reply_fn=None, budget=4, hostname="status.example.org"):
    feed = TrustedStatusFeed(source_id="official", hostname=hostname, enabled=enabled)
    calls = []

    def transport(url, byte_limit, timeout):
        calls.append((url, byte_limit, timeout))
        return reply_fn() if reply_fn else reply(record())
    return PublicStatusFeedObserver((feed,), max_requests=budget, transport=transport), calls


def test_denied_by_default_even_if_transport_supplied():
    watcher, calls = observer(enabled=False)
    assert watcher.poll("official", allow_network=True).status == "HOLD"
    assert watcher.poll("official").reason_codes == ("NETWORK_NOT_AUTHORIZED",)
    assert watcher.requests_used == 0
    assert calls == []


def test_explicit_network_consent_and_allowed_source_required():
    watcher, calls = observer()
    assert watcher.poll("official").status == "HOLD"
    assert watcher.poll("unknown", allow_network=True).status == "HOLD"
    assert calls == []
    result = watcher.poll("official", allow_network=True, observed_at=T1)
    assert result.status == "OBSERVED_METADATA_ONLY"
    assert result.added == 1
    assert result.duplicates == 0
    assert result.held == 0
    assert result.observations[0].event_kind is EventKind.NOTICE
    assert result.observations[0].source_id == "official"
    assert not result.publication_authorized
    assert not result.external_incident_confirmed
    assert watcher.journal.verify_chain()
    assert len(calls) == 1
    assert calls[0][0] == FEED_URL


def test_duplicate_update_and_never_guess_correction_or_retraction():
    queue = [reply(record()), reply(record()), reply(record(content="We are monitoring", status="monitoring", updated=T1))]
    watcher, _ = observer(reply_fn=lambda: queue.pop(0))
    a = watcher.poll("official", allow_network=True, observed_at=T1)
    b = watcher.poll("official", allow_network=True, observed_at=T1)
    c = watcher.poll("official", allow_network=True, observed_at=T2)
    assert (a.added, b.duplicates, c.added) == (1, 1, 1)
    assert [r.event_kind for r in watcher.journal.entries] == [EventKind.NOTICE, EventKind.UPDATE]
    assert watcher.journal.verify_chain()
    assert all(not r.external_incident_confirmed for r in watcher.journal.entries)
    assert all(not r.publication_authorized for r in watcher.journal.entries)


def test_request_budget_is_hard_stop():
    watcher, calls = observer(budget=1)
    assert watcher.poll("official", allow_network=True, observed_at=T1).added == 1
    blocked = watcher.poll("official", allow_network=True, observed_at=T2)
    assert blocked.status == "HOLD"
    assert blocked.reason_codes == ("REQUEST_BUDGET_EXCEEDED",)
    assert len(calls) == 1


@pytest.mark.parametrize("host", [
    "127.0.0.1", "localhost", "internal.local", "api.internal",
    "status.example.org.attacker.test.", "STATUS.EXAMPLE.ORG",
    "status.example.org:8443", "evil.example.org/path", "status..example.org",
])
def test_untrusted_feed_hosts_are_rejected(host):
    if host == "status.example.org.attacker.test.":
        assert not _safe_feed_config(TrustedStatusFeed("source", host, enabled=True))
    elif host == "STATUS.EXAMPLE.ORG":
        assert not _safe_feed_config(TrustedStatusFeed("source", host))
    else:
        assert not _safe_feed_config(TrustedStatusFeed("source", host))


@pytest.mark.parametrize("path", [
    "/api/v2/incidents.json?token=sensitive",
    "/api/v2/incidents/../../secret", "//api/v2/incidents.json",
    "/api/v2/incidents.json#fragment", "/other/feed", "/api/v2/incidents.json%00",
])
def test_only_named_statuspage_endpoint_can_be_configured(path):
    assert not _safe_feed_config(TrustedStatusFeed("source", "status.example.org", path=path))


def test_public_ip_filter_rejects_private_loopback_documentation_and_linklocal():
    for ip in ("127.0.0.1", "10.0.0.1", "192.168.10.1", "169.254.169.254",
               "::1", "fe80::1", "2001:db8::1", "not-an-ip"):
        assert not _global_ip(ip)


@pytest.mark.parametrize("response", [
    lambda: reply(record(), url="https://evil.test/api/v2/incidents.json"),
    lambda: reply(record(), status=302),
    lambda: reply(record(), status=503),
    lambda: reply(record(), mime="text/html"),
    lambda: FeedResponse(200, FEED_URL, "application/json", b"{broken"),
    lambda: FeedResponse(200, FEED_URL, "application/json", b"[]" ),
    lambda: FeedResponse(200, FEED_URL, "application/json", b'{"incidents":"no"}'),
    lambda: FeedResponse(200, FEED_URL, "application/json", b"A"*300000),
])
def test_poisoned_or_redirected_feed_is_hold_without_new_entries(response):
    watcher, _ = observer(reply_fn=response)
    r = watcher.poll("official", allow_network=True, observed_at=T1)
    assert r.status == "HOLD"
    assert watcher.journal.entries == ()


def test_partial_invalid_provider_records_not_published():
    watcher, _ = observer(reply_fn=lambda: reply(
        record(),
        record() | {"id": "../bad"},
        record() | {"id": "inc-1002", "name": "<script>alert(1)</script>"},
        record() | {"id": "inc-1003", "status": "incident_corrected_according_to_a_rumor"},
    ))
    result = watcher.poll("official", allow_network=True, observed_at=T1)
    assert result.added == 1
    assert result.held == 3
    assert result.status == "PARTIAL_HOLD"
    assert watcher.journal.verify_chain()


def test_feed_page_count_limit_refuses_entire_page():
    page = [record() | {"id": f"inc-{i}"} for i in range(101)]
    watcher, _ = observer(reply_fn=lambda: reply(*page))
    result = watcher.poll("official", allow_network=True, observed_at=T1)
    assert result.status == "HOLD"
    assert "EVENT_PAGE_BUDGET_EXCEEDED" in result.reason_codes
    assert watcher.journal.entries == ()


def test_unbound_or_early_source_timestamp_rejected():
    watcher, _ = observer(reply_fn=lambda: reply(record(updated=T2)))
    r = watcher.poll("official", allow_network=True, observed_at=T1)
    assert r.held == 1
    assert not watcher.journal.entries


def test_transport_error_hides_private_exception_text():
    def failure():
        raise RuntimeError("Authorization: Bearer ExtremelyPrivateValue_12345")
    watcher, _ = observer(reply_fn=failure)
    r = watcher.poll("official", allow_network=True, observed_at=T1)
    assert r.reason_codes == ("PUBLIC_SOURCE_FETCH_FAILED",)
    assert "Private" not in repr(r)
    assert watcher.requests_used == 1
