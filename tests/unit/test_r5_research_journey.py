"""R5 research journey: consent, privacy, fail-closed providers, one NCBI family.

Product LIVE_INDEX and LIVE_RETRACTION stay HOLD. SHELL_MOUNT stays NOT_DONE.
"""

from __future__ import annotations

from pathlib import Path

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION
from spe_runtime.grounding.research_journey import SHELL_MOUNT, run_research_journey

_SECRET = "PRIVATE_DOC_ZWY9_do_not_send_electrolyte_formula"
_DOI = "10.1038/nature00870"
_ROOT = Path(__file__).resolve().parents[2]


def _boom(*_args, **_kwargs):
    raise AssertionError("canonical client was called")


def test_product_gates_and_shell_stay_closed():
    fabric = (_ROOT / "spe_runtime/grounding/live_fabric.py").read_text(encoding="utf-8")
    assert 'LIVE_INDEX: Final[str] = "HOLD"' in fabric
    assert 'LIVE_RETRACTION: Final[str] = "HOLD"' in fabric
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert SHELL_MOUNT == "NOT_DONE"


def test_missing_consent_does_not_search(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(
        f"research whether {_DOI} is citable",
        research_consent=False,
        private_document=_SECRET,
    )
    assert result["status"] == "HELD_NO_CONSENT"
    assert result["network_calls"] == 0
    assert result["egress_classification"] == "NO_EGRESS_NO_CONSENT"
    assert result["need"]["is_consent"] is False
    assert result["research_consent"] is False
    assert result["journey_receipt"] == "NOT_PASS"
    assert result["product_LIVE_INDEX"] == "HOLD"
    assert result["product_LIVE_RETRACTION"] == "HOLD"
    assert result["SHELL_MOUNT"] == "NOT_DONE"
    assert _SECRET not in str(result)
    assert result["live_request_happened"] is False


def test_need_object_is_not_consent(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(_DOI, research_consent={"needed": True})
    assert result["status"] == "HELD_NO_CONSENT"
    assert result["network_calls"] == 0


def test_private_document_is_not_in_outbound_query(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(
        f"{_SECRET} {_DOI}",
        research_consent=True,
        private_document=_SECRET,
    )
    assert result["status"] == "ACQUIRED_STORED_RECEIPT"
    assert result["public_query"] == _DOI
    assert result["network_calls"] == 0
    assert result["outbound_urls_sent"] == []
    blob = str(result["classified_query_urls_not_sent"]) + result["public_query"]
    blob += result["research_grounded_prompt"]
    assert _SECRET not in blob
    assert _SECRET not in str(result["provenance"])
    assert result["egress_classification"] == "STORED_RECEIPT_REUSE_NO_NEW_HTTP"


def test_unknown_provider_fails_closed(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(
        _DOI,
        research_consent=True,
        providers=("OPENALEX", "NOT_A_PROVIDER"),
    )
    assert result["status"] == "REJECTED_UNKNOWN_PROVIDER"
    assert result["network_calls"] == 0
    assert result["egress_classification"] == "NO_EGRESS_UNKNOWN_PROVIDER"
    assert "NOT_A_PROVIDER" in result["unknown_providers"]


def test_pubmed_and_pmc_are_one_family(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(
        _DOI,
        research_consent=True,
        providers=("PUBMED", "PMC"),
    )
    assert result["providers_selected"] == ["PUBMED"]
    assert result["ncbi_dropped_as_same_family"] == ["PMC"]
    assert result["provider_families"] == ["NCBI"]
    assert result["ncbi_family_count"] == 1
    assert result["ncbi_family_count_if_archive_has_pubmed_and_pmc"] == 1
    assert result["ncbi_counts_as_two_providers"] is False
    assert result["network_calls"] == 0
    families = {row["provider_family"] for row in result["provenance"]}
    assert families == {"NCBI"}
    assert "PMC" not in {row["provider"] for row in result["provenance"]}


def test_stored_doi_journey_receipt_stays_inside_tested_scope(monkeypatch):
    monkeypatch.setattr(
        "spe_runtime.grounding.research_journey.acquire_scholarly_hits",
        _boom,
    )
    result = run_research_journey(_DOI, research_consent=True)
    assert result["journey_receipt"] == "PASS_WITHIN_TESTED_SCOPE"
    assert result["live_request_happened"] is False
    assert result["egress_classification"] == "STORED_RECEIPT_REUSE_NO_NEW_HTTP"
    assert result["product_LIVE_INDEX"] == "HOLD"
    assert result["product_LIVE_RETRACTION"] == "HOLD"
    assert result["identity_scope"]["product_LIVE_INDEX"] == "HOLD"
    assert result["retraction_scope"]["product_LIVE_RETRACTION"] == "HOLD"
    assert result["retraction_scope"]["may_promote"] is False
    assert result["retraction_scope"]["pass"] is False
    assert result["SHELL_MOUNT"] == "NOT_DONE"
    assert result["graph"]["ok"] is True
    assert "CONTRADICTS" in result["graph"]["edge_relations"]
    assert result["graph"]["contradictions"]
    assert result["graph"]["gaps"]
    assert "HOLD" in result["research_grounded_prompt"]
    providers = {row["provider"] for row in result["provenance"]}
    assert {"OPENALEX", "CROSSREF", "PUBMED"} <= providers
    for row in result["provenance"]:
        assert row["query"]
        assert row["identifier"]
        assert row["timestamp"]
        assert str(row["url"]).startswith("http")
        assert row["response_digest"]
        assert row["verification_status"]
        assert row["live_verified"] is False
        assert row["egress"] == "PRIOR_STORED_RECEIPT_NO_NEW_HTTP"


def test_consented_non_doi_uses_canonical_fixture_client_not_live():
    calls = []

    def spy(url: str):
        calls.append(url)
        from spe_runtime.grounding.live_adapters import fixture_transport

        return fixture_transport(url)

    result = run_research_journey(
        "blue light systematic review",
        research_consent=True,
        providers=("OPENALEX",),
        transport=spy,
    )
    assert calls
    assert result["egress_classification"] == "INJECTED_TRANSPORT"
    assert result["network_calls"] == 1
    assert result["journey_receipt"] == "NOT_PASS"
    assert result["client_live_index"] == "HOLD"
    assert result["client_live_retraction"] == "HOLD"
    assert result["live_request_happened"] is False
    assert result["graph"]["ok"] is True
    assert "api.openalex.org" in calls[0]
