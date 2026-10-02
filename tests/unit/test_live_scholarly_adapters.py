"""Live adapter fixtures → ContextCapsule; capability HOLD preserved."""

from __future__ import annotations

from spe_runtime.grounding.live_adapters import acquire_scholarly_hits
from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION


def test_fixture_acquire_multi_provider_hold():
    result = acquire_scholarly_hits(
        "Lamport happened-before distributed clocks",
        providers=("OPENALEX", "CROSSREF"),
        consent=True,
    )
    assert result["status"] == "ACQUIRED_LIVE"
    assert int(result["network_calls"]) >= 1
    assert result["mode"] == "LIVE"
    assert result["live_index"] == "HOLD"
    assert result["live_retraction"] == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert result["capsules"]
    assert all(c["provenance_digest"].startswith("sha256:") for c in result["capsules"])
    assert all("UNTRUSTED_SOURCE" in c["taint_labels"] for c in result["capsules"])


def test_privacy_rejects_or_strips_secret():
    secret = "patient-token-DEADBEEF"
    result = acquire_scholarly_hits(
        f"therapy outcomes for {secret}",
        providers=("PUBMED",),
        sensitive_spans=(secret,),
        consent=True,
    )
    assert result["status"] in {"ACQUIRED_LIVE", "REJECTED_PRIVACY", "PARTIAL"}
    blob = str(result)
    assert secret not in blob or result["status"] == "REJECTED_PRIVACY"
    if result["status"] != "REJECTED_PRIVACY":
        assert secret not in str(result.get("outbound_query", ""))


def test_timeout_probe_not_acquired():
    result = acquire_scholarly_hits("timeout-probe", consent=True)
    assert result["status"] == "TIMEOUT"
    assert result["status"] != "ACQUIRED_LIVE"
