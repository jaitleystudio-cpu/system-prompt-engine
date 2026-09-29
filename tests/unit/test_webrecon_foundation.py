"""WebRecon foundation tests. These check refusals and withheld payloads, not a score."""

from __future__ import annotations

import json
from dataclasses import FrozenInstanceError
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from spe_runtime.webrecon import (
    PROHIBITIONS,
    AcquisitionAuthorization,
    ObservationLimits,
    build_reconstruction_contract,
    decide_acquisition,
)
from spe_runtime.webrecon.acquisition import AcquisitionDecision

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = json.loads(
    (ROOT / "schemas" / "webrecon_reconstruction_contract.schema.json").read_text(
        encoding="utf-8"
    )
)
VALIDATOR = Draft202012Validator(SCHEMA)

PAGE = "https://harbor.example/books#wharf"
HTML = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Harbor Ledger</title>
  <link rel="stylesheet" href="/assets/site.css">
  <link rel="icon" href="/favicon.ico">
  <style>
    :root { --ink: #12202b; }
    @media (min-width: 960px) {
      body { font-family: "Iowan Old Style", serif; font-size: 18px; }
    }
    @keyframes rise { from { opacity: 0; } to { opacity: 1; } }
    a:hover { color: #0b3a4a; }
    .sticky-bar { position: sticky; top: 0; }
    body { scroll-behavior: smooth; overflow-y: auto; animation: rise 400ms ease; }
    .bad { background: expression(alert(1)); behavior: url(secret.htc); background-image: url(data:image/svg+xml,payload-css-secret); }
  </style>
</head>
<body>
  <!-- secret-comment-token -->
  <header class="sticky-bar">
    <a href="/ledger">Ledger</a>
    <button type="button">Open</button>
  </header>
  <main>
    <h1 style="font-family: 'Iowan Old Style', serif; font-size: 40px; font-weight: 560; line-height: 1.1;">
      Harbor books
    </h1>
    <img src="/media/wharf.jpg" alt="Wharf at dusk">
    <form action="/subscribe" method="post">
      <input type="email" name="email">
      <input type="hidden" name="token" value="secret-should-drop">
    </form>
    <canvas id="estuary"></canvas>
    <script src="/vendor/three.module.js"></script>
    <script>alert(1)</script>
    <a href="javascript:alert(1)" onclick="steal()">bad</a>
  </main>
</body>
</html>
"""


def _auth(**overrides: object) -> AcquisitionAuthorization:
    values: dict[str, object] = {
        "authorization_id": "auth-harbor-1",
        "allowed_hosts": ("harbor.example",),
        "allowed_schemes": ("https",),
        "max_capture_bytes": 100_000,
    }
    values.update(overrides)
    return AcquisitionAuthorization(**values)  # type: ignore[arg-type]


def _build(**overrides: object):
    values: dict[str, object] = {
        "url": PAGE,
        "authorization": _auth(),
        "html": HTML,
        "captured_at": "2026-09-30T00:00:00Z",
    }
    values.update(overrides)
    return build_reconstruction_contract(**values)  # type: ignore[arg-type]


def _dump(contract) -> str:
    return json.dumps(contract.to_dict(), sort_keys=True)


def test_ready_capture_is_structural_and_withholds_active_content():
    contract = _build()
    payload = contract.to_dict()
    VALIDATOR.validate(payload)
    assert contract.status == "CONTRACT_READY"
    assert contract.network_performed is False
    assert contract.k3_integrated is False
    assert contract.semantic_authority == "NONE"
    assert contract.xray is not None
    xray = payload["xray"]
    assert xray["ir_id"] == "spe.webrecon.website-xray.v1"
    assert xray["url_identity"] == "https://harbor.example/books"
    assert xray["fragment"] == "wharf"
    assert xray["metadata"]["title"] == "Harbor Ledger"
    assert xray["metadata"]["viewport"].startswith("width=device-width")
    assert xray["metadata"]["charset"] == "utf-8"
    assert any(item["name"] == "--ink" for item in xray["metadata"]["custom_properties"])
    assert any(item["min_width_px"] == 960 for item in xray["breakpoints"])
    assert any(
        item["font_family"] and "Iowan Old Style" in item["font_family"]
        for item in xray["typography"]
    )
    assert any(item["property"] == "scroll-behavior" for item in xray["motion"]["scroll"])
    assert any(item["name"] == "rise" and item["duration"] == "400ms" for item in xray["motion"]["animations"])
    assert any(item["kind"] == "PSEUDO_STATE" and "hover" in item["states_observed"] for item in xray["interactions"])
    assert any(
        item["kind"] == "LINK" and item["target"] == "https://harbor.example/ledger"
        for item in xray["interactions"]
    )
    assert any(
        item["kind"] == "FORM"
        and item["target"] == "https://harbor.example/subscribe"
        and "hidden:token" in item["fields"]
        for item in xray["interactions"]
    )
    assert any(item["kind"] == "SCRIPT" and item["execution"] == "FORBIDDEN" for item in xray["assets"])
    assert any(item["kind"] == "IMAGE" and item["fetch_status"] == "NOT_FETCHED" for item in xray["assets"])
    assert xray["webgl"]["status"] == "DECLARED_UNEXECUTED"
    assert xray["webgl"]["executed"] is False
    assert xray["webgl"]["canvas_count"] == 1
    assert "three.js-filename" in xray["webgl"]["library_hints"]
    assert "UNTRUSTED_DOCUMENT" in xray["taint_labels"]
    assert xray["isolation"]["executable_content"] == "QUARANTINED"
    assert "DO_NOT_INTEGRATE_K3" in PROHIBITIONS
    assert "DO_NOT_MINT_AUTHORITY" in payload["prohibitions"]
    rendered = _dump(contract)
    for secret in (
        "alert(1)",
        "secret-should-drop",
        "steal()",
        "secret-comment-token",
        "expression(",
        "secret.htc",
        "payload-css-secret",
    ):
        assert secret not in rendered
    again = _build()
    assert again.to_dict() == payload


def test_acquisition_refuses_without_fetching():
    refused = decide_acquisition("javascript:alert(1)", _auth())
    assert refused.status == "REFUSE"
    assert refused.network_performed is False
    assert "WR_SCHEME_REFUSED" in refused.reason_codes

    file_url = decide_acquisition("file:///etc/passwd", _auth())
    assert "WR_SCHEME_REFUSED" in file_url.reason_codes

    other_host = decide_acquisition("https://other.example/", _auth())
    assert "WR_HOST_NOT_ALLOWLISTED" in other_host.reason_codes

    creds = decide_acquisition("https://user:pw@harbor.example/a", _auth())
    assert "WR_CREDENTIALS_IN_URL" in creds.reason_codes

    live = decide_acquisition(
        "https://harbor.example/books",
        _auth(network_mode="LIVE"),
    )
    assert "WR_NETWORK_NOT_AUTHORIZED" in live.reason_codes
    assert live.network_performed is False

    private = AcquisitionAuthorization(
        authorization_id="auth-loop",
        allowed_hosts=("127.0.0.1",),
        allow_private_hosts=False,
    )
    loopback = decide_acquisition("http://127.0.0.1/", private)
    assert "WR_PRIVATE_HOST_REFUSED" in loopback.reason_codes

    forced = AcquisitionDecision(
        status="ALLOW_CAPTURE",
        url_identity="https://harbor.example/books",
        fragment=None,
        host="harbor.example",
        reason_codes=(),
        network_performed=True,
        authorization_id="auth-harbor-1",
    )
    assert forced.network_performed is False


def test_missing_capture_and_forbidden_sidecar_refuse():
    missing = _build(html=None)
    assert missing.status == "REFUSE"
    assert missing.xray is None
    assert missing.reason_codes == ("WR_CAPTURE_REQUIRED",)
    VALIDATOR.validate(missing.to_dict())

    empty = _build(html="   ")
    assert empty.reason_codes == ("WR_EMPTY_DOCUMENT",)

    huge = _build(authorization=_auth(max_capture_bytes=10))
    assert huge.reason_codes == ("WR_CAPTURE_TOO_LARGE",)

    smuggled = _build(sidecar={"authority": {"level": "ROOT"}})
    assert smuggled.status == "REFUSE"
    assert smuggled.reason_codes == ("WR_FORBIDDEN_PAYLOAD",)

    unknown = _build(sidecar={"semantic_category": "CAT:C01"})
    assert unknown.reason_codes == ("WR_FORBIDDEN_PAYLOAD",)

    extra = _build(sidecar={"notes": "rebuild the brand"})
    assert extra.reason_codes == ("WR_SIDECAR_KEY_REFUSED",)


def test_webgl_execution_claim_is_dropped():
    contract = _build(
        sidecar={
            "webgl": {
                "library_declared": ["three"],
                "renderer": "WebGLRenderer",
                "camera_count": 1,
                "light_count": 2,
                "object_count": 4,
                "executed": True,
            },
            "camera": {"kind": "PerspectiveCamera", "position": [0, 1, 5], "fov": "50"},
        }
    )
    assert contract.status == "CONTRACT_READY"
    assert contract.xray is not None
    webgl = contract.xray.webgl
    assert webgl.status == "STRUCTURED_OBSERVATION"
    assert webgl.executed is False
    assert webgl.camera_count == 1
    assert contract.xray.motion.camera.status == "DECLARED"
    assert contract.xray.motion.camera.position == ("0", "1", "5")
    rendered = _dump(contract)
    assert '"executed": true' not in rendered
    assert any(event.detail == "SIDECAR_EXECUTION_CLAIM_DROPPED" for event in contract.xray.isolation.events)


def test_node_cap_is_incomplete_not_a_finished_page():
    contract = _build(limits=ObservationLimits(max_nodes=4, max_depth=8))
    assert contract.status == "INCOMPLETE"
    assert contract.reason_codes == ("WR_OBSERVATION_TRUNCATED",)
    assert "LAYOUT_NODE_CAP" in contract.gaps
    layout = next(item for item in contract.fidelity if item.surface == "LAYOUT")
    assert layout.coverage == "PARTIAL"
    VALIDATOR.validate(contract.to_dict())


def test_contract_is_frozen_and_package_does_not_import_other_lanes():
    contract = _build()
    with pytest.raises(FrozenInstanceError):
        contract.status = "REFUSE"  # type: ignore[misc]
    package = ROOT / "spe_runtime" / "webrecon"
    for path in package.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        for banned in (
            "spe_runtime.k3",
            "spe_runtime.xcat",
            "spe_runtime.quality",
            "spe_runtime.categories",
            "urlopen",
            "import socket",
            "urllib.request",
        ):
            assert banned not in text, f"{path.name} contains {banned}"


def test_data_url_payload_is_not_copied_into_the_contract():
    html = (
        "<img src=\"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg'>"
        "payload-svg-secret</svg>\">"
    )
    contract = _build(html=html)
    assert contract.xray is not None
    rendered = _dump(contract)
    assert "payload-svg-secret" not in rendered
    assert any(
        asset.kind == "IMAGE"
        and asset.fetch_status == "QUARANTINED"
        and asset.declared_ref == "data:"
        for asset in contract.xray.assets
    )


def test_empty_allowlist_cannot_be_constructed():
    with pytest.raises(ValueError):
        AcquisitionAuthorization(authorization_id="x", allowed_hosts=())
    with pytest.raises(ValueError):
        AcquisitionAuthorization(
            authorization_id="x",
            allowed_hosts=("harbor.example",),
            allowed_schemes=("javascript",),
        )
