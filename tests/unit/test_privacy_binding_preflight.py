"""Lock the qualified Lane N privacy contract and the unwired I11 map.

These tests read the current privacy runtime. They do not add a collector,
a network client, or a semantic authority, and they do not call a product surface.
"""

from __future__ import annotations

import ast
import hashlib
import json
import socket
import subprocess
from pathlib import Path

import pytest

from spe_runtime.privacy.aggregates import OBSERVATION_KINDS, AggregateObservation
from spe_runtime.privacy.analytics import (
    COLLECTOR,
    EVENT_KINDS,
    NETWORK_REQUESTS,
    OBSERVATION_ONLY,
    ROUTE_FAMILIES,
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
MAP_PATH = ROOT / "docs" / "architecture" / "privacy-binding-preflight-i11.md"
PROOF_PATH = ROOT / "proofs" / "privacy_binding_preflight_20260930" / "C10_REPORT.md"
SOURCE_SHA = "885d75d615d91e712668660592ffc4e1c584bce5"
VERIFIED_TIP = "f7c2e66930aef3cb4fe5f25c8392321d569847b0"
DAY = "2026-09-30"
ARTIFACT = "audit/evidence.json"
PROMPT = "draft the private launch prompt"
EMAIL = "ada@example.com"

RUNTIME_FILES: tuple[str, ...] = (
    "spe_runtime/privacy/__init__.py",
    "spe_runtime/privacy/aggregates.py",
    "spe_runtime/privacy/analytics.py",
    "spe_runtime/privacy/checklist.py",
    "spe_runtime/privacy/refusals.py",
)
FROZEN_PATHS: tuple[str, ...] = (
    "spe_runtime/xcat",
    "spe_runtime/k3",
    "spe_runtime/quality",
    "portable/spe-core-rs",
)
I11_TOUCH_POINTS: tuple[str, ...] = (
    "I11-PAGE-BUCKET",
    "I11-SEARCH-CONSOLE",
    "I11-CORE-WEB-VITALS",
    "I11-REVENUE",
    "I11-COUNTRY-AGGREGATE",
    "I11-SESSION-AGGREGATE",
    "I11-REFERRER-CLASS",
    "I11-FEATURE-ADOPTION",
    "I11-QUALIFICATION",
    "I11-COLLECTOR",
    "I11-SEMANTIC-AUTHORITY",
)
PRODUCT_ROOTS: tuple[str, ...] = ("apps", "spe_runtime", "packages", "portable", "tools")
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "graphify-out", "target"}
CODE_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".mjs", ".html", ".css", ".json"}
API_TOKENS = (
    "spe_runtime.privacy",
    "import_measurement",
    "import_observation",
    "qualification_checklist",
)
BEACON_TOKENS = (
    "gtag(",
    "fbq(",
    "google-analytics",
    "googletagmanager",
    "connect.facebook.net",
    "fbevents",
    "facebook.com/tr",
    "doubleclick.net",
    "googlesyndication.com",
    "googleadservices.com",
    "navigator.sendBeacon",
)
BANNED_IMPORT_PREFIXES = (
    "urllib",
    "requests",
    "httpx",
    "socket",
    "aiohttp",
    "http.client",
    "spe_runtime.authority",
    "spe_runtime.xcat",
    "spe_runtime.k3",
    "spe_runtime.quality",
    "portable",
)

GATES: tuple[tuple[str, str, dict[str, object]], ...] = (
    ("slot", "SEARCH_CONSOLE", {"source": "SEARCH_CONSOLE", "clicks": 1, "impressions": 0}),
    ("slot", "CORE_WEB_VITALS", {"source": "CORE_WEB_VITALS", "lcp_ms": 1}),
    ("slot", "REVENUE", {"source": "REVENUE", "amount_minor": 1}),
    ("observation", "COUNTRY_AGGREGATE", {"source": "COUNTRY_AGGREGATE", "counts": {"US": 1}}),
    ("observation", "SESSION_AGGREGATE", {"source": "SESSION_AGGREGATE", "session_count": 1}),
    ("observation", "REFERRER_CLASS", {"source": "REFERRER_CLASS", "DIRECT": 1}),
    ("observation", "FEATURE_ADOPTION", {"source": "FEATURE_ADOPTION", "LOCAL_FIRST": 1}),
)


def evidence(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()


def refused(call) -> PrivacyRefusalError:
    with pytest.raises(PrivacyRefusalError) as caught:
        call()
    return caught.value


def git_text(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)


def import_gate(kind: str, name: str, payload: dict[str, object]):
    raw = evidence(payload)
    registry = empty_registry()
    if kind == "slot":
        return import_measurement(registry, name, raw, artifact_ref=ARTIFACT, imported_on=DAY)
    return import_observation(registry, name, raw, artifact_ref=ARTIFACT, imported_on=DAY)


def status_of(registry, kind: str, name: str) -> str:
    if kind == "slot":
        return next(slot.status for slot in registry.slots if slot.slot == name)
    return next(item.status for item in registry.observations if item.kind == name)


def test_runtime_blobs_match_source_sha() -> None:
    for relative in RUNTIME_FILES:
        expected = git_text("rev-parse", f"{SOURCE_SHA}:{relative}").strip()
        actual = git_text("hash-object", relative).strip()
        assert actual == expected


def test_frozen_lanes_match_source_sha() -> None:
    names = git_text("diff", "--name-only", SOURCE_SHA, "--", *FROZEN_PATHS)
    assert names == ""


def test_collector_network_and_authority_constants() -> None:
    assert SCHEMA_ID == "spe.privacy-analytics.v1"
    assert COLLECTOR == "NONE"
    assert NETWORK_REQUESTS == 0
    assert network_law() == {"collector": "NONE", "network_requests": 0}
    assert OBSERVATION_ONLY is True
    assert SEMANTIC_AUTHORITY is False
    assert SLOT_IDS == ("SEARCH_CONSOLE", "CORE_WEB_VITALS", "REVENUE")
    assert OBSERVATION_KINDS == (
        "COUNTRY_AGGREGATE",
        "SESSION_AGGREGATE",
        "REFERRER_CLASS",
        "FEATURE_ADOPTION",
    )
    assert EVENT_KINDS == ("PAGE_VIEW_BUCKET", "NAVIGATION_BUCKET")
    assert ROUTE_FAMILIES == ("HOME", "CREATE", "CAPABILITIES", "CONTRACT", "OTHER_PUBLIC")
    source = (PRIVACY / "analytics.py").read_text(encoding="utf-8")
    assert 'COLLECTOR = "NONE"' in source
    assert "NETWORK_REQUESTS = 0" in source
    assert "SEMANTIC_AUTHORITY = False" in source


def test_empty_registry_keeps_every_gate_unknown() -> None:
    registry = empty_registry()
    assert registry.events == ()
    report = {item.name: item.disposition for item in qualification_checklist(registry).items}
    expected = {
        "search_console": "SEARCH_CONSOLE",
        "core_web_vitals": "CORE_WEB_VITALS",
        "revenue": "REVENUE",
        "country_aggregate": "COUNTRY_AGGREGATE",
        "session_aggregate": "SESSION_AGGREGATE",
        "referrer_class": "REFERRER_CLASS",
        "feature_adoption": "FEATURE_ADOPTION",
    }
    for row, gate in expected.items():
        assert report[row] == UNKNOWN
        assert report[row] != "PASS"
        assert status_of(registry, "slot" if gate in SLOT_IDS else "observation", gate) == UNKNOWN
    assert qualification_checklist(registry).verdict == "ARCHITECTURE_HOLD"
    assert set(data_minimization_proof().values()) == {"EXCLUDED"}


def test_pass_status_is_refused_on_slot_and_observation() -> None:
    slot = refused(
        lambda: MeasurementSlot(
            "SEARCH_CONSOLE",
            "PASS",
            {name: UNKNOWN for name in SLOT_METRICS["SEARCH_CONSOLE"]},
            UNKNOWN,
            UNKNOWN,
            UNKNOWN,
        )
    )
    assert slot.code is PrivacyRefusal.PASS_SCORE_FORBIDDEN
    observation = refused(
        lambda: AggregateObservation(
            "COUNTRY_AGGREGATE",
            "PASS",
            {},
            UNKNOWN,
            UNKNOWN,
            UNKNOWN,
        )
    )
    assert observation.code is PrivacyRefusal.PASS_SCORE_FORBIDDEN


def test_event_drops_prompt_and_identifier() -> None:
    registry = empty_registry()
    prompt = refused(lambda: record_event(registry, _event(prompt=PROMPT)))
    identifier = refused(lambda: record_event(registry, _event(email=EMAIL)))
    assert prompt.code is PrivacyRefusal.RAW_PROMPT
    assert identifier.code is PrivacyRefusal.IDENTIFIER
    assert PROMPT not in str(prompt)
    assert EMAIL not in str(identifier)
    document = json.dumps(registry_document(registry))
    assert PROMPT not in document
    assert EMAIL not in document
    assert registry.events == ()


@pytest.mark.parametrize(("kind", "name", "payload"), GATES)
def test_gate_requires_evidence_and_drops_prompt_and_identifier(
    kind: str, name: str, payload: dict[str, object]
) -> None:
    registry = empty_registry()
    before = registry_document(registry)
    missing = refused(
        lambda: (
            import_measurement(registry, name, b"   ", artifact_ref=ARTIFACT, imported_on=DAY)
            if kind == "slot"
            else import_observation(registry, name, b"   ", artifact_ref=ARTIFACT, imported_on=DAY)
        )
    )
    assert missing.code is PrivacyRefusal.EVIDENCE_REQUIRED
    smuggled = dict(payload)
    smuggled["prompt"] = PROMPT
    prompt = refused(
        lambda: (
            import_measurement(
                registry, name, evidence(smuggled), artifact_ref=ARTIFACT, imported_on=DAY
            )
            if kind == "slot"
            else import_observation(
                registry, name, evidence(smuggled), artifact_ref=ARTIFACT, imported_on=DAY
            )
        )
    )
    assert prompt.code is PrivacyRefusal.RAW_PROMPT
    assert PROMPT not in str(prompt)
    identified = dict(payload)
    identified["email"] = EMAIL
    identifier = refused(
        lambda: (
            import_measurement(
                registry, name, evidence(identified), artifact_ref=ARTIFACT, imported_on=DAY
            )
            if kind == "slot"
            else import_observation(
                registry, name, evidence(identified), artifact_ref=ARTIFACT, imported_on=DAY
            )
        )
    )
    assert identifier.code is PrivacyRefusal.IDENTIFIER
    assert EMAIL not in str(identifier)
    assert registry_document(registry) == before
    assert status_of(registry, kind, name) == UNKNOWN

    raw = evidence(payload)
    imported = import_gate(kind, name, payload)
    assert status_of(imported, kind, name) == "IMPORTED"
    document = json.dumps(registry_document(imported))
    assert raw.decode() not in document
    assert PROMPT not in document
    assert EMAIL not in document
    assert qualification_checklist(imported).verdict == "EVIDENCE_RECORDED"
    assert "PASS" not in qualification_checklist(imported).verdict
    if kind == "slot":
        slot = next(item for item in imported.slots if item.slot == name)
        assert slot.evidence_digest == hashlib.sha256(raw).hexdigest()
        assert slot.status != "PASS"
    else:
        observation = next(item for item in imported.observations if item.kind == name)
        assert observation.evidence_digest == hashlib.sha256(raw).hexdigest()
        assert observation.status != "PASS"


def test_import_makes_no_network_request(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def reject_socket(*_args: object, **_kwargs: object) -> object:
        calls.append("socket")
        raise AssertionError("network")

    monkeypatch.setattr(socket, "socket", reject_socket)
    imported = import_gate("slot", "SEARCH_CONSOLE", {"source": "SEARCH_CONSOLE", "clicks": 1})
    assert calls == []
    assert imported.slots[0].status == "IMPORTED"
    assert network_law()["network_requests"] == 0


def test_privacy_package_has_no_network_or_authority_import() -> None:
    for path in PRIVACY.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            modules: list[str] = []
            if isinstance(node, ast.Import):
                modules = [alias.name for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                modules = [node.module]
            for module in modules:
                assert not module.startswith(BANNED_IMPORT_PREFIXES)


def test_product_tree_does_not_call_privacy_apis() -> None:
    hits = _scan_product(API_TOKENS, web_only=False)
    assert hits == []


def test_web_tree_has_no_ad_beacon() -> None:
    hits = _scan_product(BEACON_TOKENS, web_only=True)
    assert hits == []
    html = (ROOT / "apps" / "web" / "index.html").read_text(encoding="utf-8")
    assert "connect-src 'self'" in html
    assert 'src="/src/main.tsx"' in html


def test_i11_map_marks_every_touch_point_not_wired() -> None:
    text = MAP_PATH.read_text(encoding="utf-8")
    assert f"SOURCE_SHA: `{SOURCE_SHA}`" in text
    assert f"VERIFIED_TIP: `{VERIFIED_TIP}`" in text
    assert "COLLECTOR: NONE" in text
    assert "NETWORK_REQUESTS: 0" in text
    assert "I11_WIRING: NOT_WIRED" in text
    assert "I11_WIRING: WIRED" not in text
    assert "I11_WIRING=WIRED" not in text
    rows: list[tuple[str, str]] = []
    for line in text.splitlines():
        if not line.startswith("| I11-"):
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        assert len(cells) == 4
        rows.append((cells[0], cells[3]))
    assert tuple(row[0] for row in rows) == I11_TOUCH_POINTS
    assert {row[1] for row in rows} == {"NOT_WIRED"}
    proof = PROOF_PATH.read_text(encoding="utf-8")
    assert f"SOURCE_SHA: `{SOURCE_SHA}`" in proof
    assert f"VERIFIED_TIP: `{VERIFIED_TIP}`" in proof
    assert "COLLECTOR: NONE" in proof
    assert "NETWORK_REQUESTS: 0" in proof
    assert "I11_WIRING: NOT_WIRED" in proof
    assert "preflight_passed: 18" in proof
    assert "qualified_passed: 60" in proof
    assert "broader_passed: 20" in proof
    assert "FINAL: HOLD" in proof
    assert "PRIVACY_QUALIFICATION: NOT_A_PASS" in proof
    assert "PRIVACY_BINDING_PREFLIGHT_PASS" not in proof
    assert "PRIVACY_PASS" not in proof
    assert "I11_WIRING: WIRED" not in proof


def _event(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "schema_id": SCHEMA_ID,
        "event_kind": "PAGE_VIEW_BUCKET",
        "day": DAY,
        "route_family": "HOME",
        "count": 1,
    }
    payload.update(overrides)
    return payload


def _scan_product(tokens: tuple[str, ...], *, web_only: bool) -> list[str]:
    hits: list[str] = []
    roots = ("apps/web",) if web_only else PRODUCT_ROOTS
    for root_name in roots:
        root = ROOT / root_name
        for path in root.rglob("*"):
            if not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.suffix not in CODE_SUFFIXES:
                continue
            relative = path.relative_to(ROOT).as_posix()
            if relative.startswith("spe_runtime/privacy/"):
                continue
            text = path.read_text(encoding="utf-8", errors="ignore")
            for token in tokens:
                if token in text:
                    hits.append(f"{relative}: {token}")
    return hits
