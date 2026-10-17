"""Scoped example.com grant on the existing Website X-Ray owner.

No grant must open zero sockets. A grant may fetch only https://example.com/.
A hostile body is parsed as data and is not evaluated.
"""

from __future__ import annotations

import builtins
import hashlib
import http.client
import json
import socket

from spe_runtime.webrecon import LIVE_RECONSTRUCTION, AcquisitionAuthorization, decide_acquisition
from spe_runtime.webrecon.scoped_grant import (
    PRODUCT_LIVE_URL_RECONSTRUCTION,
    SCOPED_URL,
    ExampleComGrant,
    acquire_scoped_example,
    observe_untrusted_html,
)


def test_no_grant_opens_zero_connections() -> None:
    trips: list[str] = []
    original_socket = socket.socket
    original_https = http.client.HTTPSConnection

    def _socket(*_args: object, **_kwargs: object) -> socket.socket:
        trips.append("socket")
        raise RuntimeError("socket")

    def _https(*_args: object, **_kwargs: object) -> http.client.HTTPSConnection:
        trips.append("https")
        raise RuntimeError("https")

    socket.socket = _socket  # type: ignore[misc, assignment]
    http.client.HTTPSConnection = _https  # type: ignore[misc, assignment]
    try:
        refused = acquire_scoped_example(None)
        wrong_type = acquire_scoped_example(object())  # type: ignore[arg-type]
        live = decide_acquisition(
            SCOPED_URL,
            AcquisitionAuthorization(
                authorization_id="no-live",
                allowed_hosts=("example.com",),
                allowed_schemes=("https",),
                network_mode="LIVE",
            ),
        )
    finally:
        socket.socket = original_socket  # type: ignore[misc]
        http.client.HTTPSConnection = original_https  # type: ignore[misc]

    assert trips == []
    assert refused.status == "REFUSED"
    assert refused.reason == "NO_GRANT"
    assert refused.network_performed is False
    assert refused.digest is None
    assert refused.retained_bytes == b""
    assert refused.scoped_label is None
    assert refused.product_live_url_reconstruction == "NOT_AVAILABLE"
    assert wrong_type.status == "REFUSED"
    assert wrong_type.network_performed is False
    assert live.status == "REFUSE"
    assert live.network_performed is False
    assert "WR_NETWORK_NOT_AUTHORIZED" in live.reason_codes


def test_grant_fetches_example_com_and_records_real_digest() -> None:
    receipt = acquire_scoped_example(
        ExampleComGrant(grant_id="r6-example-com"),
        timeout_seconds=5.0,
        max_bytes=65_536,
    )
    assert receipt.status == "SCOPED", receipt.reason
    assert receipt.network_performed is True
    assert receipt.final_url == "https://example.com/"
    assert receipt.http_status == 200
    assert receipt.fetched_at
    assert receipt.retained_bytes
    digest = "sha256:" + hashlib.sha256(receipt.retained_bytes).hexdigest()
    assert receipt.digest == digest
    assert receipt.observed_text
    assert receipt.inference == "NONE"
    assert receipt.executed is False
    assert receipt.recovered_source is False
    assert receipt.scoped_label == "LIVE_URL_SCOPED"
    assert receipt.product_live_url_reconstruction == "NOT_AVAILABLE"
    assert PRODUCT_LIVE_URL_RECONSTRUCTION == "NOT_AVAILABLE"
    assert LIVE_RECONSTRUCTION == "NOT_AVAILABLE"
    assert LIVE_RECONSTRUCTION != "PASS"
    assert receipt.isolation_executable == "QUARANTINED"
    assert "Example Domain" in receipt.observed_text


def test_hostile_body_is_not_evaluated() -> None:
    payload = "EVAL_SENTINEL_do_not_run"
    html = (
        "<!DOCTYPE html><html><body>"
        f"<script>eval('{payload}')</script>"
        "<p>Visible example</p>"
        "</body></html>"
    )
    trips: list[str] = []
    original_eval = builtins.eval
    original_socket = socket.socket

    def _eval(*_args: object, **_kwargs: object) -> object:
        trips.append("eval")
        raise AssertionError("hostile body was evaluated")

    def _socket(*_args: object, **_kwargs: object) -> socket.socket:
        trips.append("socket")
        raise RuntimeError("socket")

    builtins.eval = _eval  # type: ignore[assignment]
    socket.socket = _socket  # type: ignore[misc, assignment]
    try:
        contract = observe_untrusted_html(html)
    finally:
        builtins.eval = original_eval
        socket.socket = original_socket  # type: ignore[misc]

    assert trips == []
    assert contract.network_performed is False
    assert contract.semantic_authority == "NONE"
    rendered = json.dumps(contract.to_dict())
    assert payload not in rendered
    assert contract.xray is not None
    assert contract.xray.isolation.executable_content == "QUARANTINED"
    assert any(event.detail == "SCRIPT_BODY_WITHHELD" for event in contract.xray.isolation.events)
    scripts = [asset for asset in contract.xray.assets if asset.kind == "SCRIPT"]
    assert scripts
    assert all(asset.execution == "FORBIDDEN" for asset in scripts)
    assert "Visible example" in rendered
