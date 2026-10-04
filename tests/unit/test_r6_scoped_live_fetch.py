"""R6 scoped live fetch. One DOI does not promote product LIVE gates.

Consent starts false and must not touch the network. An explicit consent
decision may then send one privacy-minimized query. A stored receipt is not
this execution. PubMed and PMC stay one NCBI family.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

import urllib.request

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION
from spe_runtime.grounding.research_journey import run_research_journey

_SECRET = "PRIVATE_DOC_ZWY9_do_not_send_electrolyte_formula"
_DOI = "10.1038/nature00870"
_STORED_OPENALEX_DIGEST = "c3c48504f75e84ae0b71379321fde62730d2c2bf10d6559873887af3e3ec534a"
_ROOT = Path(__file__).resolve().parents[2]
_RECEIPT = _ROOT / "evidence" / "r6-live-research" / "scoped_live_fetch.json"


def _assert_gates(result: dict) -> None:
    assert result["product_LIVE_INDEX"] == "HOLD"
    assert result["product_LIVE_RETRACTION"] == "HOLD"
    assert result["client_live_index"] == "HOLD" or result.get("client_live_index") in {None, "HOLD"}
    assert result["may_promote"] is False
    assert result["journey_receipt"] == "NOT_PASS"
    assert result["stored_receipt_reported_as_live"] is False
    assert result["SHELL_MOUNT"] == "NOT_DONE"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert _SECRET not in json.dumps(result)


def test_missing_consent_blocks_even_if_live_was_requested(monkeypatch):
    def boom(*_args, **_kwargs):
        raise AssertionError("network was contacted without consent")

    monkeypatch.setattr(urllib.request, "urlopen", boom)
    result = run_research_journey(
        f"research whether {_SECRET} {_DOI} is citable",
        research_consent=False,
        private_document=_SECRET,
        providers=("OPENALEX", "CROSSREF"),
        allow_live=True,
    )
    assert result["status"] == "HELD_NO_CONSENT"
    assert result["network_calls"] == 0
    assert result["live_request_happened"] is False
    assert result["egress_classification"] == "NO_EGRESS_NO_CONSENT"
    assert result["product_LIVE_INDEX"] == "HOLD"
    assert result["product_LIVE_RETRACTION"] == "HOLD"
    assert _SECRET not in json.dumps(result)


def test_failed_live_source_is_degraded_not_fabricated(monkeypatch):
    def boom(*_args, **_kwargs):
        raise TimeoutError("down")

    monkeypatch.setattr(urllib.request, "urlopen", boom)
    result = run_research_journey(
        _DOI,
        research_consent=True,
        providers=("OPENALEX", "CROSSREF"),
        allow_live=True,
    )
    assert result["status"] == "DEGRADED"
    assert result["scoped_live_fetch"] == "DEGRADED"
    assert result["verification_status"] == "SOURCE_UNAVAILABLE"
    assert result["response_digest"] is None
    assert result["identifier"] is None
    assert result["retraction_status"] == "SOURCE_UNAVAILABLE"
    assert result["live_request_happened"] is True
    assert result["network_calls"] == 2
    _assert_gates(result)
    for row in result["provenance"]:
        assert row["verification_status"] != "DOI_MATCH"
        assert row["stored_receipt"] is False


def test_pubmed_and_pmc_are_not_two_live_families(monkeypatch):
    seen = []

    def boom(req, timeout=25):
        seen.append(getattr(req, "full_url", str(req)))
        raise TimeoutError("down")

    monkeypatch.setattr(urllib.request, "urlopen", boom)
    result = run_research_journey(
        _DOI,
        research_consent=True,
        providers=("PUBMED", "PMC"),
        allow_live=True,
    )
    assert result["providers_selected"] == ["PUBMED"]
    assert result["ncbi_dropped_as_same_family"] == ["PMC"]
    assert result["provider_families"] == ["NCBI"]
    assert result["retraction_independent_of_identity"] is False
    assert result["retraction_status"] == "UNKNOWN"
    assert result["retraction_reason"] == "INDEPENDENT_FAMILY_NOT_QUERIED"
    assert result["ncbi_counts_as_two_providers"] is False
    assert len(seen) == 1
    assert "pmc" not in seen[0].lower() or "db=pubmed" in seen[0].lower()
    assert _SECRET not in seen[0]


def test_saved_bodies_are_the_receipt():
    """The committed proof is the saved bytes, not a later moving API response."""
    receipt = json.loads(_RECEIPT.read_text(encoding="utf-8"))
    before = _RECEIPT.read_bytes()
    openalex = (_ROOT / receipt["response_body_path"]).read_bytes()
    crossref = (_ROOT / receipt["retraction_body_path"]).read_bytes()
    assert hashlib.sha256(openalex).hexdigest() == receipt["response_digest"]
    assert hashlib.sha256(crossref).hexdigest() == receipt["retraction_response_digest"]
    assert receipt["response_digest"] != _STORED_OPENALEX_DIGEST
    assert receipt["provider"] == "OPENALEX"
    assert receipt["identifier"] == _DOI
    assert receipt["verification_status"] == "DOI_MATCH"
    assert receipt["retraction_provider_family"] == "CROSSREF"
    assert receipt["retraction_status"] == "RETRACTION_SIGNAL"
    assert receipt["product_LIVE_INDEX"] == "HOLD"
    assert receipt["product_LIVE_RETRACTION"] == "HOLD"
    assert receipt["may_promote"] is False
    assert receipt["ncbi_counts_as_two_providers"] is False
    assert LIVE_INDEX == "HOLD" and LIVE_RETRACTION == "HOLD"
    message = json.loads(crossref)["message"]
    notices = [
        (str(item.get("type")), str(item.get("DOI")))
        for item in message.get("updated-by") or []
        if isinstance(item, dict)
    ]
    assert ("retraction", "10.1038/s41586-024-07653-0") in notices
    assert ("correction", "10.1038/nature05812") in notices
    assert ("erratum", "10.1038/nature05812") in notices
    assert _SECRET.encode() not in openalex
    assert _SECRET.encode() not in crossref
    assert _RECEIPT.read_bytes() == before


def test_one_real_scoped_live_fetch(monkeypatch, tmp_path):
    calls = {"n": 0}
    real_open = urllib.request.urlopen
    receipt_before = _RECEIPT.read_bytes()

    def blocked(*_args, **_kwargs):
        calls["n"] += 1
        raise AssertionError("consent false must not open a socket")

    monkeypatch.setattr(urllib.request, "urlopen", blocked)
    refused = run_research_journey(
        f"{_SECRET} {_DOI}",
        research_consent=False,
        private_document=_SECRET,
        providers=("OPENALEX", "CROSSREF"),
        allow_live=True,
        evidence_dir=str(tmp_path),
    )
    assert calls["n"] == 0
    assert refused["status"] == "HELD_NO_CONSENT"
    assert refused["network_calls"] == 0
    assert list(tmp_path.iterdir()) == []

    captured: list[tuple[str, bytes]] = []

    def wrap(req, timeout=25):
        response = real_open(req, timeout=timeout)

        class _Cap:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return response.__exit__(exc_type, exc, tb)

            def read(self):
                data = response.read()
                captured.append((req.full_url, data))
                return data

            @property
            def status(self):
                return response.status

        return _Cap()

    monkeypatch.setattr(urllib.request, "urlopen", wrap)
    result = run_research_journey(
        f"{_SECRET} {_DOI}",
        research_consent=True,
        private_document=_SECRET,
        providers=("OPENALEX", "CROSSREF"),
        allow_live=True,
        evidence_dir=str(tmp_path),
    )
    assert result["status"] == "LIVE_FETCH_SCOPED"
    assert result["public_query"] == _DOI
    assert result["provider"] == "OPENALEX"
    assert result["identifier"] == _DOI
    assert result["verification_status"] == "DOI_MATCH"
    assert result["retraction_provider_family"] == "CROSSREF"
    assert result["retraction_independent_of_identity"] is True
    assert result["retraction_status"] == "RETRACTION_SIGNAL"
    assert result["product_LIVE_INDEX"] == "HOLD"
    assert result["product_LIVE_RETRACTION"] == "HOLD"
    assert result["may_promote"] is False
    _assert_gates(result)
    saved_openalex = Path(result["response_body_path"]).read_bytes()
    saved_crossref = Path(result["retraction_body_path"]).read_bytes()
    assert hashlib.sha256(saved_openalex).hexdigest() == result["response_digest"]
    assert hashlib.sha256(saved_crossref).hexdigest() == result["retraction_response_digest"]
    raw_openalex = next(body for url, body in captured if "api.openalex.org" in url)
    raw_crossref = next(body for url, body in captured if "api.crossref.org" in url)
    assert saved_openalex == raw_openalex
    assert saved_crossref == raw_crossref
    assert _SECRET.encode() not in saved_openalex
    assert _SECRET.encode() not in saved_crossref
    # A moving API may not match the committed receipt. That must not rewrite it.
    committed = json.loads(receipt_before)
    assert hashlib.sha256((_ROOT / committed["response_body_path"]).read_bytes()).hexdigest() == committed["response_digest"]
    assert _RECEIPT.read_bytes() == receipt_before
