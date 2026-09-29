"""Deterministic privacy-analytics contract, read from the current implementation.

These tests admit only what the registry admits, and they refuse only what the
registry refuses. They do not invent a pass count.
"""

from __future__ import annotations

import ast
import dataclasses
import hashlib
import json
import socket
from pathlib import Path

import pytest

from spe_runtime.privacy.aggregates import FEATURE_IDS, ISO_COUNTRIES, REFERRER_CLASSES
from spe_runtime.privacy.analytics import (
    COLLECTOR,
    EXCLUDED_DATA,
    NETWORK_REQUESTS,
    OBSERVATION_ONLY,
    SCHEMA_ID,
    SEMANTIC_AUTHORITY,
    SLOT_IDS,
    SLOT_METRICS,
    MeasurementSlot,
    data_minimization_proof,
    empty_registry,
    import_measurement,
    import_observation,
    network_law,
    record_event,
)
from spe_runtime.privacy.checklist import qualification_checklist, registry_document
from spe_runtime.privacy.refusals import UNKNOWN, PrivacyRefusal, PrivacyRefusalError

ROOT = Path(__file__).resolve().parents[2]
PRIVACY = ROOT / "spe_runtime" / "privacy"
ARTIFACT = "audit/evidence.json"
DAY = "2026-09-30"


def event(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "schema_id": SCHEMA_ID,
        "event_kind": "PAGE_VIEW_BUCKET",
        "day": DAY,
        "route_family": "HOME",
        "count": 3,
    }
    payload.update(overrides)
    return payload


def evidence(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()


def refused(call) -> PrivacyRefusalError:
    with pytest.raises(PrivacyRefusalError) as caught:
        call()
    return caught.value


def assert_silent(exc: PrivacyRefusalError, *secrets: str) -> None:
    assert str(exc) == f"{exc.code.value}: {exc.detail}"
    assert exc.detail.isidentifier()
    for secret in secrets:
        if secret:
            assert secret not in exc.detail


def test_empty_registry_has_no_events_and_unknown_measurements() -> None:
    registry = empty_registry()
    assert registry.events == ()
    assert tuple(slot.slot for slot in registry.slots) == SLOT_IDS
    for slot in registry.slots:
        assert slot.status == UNKNOWN
        assert slot.evidence_digest == UNKNOWN
        assert slot.artifact_ref == UNKNOWN
        assert slot.imported_on == UNKNOWN
        assert dict(slot.metrics) == {name: UNKNOWN for name in SLOT_METRICS[slot.slot]}
    report = qualification_checklist(registry)
    assert report.verdict == "ARCHITECTURE_HOLD"
    by_name = {item.name: item.disposition for item in report.items}
    assert by_name["search_console"] == UNKNOWN
    assert by_name["core_web_vitals"] == UNKNOWN
    assert by_name["revenue"] == UNKNOWN
    assert UNKNOWN not in ("0", "", "PASS")
    assert all(item.disposition != "PASS" for item in report.items)


def test_valid_aggregate_event_is_admitted_and_not_summed() -> None:
    registry = empty_registry()
    first = record_event(registry, event())
    second = record_event(first, event(event_kind="NAVIGATION_BUCKET", route_family="CREATE", count=0))
    assert registry.events == ()
    assert len(second.events) == 2
    assert second.events[0].to_dict() == event()
    assert second.events[1].count == 0
    assert not hasattr(second, "total")
    document = registry_document(second)
    assert "total" not in document
    assert document["qualification"]["verdict"] == "ARCHITECTURE_HOLD"


@pytest.mark.parametrize(
    ("field", "value", "code"),
    [
        ("prompt", "draft the launch prompt", PrivacyRefusal.RAW_PROMPT),
        ("raw_prompt", "hidden", PrivacyRefusal.RAW_PROMPT),
        ("email", "ada@example.com", PrivacyRefusal.IDENTIFIER),
        ("ip", "203.0.113.10", PrivacyRefusal.IDENTIFIER),
        ("account_id", "550e8400-e29b-41d4-a716-446655440000", PrivacyRefusal.IDENTIFIER),
        ("user_id", "user-17", PrivacyRefusal.USER_LEVEL_TRACKING),
        ("session_id", "sess_123", PrivacyRefusal.USER_LEVEL_TRACKING),
        ("device_id", "device-abc", PrivacyRefusal.USER_LEVEL_TRACKING),
        ("fingerprint", "canvas-hash", PrivacyRefusal.FINGERPRINT),
        ("gclid", "click-token", PrivacyRefusal.THIRD_PARTY_AD_BEACON),
        ("referrer", "https://news.example/path?q=1", PrivacyRefusal.NOT_AGGREGATE),
        ("lat", 37.7, PrivacyRefusal.FINGERPRINT),
        ("city", "Paris", PrivacyRefusal.FINGERPRINT),
        ("postal_code", "94107", PrivacyRefusal.FINGERPRINT),
        ("country", "US", PrivacyRefusal.FINGERPRINT),
        ("text", "a private sentence from the user", PrivacyRefusal.USER_CONTENT),
        ("pass", "PASS", PrivacyRefusal.PASS_SCORE_FORBIDDEN),
    ],
)
def test_event_refuses_sensitive_fields(field: str, value: object, code: PrivacyRefusal) -> None:
    registry = empty_registry()
    secret = value if isinstance(value, str) else ""
    exc = refused(lambda: record_event(registry, event(**{field: value})))
    assert exc.code is code
    assert_silent(exc, secret)
    assert registry.events == ()
    if secret:
        assert secret not in json.dumps(registry_document(registry))


def test_route_family_rejects_identifiers_and_paths() -> None:
    cases = {
        "ada@example.com": PrivacyRefusal.IDENTIFIER,
        "203.0.113.10": PrivacyRefusal.IDENTIFIER,
        "2001:db8::1": PrivacyRefusal.IDENTIFIER,
        "550e8400-e29b-41d4-a716-446655440000": PrivacyRefusal.IDENTIFIER,
        "/private/projects/1": PrivacyRefusal.NOT_AGGREGATE,
        "free text here": PrivacyRefusal.USER_CONTENT,
    }
    for value, code in cases.items():
        exc = refused(lambda value=value: record_event(empty_registry(), event(route_family=value)))
        assert exc.code is code
        assert_silent(exc, value)


def test_null_empty_and_pass_are_not_unknown() -> None:
    registry = empty_registry()
    for value in (None, ""):
        exc = refused(lambda value=value: record_event(registry, event(count=value)))
        assert exc.code is PrivacyRefusal.UNKNOWN_COLLAPSED
        assert_silent(exc)
    exc = refused(lambda: record_event(registry, event(grade="PASS")))
    assert exc.code is PrivacyRefusal.PASS_SCORE_FORBIDDEN
    metrics = {name: UNKNOWN for name in SLOT_METRICS["SEARCH_CONSOLE"]}
    metrics["clicks"] = 4
    invented = refused(
        lambda: MeasurementSlot(
            "SEARCH_CONSOLE",
            "UNKNOWN",
            metrics,
            UNKNOWN,
            UNKNOWN,
            UNKNOWN,
        )
    )
    assert invented.code is PrivacyRefusal.INVENTED_METRIC
    assert invented.detail == "clicks"
    passed = refused(
        lambda: MeasurementSlot(
            "SEARCH_CONSOLE",
            "PASS",
            {name: UNKNOWN for name in SLOT_METRICS["SEARCH_CONSOLE"]},
            UNKNOWN,
            UNKNOWN,
            UNKNOWN,
        )
    )
    assert passed.code is PrivacyRefusal.PASS_SCORE_FORBIDDEN


def test_extra_event_field_is_not_an_invented_measurement() -> None:
    exc = refused(lambda: record_event(empty_registry(), event(clicks=9)))
    assert exc.code is PrivacyRefusal.SCHEMA_INVALID
    assert exc.detail == "fields"
    candidate = {
        "slot": "SEARCH_CONSOLE",
        "status": "UNKNOWN",
        "metrics": {"clicks": 9, "impressions": UNKNOWN, "ctr": UNKNOWN, "position": UNKNOWN},
        "evidence_digest": UNKNOWN,
        "artifact_ref": UNKNOWN,
        "imported_on": UNKNOWN,
    }
    report = qualification_checklist(empty_registry(), candidate)
    assert PrivacyRefusal.INVENTED_METRIC in report.refusals
    assert report.verdict == "REFUSED"


@pytest.mark.parametrize("slot", SLOT_IDS)
def test_measurement_import_refuses_missing_wrong_unknown_and_unsafe(slot: str) -> None:
    registry = empty_registry()
    metric = SLOT_METRICS[slot][0]
    before = registry_document(registry)
    missing = refused(
        lambda: import_measurement(
            registry, slot, b"   ", artifact_ref=ARTIFACT, imported_on=DAY
        )
    )
    assert missing.code is PrivacyRefusal.EVIDENCE_REQUIRED
    assert missing.detail == "evidence_bytes"
    wrong = refused(
        lambda: import_measurement(
            registry,
            slot,
            evidence({"source": "OTHER", metric: 1}),
            artifact_ref=ARTIFACT,
            imported_on=DAY,
        )
    )
    assert wrong.code is PrivacyRefusal.SCHEMA_INVALID
    assert wrong.detail == "source"
    unknown = refused(
        lambda: import_measurement(
            registry,
            slot,
            evidence({"source": slot, metric: 1, "bounce_rate": 1}),
            artifact_ref=ARTIFACT,
            imported_on=DAY,
        )
    )
    assert unknown.code is PrivacyRefusal.SCHEMA_INVALID
    assert unknown.detail == "evidence"
    secret = "user prompt body that must not be stored"
    unsafe = refused(
        lambda: import_measurement(
            registry,
            slot,
            evidence({"source": slot, metric: 1, "prompt": secret}),
            artifact_ref=ARTIFACT,
            imported_on=DAY,
        )
    )
    assert unsafe.code is PrivacyRefusal.RAW_PROMPT
    assert_silent(unsafe, secret)
    prose = "please rewrite my private project notes"
    user_text = refused(
        lambda: import_measurement(
            registry,
            slot,
            evidence({"source": slot, metric: 1, "text": prose}),
            artifact_ref=ARTIFACT,
            imported_on=DAY,
        )
    )
    assert user_text.code is PrivacyRefusal.USER_CONTENT
    assert_silent(user_text, prose)
    assert registry_document(registry) == before


def test_search_console_import_keeps_digest_and_omitted_unknown() -> None:
    raw = b'{\n  "source": "SEARCH_CONSOLE",\n  "clicks": 0\n}\n'
    registry = import_measurement(
        empty_registry(),
        "SEARCH_CONSOLE",
        raw,
        artifact_ref="audit/search-console.json",
        imported_on=DAY,
    )
    slot = registry.slots[0]
    assert slot.status == "IMPORTED"
    assert slot.status != "PASS"
    assert slot.metrics["clicks"] == 0
    assert type(slot.metrics["clicks"]) is int
    assert slot.metrics["impressions"] == UNKNOWN
    assert slot.metrics["ctr"] == UNKNOWN
    assert slot.metrics["position"] == UNKNOWN
    assert slot.evidence_digest == hashlib.sha256(raw).hexdigest()
    assert slot.artifact_ref == "audit/search-console.json"
    assert slot.imported_on == DAY
    document = json.dumps(registry_document(registry))
    assert '{\n  "source"' not in document
    assert raw.decode() not in document
    for field in dataclasses.fields(slot):
        assert not isinstance(getattr(slot, field.name), (bytes, bytearray))
    report = qualification_checklist(registry)
    assert report.verdict == "EVIDENCE_RECORDED"
    dispositions = {item.name: item.disposition for item in report.items}
    assert dispositions["search_console"] == "EVIDENCE_RECORDED"
    assert dispositions["core_web_vitals"] == UNKNOWN
    assert dispositions["revenue"] == UNKNOWN
    assert "PASS" not in report.verdict


def test_core_web_vitals_real_zero_and_omitted_unknown() -> None:
    raw = evidence({"source": "CORE_WEB_VITALS", "lcp_ms": 0, "cls": 0.0})
    slot = import_measurement(
        empty_registry(),
        "CORE_WEB_VITALS",
        raw,
        artifact_ref="audit/cwv.json",
        imported_on=DAY,
    ).slots[1]
    assert slot.status == "IMPORTED"
    assert slot.status != "PASS"
    assert slot.metrics["lcp_ms"] == 0
    assert slot.metrics["cls"] == 0.0
    assert isinstance(slot.metrics["cls"], float)
    assert slot.metrics["inp_ms"] == UNKNOWN
    assert slot.metrics["ttfb_ms"] == UNKNOWN
    assert slot.evidence_digest == hashlib.sha256(raw).hexdigest()
    passed = refused(
        lambda: import_measurement(
            empty_registry(),
            "CORE_WEB_VITALS",
            evidence({"source": "CORE_WEB_VITALS", "lcp_ms": "PASS"}),
            artifact_ref="audit/cwv.json",
            imported_on=DAY,
        )
    )
    assert passed.code is PrivacyRefusal.PASS_SCORE_FORBIDDEN
    assert_silent(passed, "PASS")


def test_revenue_currency_is_explicit_or_unknown() -> None:
    omitted = evidence({"source": "REVENUE", "amount_minor": 5})
    omitted_slot = import_measurement(
        empty_registry(),
        "REVENUE",
        omitted,
        artifact_ref="audit/revenue.json",
        imported_on=DAY,
    ).slots[2]
    assert omitted_slot.status == "IMPORTED"
    assert omitted_slot.metrics["amount_minor"] == 5
    assert omitted_slot.metrics["transaction_count"] == UNKNOWN
    assert omitted_slot.metrics["currency"] == UNKNOWN
    assert omitted_slot.metrics["currency"] != "USD"
    explicit = evidence({"source": "REVENUE", "amount_minor": 0, "currency": "EUR"})
    explicit_slot = import_measurement(
        empty_registry(),
        "REVENUE",
        explicit,
        artifact_ref="audit/revenue.json",
        imported_on=DAY,
    ).slots[2]
    assert explicit_slot.metrics["amount_minor"] == 0
    assert explicit_slot.metrics["currency"] == "EUR"
    assert explicit_slot.evidence_digest == hashlib.sha256(explicit).hexdigest()
    assert explicit_slot.status != "PASS"
    lowered = refused(
        lambda: import_measurement(
            empty_registry(),
            "REVENUE",
            evidence({"source": "REVENUE", "amount_minor": 1, "currency": "usd"}),
            artifact_ref="audit/revenue.json",
            imported_on=DAY,
        )
    )
    assert lowered.code is PrivacyRefusal.SCHEMA_INVALID
    assert lowered.detail == "currency"


def test_country_is_refused_on_events_and_imported_only_as_iso_counts() -> None:
    registry = empty_registry()
    per_user = refused(lambda: record_event(registry, event(country="US", user_id="user-17")))
    assert per_user.code is PrivacyRefusal.USER_LEVEL_TRACKING
    assert_silent(per_user, "user-17", "US")
    alone = refused(lambda: record_event(registry, event(country="US")))
    assert alone.code is PrivacyRefusal.FINGERPRINT
    assert_silent(alone, "US")
    assert registry.events == ()
    raw = evidence({"source": "COUNTRY_AGGREGATE", "counts": {"US": 2, "DE": 0}})
    imported = import_observation(
        registry,
        "COUNTRY_AGGREGATE",
        raw,
        artifact_ref="audit/country.json",
        imported_on=DAY,
    )
    country = imported.observations[0]
    assert country.kind == "COUNTRY_AGGREGATE"
    assert country.status == "IMPORTED"
    assert country.status != "PASS"
    assert dict(country.metrics) == {"DE": 0, "US": 2}
    assert country.evidence_digest == hashlib.sha256(raw).hexdigest()
    assert "user_id" not in country.to_dict()
    assert "session_id" not in json.dumps(country.to_dict())
    assert imported.slots[0].status == UNKNOWN
    smuggled = refused(
        lambda: import_observation(
            registry,
            "COUNTRY_AGGREGATE",
            evidence({"source": "COUNTRY_AGGREGATE", "country": "US", "count": 1}),
            artifact_ref="audit/country.json",
            imported_on=DAY,
        )
    )
    assert smuggled.code is PrivacyRefusal.FINGERPRINT
    located = refused(
        lambda: import_observation(
            registry,
            "COUNTRY_AGGREGATE",
            evidence(
                {
                    "source": "COUNTRY_AGGREGATE",
                    "counts": {"US": 1},
                    "city": "Paris",
                    "lat": 48.8,
                    "postal_code": "75001",
                }
            ),
            artifact_ref="audit/country.json",
            imported_on=DAY,
        )
    )
    assert located.code is PrivacyRefusal.FINGERPRINT
    assert_silent(located, "Paris", "75001")
    not_iso = refused(
        lambda: import_observation(
            registry,
            "COUNTRY_AGGREGATE",
            evidence({"source": "COUNTRY_AGGREGATE", "counts": {"UK": 4}}),
            artifact_ref="audit/country.json",
            imported_on=DAY,
        )
    )
    assert not_iso.code is PrivacyRefusal.SCHEMA_INVALID
    assert not_iso.detail == "counts"
    assert "UK" not in str(not_iso)
    assert "UK" not in ISO_COUNTRIES
    assert len(ISO_COUNTRIES) == 249


def test_session_aggregate_is_count_only() -> None:
    raw = evidence({"source": "SESSION_AGGREGATE", "session_count": 0})
    observation = import_observation(
        empty_registry(),
        "SESSION_AGGREGATE",
        raw,
        artifact_ref="audit/sessions.json",
        imported_on=DAY,
    ).observations[1]
    assert observation.status == "IMPORTED"
    assert observation.status != "PASS"
    assert dict(observation.metrics) == {"session_count": 0}
    assert observation.evidence_digest == hashlib.sha256(raw).hexdigest()
    stored = json.dumps(observation.to_dict())
    assert "session_id" not in stored
    assert "timeline" not in stored
    blocked = refused(
        lambda: import_observation(
            empty_registry(),
            "SESSION_AGGREGATE",
            evidence({"source": "SESSION_AGGREGATE", "session_count": 2, "session_id": "sess_123"}),
            artifact_ref="audit/sessions.json",
            imported_on=DAY,
        )
    )
    assert blocked.code is PrivacyRefusal.USER_LEVEL_TRACKING
    assert_silent(blocked, "sess_123")
    history = refused(
        lambda: import_observation(
            empty_registry(),
            "SESSION_AGGREGATE",
            evidence(
                {
                    "source": "SESSION_AGGREGATE",
                    "session_count": 2,
                    "session_history": ["sess_123"],
                }
            ),
            artifact_ref="audit/sessions.json",
            imported_on=DAY,
        )
    )
    assert history.code is PrivacyRefusal.USER_LEVEL_TRACKING
    timeline = refused(
        lambda: import_observation(
            empty_registry(),
            "SESSION_AGGREGATE",
            evidence(
                {
                    "source": "SESSION_AGGREGATE",
                    "session_count": 2,
                    "timeline": ["09:00", "09:05"],
                }
            ),
            artifact_ref="audit/sessions.json",
            imported_on=DAY,
        )
    )
    assert timeline.code is PrivacyRefusal.NOT_AGGREGATE
    assert_silent(timeline, "09:00", "09:05")
    missing = empty_registry().observations[1]
    assert missing.status == UNKNOWN
    assert missing.metrics["session_count"] == UNKNOWN
    assert missing.metrics["session_count"] != 0


def test_referrer_class_is_closed_and_drops_urls() -> None:
    assert REFERRER_CLASSES == (
        "DIRECT",
        "SEARCH",
        "SOCIAL",
        "REFERRAL",
        "INTERNAL",
        "OTHER",
        "UNKNOWN",
    )
    raw = evidence({"source": "REFERRER_CLASS", "DIRECT": 4, "UNKNOWN": 0})
    metrics = dict(
        import_observation(
            empty_registry(),
            "REFERRER_CLASS",
            raw,
            artifact_ref="audit/referrer.json",
            imported_on=DAY,
        ).observations[2].metrics
    )
    assert metrics["DIRECT"] == 4
    assert metrics["UNKNOWN"] == 0
    assert metrics["SEARCH"] == UNKNOWN
    assert metrics["SOCIAL"] == UNKNOWN
    url = "https://news.example/story/path?gclid=click-token"
    leaked = refused(
        lambda: import_observation(
            empty_registry(),
            "REFERRER_CLASS",
            evidence({"source": "REFERRER_CLASS", "DIRECT": url}),
            artifact_ref="audit/referrer.json",
            imported_on=DAY,
        )
    )
    assert leaked.code is PrivacyRefusal.THIRD_PARTY_AD_BEACON
    assert_silent(leaked, url, "gclid", "click-token")
    bare = "https://news.example/story/path"
    path_only = refused(
        lambda: import_observation(
            empty_registry(),
            "REFERRER_CLASS",
            evidence({"source": "REFERRER_CLASS", "SEARCH": bare}),
            artifact_ref="audit/referrer.json",
            imported_on=DAY,
        )
    )
    assert path_only.code is PrivacyRefusal.NOT_AGGREGATE
    assert_silent(path_only, bare)
    field = refused(lambda: record_event(empty_registry(), event(referrer=bare)))
    assert field.code is PrivacyRefusal.NOT_AGGREGATE
    assert bare not in json.dumps(registry_document(empty_registry()))


def test_feature_adoption_uses_closed_ids_only() -> None:
    assert FEATURE_IDS == (
        "LOCAL_FIRST",
        "PROTECTED_INTENT",
        "EXECUTION_CONTRACT",
        "PROVIDER_PROFILES",
        "PORTABLE_SPE",
        "CONTEXT_PROTOCOL",
    )
    raw = evidence({"source": "FEATURE_ADOPTION", "LOCAL_FIRST": 0, "PORTABLE_SPE": 2})
    metrics = dict(
        import_observation(
            empty_registry(),
            "FEATURE_ADOPTION",
            raw,
            artifact_ref="audit/features.json",
            imported_on=DAY,
        ).observations[3].metrics
    )
    assert metrics["LOCAL_FIRST"] == 0
    assert metrics["PORTABLE_SPE"] == 2
    assert metrics["PROTECTED_INTENT"] == UNKNOWN
    assert metrics["CONTEXT_PROTOCOL"] == UNKNOWN
    label = "CUSTOM_EVENT"
    arbitrary = refused(
        lambda: import_observation(
            empty_registry(),
            "FEATURE_ADOPTION",
            evidence({"source": "FEATURE_ADOPTION", label: 1}),
            artifact_ref="audit/features.json",
            imported_on=DAY,
        )
    )
    assert arbitrary.code is PrivacyRefusal.SCHEMA_INVALID
    assert arbitrary.detail == "feature"
    assert label not in str(arbitrary)
    prose = "My Feature"
    free_text = refused(
        lambda: import_observation(
            empty_registry(),
            "FEATURE_ADOPTION",
            evidence({"source": "FEATURE_ADOPTION", prose: 1}),
            artifact_ref="audit/features.json",
            imported_on=DAY,
        )
    )
    assert free_text.code is PrivacyRefusal.USER_CONTENT
    assert_silent(free_text, prose)
    journey = refused(
        lambda: import_observation(
            empty_registry(),
            "FEATURE_ADOPTION",
            evidence(
                {
                    "source": "FEATURE_ADOPTION",
                    "LOCAL_FIRST": 1,
                    "journey": ["LOCAL_FIRST", "PORTABLE_SPE"],
                }
            ),
            artifact_ref="audit/features.json",
            imported_on=DAY,
        )
    )
    assert journey.code is PrivacyRefusal.NOT_AGGREGATE
    named = refused(lambda: record_event(empty_registry(), event(event_kind="signup_clicked")))
    assert named.code is PrivacyRefusal.SCHEMA_INVALID


def test_missing_observations_stay_unknown() -> None:
    registry = empty_registry()
    report = {item.name: item.disposition for item in qualification_checklist(registry).items}
    for name in (
        "search_console",
        "core_web_vitals",
        "revenue",
        "country_aggregate",
        "session_aggregate",
        "referrer_class",
        "feature_adoption",
    ):
        assert report[name] == UNKNOWN
        assert report[name] not in (0, "", "PASS", "0")
    country, session, referrer, feature = registry.observations
    assert country.status == UNKNOWN
    assert country.metrics == {}
    assert 0 not in country.metrics.values()
    assert session.metrics["session_count"] == UNKNOWN
    assert all(value == UNKNOWN for value in referrer.metrics.values())
    assert all(value == UNKNOWN for value in feature.metrics.values())


def test_registry_retains_digest_not_raw_evidence_or_user_content() -> None:
    secret = "project Orion private prompt"
    email = "ada@example.com"
    registry = empty_registry()
    refused(
        lambda: import_measurement(
            registry,
            "SEARCH_CONSOLE",
            evidence({"source": "SEARCH_CONSOLE", "clicks": 1, "prompt": secret, "email": email}),
            artifact_ref=ARTIFACT,
            imported_on=DAY,
        )
    )
    raw = evidence({"source": "SEARCH_CONSOLE", "clicks": 8, "impressions": 0})
    imported = import_measurement(
        registry, "SEARCH_CONSOLE", raw, artifact_ref="audit/search-console.json", imported_on=DAY
    )
    document = json.dumps(registry_document(imported))
    assert secret not in document
    assert email not in document
    assert raw.decode() not in document
    slot = imported.slots[0]
    assert slot.evidence_digest == hashlib.sha256(raw).hexdigest()
    assert slot.metrics["clicks"] == 8
    assert slot.metrics["impressions"] == 0
    assert slot.artifact_ref == "audit/search-console.json"
    assert slot.imported_on == DAY
    assert "prompt" not in slot.to_dict()


def test_data_minimization_excludes_private_representations() -> None:
    proof = data_minimization_proof()
    assert tuple(proof) == EXCLUDED_DATA
    assert set(proof.values()) == {"EXCLUDED"}
    event_fields = {field.name for field in dataclasses.fields(record_event(empty_registry(), event()).events[0])}
    assert event_fields == {"schema_id", "event_kind", "day", "route_family", "count"}
    forbidden = {
        "prompt",
        "prompt_contents",
        "private_projects",
        "raw_documents",
        "browsing_history",
        "fingerprint",
        "advertising_profile",
        "sale_of_data",
        "session_id",
        "user_id",
        "referrer",
    }
    assert event_fields.isdisjoint(forbidden)
    document = json.dumps(registry_document(empty_registry()))
    for name in forbidden:
        assert f'"{name}"' not in document


def test_network_collector_is_none_and_import_makes_no_request(monkeypatch: pytest.MonkeyPatch) -> None:
    assert network_law() == {"collector": "NONE", "network_requests": 0}
    assert COLLECTOR == "NONE"
    assert NETWORK_REQUESTS == 0
    calls: list[str] = []

    def reject_socket(*_args: object, **_kwargs: object) -> object:
        calls.append("socket")
        raise AssertionError("network")

    monkeypatch.setattr(socket, "socket", reject_socket)
    raw = evidence({"source": "SEARCH_CONSOLE", "clicks": 1})
    imported = import_measurement(
        empty_registry(),
        "SEARCH_CONSOLE",
        raw,
        artifact_ref="audit/search-console.json",
        imported_on=DAY,
    )
    assert calls == []
    assert imported.slots[0].status == "IMPORTED"
    for path in (PRIVACY / "analytics.py", PRIVACY / "aggregates.py", PRIVACY / "checklist.py"):
        text = path.read_text(encoding="utf-8")
        for token in (
            "import urllib",
            "import requests",
            "import httpx",
            "urllib.request",
            "requests.get",
            "httpx.",
            "google-analytics",
            "googletagmanager",
            "fbevents",
            "gtag(",
            "fbq(",
            "connect.facebook.net",
        ):
            assert token not in text
    denylist = (PRIVACY / "refusals.py").read_text(encoding="utf-8")
    assert "google-analytics.com" in denylist
    assert "facebook.com/tr" in denylist


def test_observations_do_not_create_semantic_authority() -> None:
    assert OBSERVATION_ONLY is True
    assert SEMANTIC_AUTHORITY is False
    registry = import_observation(
        empty_registry(),
        "FEATURE_ADOPTION",
        evidence({"source": "FEATURE_ADOPTION", "LOCAL_FIRST": 1}),
        artifact_ref="audit/features.json",
        imported_on=DAY,
    )
    document = registry_document(registry)
    assert document["qualification"]["verdict"] == "EVIDENCE_RECORDED"
    assert document["qualification"]["verdict"] != "PASS"
    blob = json.dumps(document)
    assert "AuthorityGrant" not in blob
    assert "semantic_authority" not in blob
    assert "authority_state" not in blob


def test_privacy_package_does_not_import_other_lanes() -> None:
    banned = ("spe_runtime.xcat", "spe_runtime.k3", "spe_runtime.quality", "portable")
    for path in PRIVACY.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom):
                modules = [node.module or ""]
            for module in modules:
                assert not module.startswith(banned)


def test_imports_do_not_open_artifact_ref(monkeypatch: pytest.MonkeyPatch) -> None:
    opened: list[str] = []
    real_open = open

    def guard(file: object, *args: object, **kwargs: object) -> object:
        opened.append(str(file))
        if "search-console" in str(file):
            raise AssertionError("artifact opened")
        return real_open(file, *args, **kwargs)

    monkeypatch.setattr("builtins.open", guard)
    import_measurement(
        empty_registry(),
        "SEARCH_CONSOLE",
        evidence({"source": "SEARCH_CONSOLE", "position": 0}),
        artifact_ref="audit/search-console.json",
        imported_on=DAY,
    )
    assert all("search-console" not in name for name in opened)
