"""G4 closure: unsafe or unknown URLs must not become a reconstruction.

The library, once present, is not a mounted product. Live reconstruction,
hosted publish, 3D, and AI generation stay unavailable. This test does not
fetch.
"""

from __future__ import annotations

from spe_runtime.webrecon import (
    AI_GENERATION,
    HOSTED_PUBLISH,
    LIVE_RECONSTRUCTION,
    SCENE_3D,
    AcquisitionAuthorization,
    build_reconstruction_contract,
    decide_acquisition,
)

_HTML = "<!DOCTYPE html><html><body><p>local fixture</p></body></html>"


def _auth() -> AcquisitionAuthorization:
    return AcquisitionAuthorization(
        authorization_id="g4-lane-auth",
        allowed_hosts=("harbor.example",),
        allowed_schemes=("https",),
    )


def test_webrecon_is_not_labeled_available() -> None:
    assert LIVE_RECONSTRUCTION == "NOT_AVAILABLE"
    assert HOSTED_PUBLISH == "HOLD"
    assert SCENE_3D == "NOT_AVAILABLE"
    assert AI_GENERATION == "NOT_AVAILABLE"


def test_unsafe_or_unknown_url_is_not_a_successful_reconstruction() -> None:
    auth = _auth()
    for url in (
        "javascript:alert(1)",
        "https://evil.example/steal",
        "file:///etc/passwd",
        "not a url",
        "",
    ):
        decision = decide_acquisition(url, auth)
        assert decision.status == "REFUSE", url
        assert decision.network_performed is False
        contract = build_reconstruction_contract(
            url=url,
            authorization=auth,
            html=_HTML,
            captured_at="2026-10-03T00:00:00Z",
        )
        assert contract.status == "REFUSE", url
        assert contract.status != "CONTRACT_READY"
        assert contract.network_performed is False
