"""R3-D measured library journey. No fetch, no host, no capability pass labels."""

from __future__ import annotations

import socket

import pytest

from spe_runtime.webrecon import AcquisitionAuthorization
from spe_runtime.website_product.library_flow import (
    AI_GENERATION,
    LIVE_URL_RECONSTRUCTION,
    SCENE_3D,
    SCENE_IR_WIRED,
    assess_live_url,
    assess_local_saved_html,
    compile_spec,
    observe_attached_capture,
)

_SPEC = {
    "spec_version": "website-spec/1",
    "title": "R3 Room",
    "summary": "Offline static page.",
    "pages": [
        {
            "path": "index.html",
            "title": "Home",
            "sections": [
                {"kind": "prose", "heading": "Copy", "body": "Local text."},
            ],
        }
    ],
}


def test_capability_labels_are_not_pass() -> None:
    assert AI_GENERATION == "NOT_AVAILABLE"
    assert SCENE_3D == "NOT_AVAILABLE"
    assert LIVE_URL_RECONSTRUCTION == "NOT_AVAILABLE"
    assert SCENE_IR_WIRED is False


def test_spec_export_is_deterministic_and_closed(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network")

    monkeypatch.setattr(socket, "socket", boom)
    monkeypatch.setattr(socket, "create_connection", boom)
    first = compile_spec(_SPEC)
    second = compile_spec(_SPEC)
    assert first["status"] == "LOCAL_EXPORT_READY"
    assert first["export_sha256"] == second["export_sha256"]
    assert first["fetched"] is False
    assert first["network_performed"] is False
    assert first["reduced_motion"] is True
    assert first["content_security_policy"] is True
    assert first["hosted_export_status"] == "HOLD"
    assert first["hosted_export_passed"] is False
    assert first["sandbox_status"] == "UNSUPPORTED"
    assert first["sandbox_passed"] is False
    assert first["ai_generation"] != "PASS"
    assert first["scene_3d"] != "PASS"
    assert first["live_url_reconstruction"] != "PASS"


def test_malicious_spec_links_are_rejected() -> None:
    for href in ("javascript:alert(1)", "https://evil.example/", "<script>"):
        spec = {
            "spec_version": "website-spec/1",
            "title": "R3 Room",
            "pages": [
                {
                    "path": "index.html",
                    "title": "Home",
                    "sections": [
                        {
                            "kind": "cta",
                            "heading": "Next",
                            "cta_label": "Go",
                            "cta_href": href,
                        }
                    ],
                }
            ],
        }
        result = compile_spec(spec)
        assert result["status"] == "REJECTED", href
        assert result["preview_html"] is None


def test_script_prose_is_escaped_not_executed() -> None:
    spec = {
        "spec_version": "website-spec/1",
        "title": "R3 Room",
        "pages": [
            {
                "path": "index.html",
                "title": "Home",
                "sections": [
                    {
                        "kind": "prose",
                        "heading": "Copy",
                        "body": '<script>alert("x")</script>',
                    }
                ],
            }
        ],
    }
    result = compile_spec(spec)
    assert result["status"] == "LOCAL_EXPORT_READY"
    assert result["live_url_reconstruction"] == "NOT_AVAILABLE"


def test_live_url_is_not_fetched(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("network")

    monkeypatch.setattr(socket, "socket", boom)
    monkeypatch.setattr(socket, "create_connection", boom)
    for url in (
        "https://harbor.example/books",
        "javascript:alert(1)",
        "file:///etc/passwd",
        "",
    ):
        result = assess_live_url(url)
        assert result["status"] == "REFUSED"
        assert result["fetched"] is False
        assert result["network_performed"] is False
        assert result["acquisition_status"] == "REFUSE"
        assert result["live_url_reconstruction"] == "NOT_AVAILABLE"


def test_local_saved_html_is_not_a_live_url() -> None:
    benign = assess_local_saved_html(
        "notes.html",
        "<!DOCTYPE html><html><body><p>saved</p></body></html>",
    )
    assert benign["status"] == "REFUSED"
    assert benign["local_saved_html_is_live_url"] is False
    assert benign["preview_html"] is None
    assert benign["source_kind"] == "local_saved_html"

    hostile = assess_local_saved_html(
        "bad.html",
        "<html><body><script>alert(1)</script><a href='javascript:alert(1)'>x</a></body></html>",
    )
    assert hostile["status"] == "REJECTED"
    assert "MALICIOUS_OR_REMOTE_MARKUP_REFUSED" in hostile["reasons"]
    assert hostile["preview_html"] is None

    styled = assess_local_saved_html(
        "styled.html",
        "<html><style>a{background:url(javascript:alert(1))}</style><p>x</p></html>",
    )
    assert styled["status"] == "REJECTED"
    assert "CSS_JAVASCRIPT_URL" in styled["css_quarantine_kinds"]


def test_attached_capture_does_not_execute_webgl_or_network() -> None:
    auth = AcquisitionAuthorization(
        authorization_id="r3d-attached",
        allowed_hosts=("harbor.example",),
        allowed_schemes=("https",),
    )
    observed = observe_attached_capture(
        url="https://harbor.example/books",
        html="<!DOCTYPE html><html><body><p>held</p></body></html>",
        authorization=auth,
        captured_at="2026-10-03T00:00:00Z",
    )
    assert observed["fetched"] is False
    assert observed["network_performed"] is False
    assert observed["contract_network_performed"] is False
    assert observed["acquisition_status"] == "ALLOW_CAPTURE"
    assert observed["contract_status"] == "CONTRACT_READY"
    assert observed["webgl_executed"] is False
    assert observed["live_url_reconstruction"] == "NOT_AVAILABLE"
    assert observed["scene_ir_wired"] is False
