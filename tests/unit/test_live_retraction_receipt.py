"""Live retraction receipts fail closed. They do not promote."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION
from spe_runtime.grounding.live_retraction_scope import (
    NO_RETRACTION_ASSERTED,
    evaluate_live_retraction_receipts,
    load_retraction_receipt,
    receipt_is_self_signed,
    retraction_assertion,
)

_EVIDENCE = Path("evidence/r4-task6/live_retraction_receipts.json")
_BODY = hashlib.sha256(b"provider-body-not-the-receipt").hexdigest()


def _row(**overrides):
    base = {
        "canonical_doi": "10.1038/nature00870",
        "provider": "OPENALEX",
        "provider_family": "OPENALEX",
        "query_class": "OPENALEX_IS_RETRACTED",
        "query": "https://api.openalex.org/works/https://doi.org/10.1038/nature00870",
        "http_status": 200,
        "timestamp_ist": "2026-10-04T10:47:06+05:30",
        "returned_id": "https://openalex.org/W2158048826",
        "response_sha256": _BODY,
        "self_signed": False,
        "authority": "NONE",
        "raw_status": {"is_retracted": True},
    }
    base.update(overrides)
    return base


def test_missing_receipt_holds_and_is_not_pass():
    for pack in (None, {}, {"receipts": []}):
        verdict = evaluate_live_retraction_receipts(pack)
        assert verdict["LIVE_RETRACTION"] == "HOLD"
        assert verdict["scoped_LIVE_RETRACTION"] == "HOLD"
        assert verdict["pass"] is False
        assert verdict["may_promote"] is False
        assert verdict["product_LIVE_INDEX"] == "HOLD"
        assert verdict["product_LIVE_RETRACTION"] == "HOLD"
        assert "RECEIPT_MISSING" in verdict["reasons"]
    missing = load_retraction_receipt(Path("evidence/r4-task6/does-not-exist.json"))
    assert missing["LIVE_RETRACTION"] == "HOLD"
    assert missing["pass"] is False
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"


def test_self_signed_receipt_does_not_bind():
    signed = _row(self_signed=True)
    other = _row(
        provider="CROSSREF",
        provider_family="CROSSREF",
        query_class="CROSSREF_UPDATE_RELATION",
        query="https://api.crossref.org/works/10.1038/nature00870",
        returned_id="10.1038/nature00870",
        response_sha256=hashlib.sha256(b"crossref-body").hexdigest(),
        raw_status={"update-to": [{"type": "retraction"}], "relation": {}},
    )
    assert receipt_is_self_signed(signed, {}) is True
    verdict = evaluate_live_retraction_receipts({"receipts": [signed, other]})
    ident = verdict["dois"]["10.1038/nature00870"]
    assert ident["asserting_families"] == ["CROSSREF"]
    assert ident["retraction_gate"] == "HOLD"
    assert ident["pass"] is False
    assert verdict["LIVE_RETRACTION"] == "HOLD"
    assert verdict["may_promote"] is False
    assert "SELF_SIGNED_RECEIPT_REJECTED" in verdict["reasons"]

    claim = _row()
    claim["response_sha256"] = hashlib.sha256(
        json.dumps(claim["raw_status"], sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert receipt_is_self_signed(claim, {}) is True
    held = evaluate_live_retraction_receipts({"self_signed": True, "receipts": [_row(), other]})
    assert held["scoped_LIVE_RETRACTION"] == "HOLD"
    assert held["dois"]["10.1038/nature00870"]["independent_family_count"] == 0


def test_writer_cannot_mint_independence_or_promotion():
    verdict = evaluate_live_retraction_receipts({
        "may_promote": True,
        "independent_verifier_receipt": True,
        "product_LIVE_RETRACTION": "PASS",
        "receipts": [
            _row(),
            _row(
                provider="CROSSREF",
                provider_family="CROSSREF",
                query_class="CROSSREF_UPDATE_RELATION",
                query="https://api.crossref.org/works/10.1038/nature00870",
                returned_id="10.1038/nature00870",
                response_sha256=hashlib.sha256(b"crossref-body-2").hexdigest(),
                raw_status={"updated-by": [{"type": "retraction"}]},
            ),
        ],
    })
    assert verdict["may_promote"] is False
    assert verdict["independent_verifier_receipt"] is False
    assert verdict["product_LIVE_RETRACTION"] == "HOLD"
    assert verdict["LIVE_RETRACTION"] == "HOLD"
    assert verdict["scoped_LIVE_RETRACTION"] == "HOLD"
    assert verdict["pass"] is False


def test_two_families_bind_without_product_pass():
    verdict = evaluate_live_retraction_receipts({"receipts": [
        _row(),
        _row(
            provider="PUBMED",
            provider_family="NCBI",
            query_class="PUBMED_ESUMMARY_PUBTYPE",
            query="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=12077603",
            returned_id="12077603",
            response_sha256=hashlib.sha256(b"pubmed-body").hexdigest(),
            raw_status={"pubtype": ["Journal Article", "Retracted Publication"]},
        ),
    ]})
    ident = verdict["dois"]["10.1038/nature00870"]
    assert ident["retraction_gate"] == "RETRACTION_BOUND"
    assert ident["independent_family_count"] == 2
    assert ident["pass"] is False
    assert verdict["scoped_LIVE_RETRACTION"] == "RETRACTION_BOUND"
    assert verdict["LIVE_RETRACTION"] == "HOLD"
    assert verdict["product_LIVE_INDEX"] == "HOLD"
    assert verdict["product_LIVE_RETRACTION"] == "HOLD"
    assert verdict["may_promote"] is False
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"


def test_pubmed_plus_pmc_are_one_family():
    verdict = evaluate_live_retraction_receipts({"receipts": [
        _row(
            provider="PUBMED",
            provider_family="NCBI",
            query_class="PUBMED_ESUMMARY_PUBTYPE",
            returned_id="12077603",
            response_sha256=hashlib.sha256(b"pubmed").hexdigest(),
            raw_status={"pubtype": ["Retracted Publication"]},
        ),
        _row(
            provider="PMC",
            provider_family="NCBI",
            query_class="PUBMED_ESUMMARY_PUBTYPE",
            returned_id="12077603",
            response_sha256=hashlib.sha256(b"pmc").hexdigest(),
            raw_status={"pubtype": ["Retraction Notice"]},
        ),
    ]})
    ident = verdict["dois"]["10.1038/nature00870"]
    assert ident["asserting_families"] == ["NCBI"]
    assert ident["ncbi_family_count"] == 1
    assert ident["retraction_gate"] == "HOLD"
    assert ident["pass"] is False


def test_missing_retraction_field_is_not_pass():
    absent = _row(raw_status={})
    assert retraction_assertion(absent) == "FIELD_ABSENT"
    no_crossref = _row(
        provider="CROSSREF",
        query_class="CROSSREF_UPDATE_RELATION",
        raw_status={"title": "no update fields"},
    )
    assert retraction_assertion(no_crossref) == "FIELD_ABSENT"
    verdict = evaluate_live_retraction_receipts({"receipts": [absent, no_crossref]})
    ident = verdict["dois"]["10.1038/nature00870"]
    assert ident["retraction_gate"] == "HOLD"
    assert ident["evidence"] == NO_RETRACTION_ASSERTED
    assert ident["not_retracted"] is False
    assert ident["pass"] is False
    assert verdict["scoped_LIVE_RETRACTION"] != "PASS"
    assert verdict["LIVE_RETRACTION"] != "PASS"


def test_negative_signals_are_not_a_pass():
    verdict = evaluate_live_retraction_receipts({"receipts": [
        _row(
            canonical_doi="10.1145/359545.359563",
            returned_id="https://openalex.org/W3137220996",
            raw_status={"is_retracted": False},
        ),
        _row(
            canonical_doi="10.1145/359545.359563",
            provider="CROSSREF",
            provider_family="CROSSREF",
            query_class="CROSSREF_UPDATE_RELATION",
            query="https://api.crossref.org/works/10.1145/359545.359563",
            returned_id="10.1145/359545.359563",
            response_sha256=hashlib.sha256(b"lamport-crossref").hexdigest(),
            raw_status={"update-to": None, "updated-by": None, "relation": {}},
        ),
    ]})
    ident = verdict["dois"]["10.1145/359545.359563"]
    assert ident["evidence"] == NO_RETRACTION_ASSERTED
    assert ident["retraction_gate"] == "HOLD"
    assert ident["not_retracted"] is False
    assert ident["pass"] is False


def test_committed_live_retraction_receipt_matches_evaluator():
    assert _EVIDENCE.is_file()
    pack = json.loads(_EVIDENCE.read_text())
    assert pack["may_promote"] is False
    assert pack["self_signed"] is False
    assert pack["independent_verifier_receipt"] is False
    assert pack["product_LIVE_INDEX"] == "HOLD"
    assert pack["product_LIVE_RETRACTION"] == "HOLD"
    assert pack["pmc_queried"] is False
    providers = {row["provider"] for row in pack["receipts"]}
    assert "PMC" not in providers
    for row in pack["receipts"]:
        assert receipt_is_self_signed(row, pack) is False
        assert row["response_sha256"]
        assert row["query"]
        assert row["timestamp_ist"]
        assert row["http_status"] == 200
    stored = pack.pop("verdict")
    fresh = evaluate_live_retraction_receipts(pack)
    assert fresh == stored
    assert fresh["LIVE_RETRACTION"] == "HOLD"
    assert fresh["scoped_LIVE_RETRACTION"] == "HOLD"
    assert fresh["product_LIVE_INDEX"] == LIVE_INDEX == "HOLD"
    assert fresh["product_LIVE_RETRACTION"] == LIVE_RETRACTION == "HOLD"
    assert fresh["may_promote"] is False
    assert fresh["pass"] is False
    nature = fresh["dois"]["10.1038/nature00870"]
    lamport = fresh["dois"]["10.1145/359545.359563"]
    gautret = fresh["dois"]["10.1016/j.ijantimicag.2020.105949"]
    assert nature["retraction_gate"] == "RETRACTION_BOUND"
    assert nature["asserting_families"] == ["CROSSREF", "NCBI", "OPENALEX"]
    assert nature["pass"] is False
    assert gautret["retraction_gate"] == "RETRACTION_BOUND"
    assert gautret["asserting_families"] == ["CROSSREF", "NCBI", "OPENALEX"]
    assert lamport["retraction_gate"] == "HOLD"
    assert lamport["evidence"] == NO_RETRACTION_ASSERTED
    assert lamport["not_retracted"] is False
    nature_rows = [row for row in pack["receipts"] if row["canonical_doi"] == "10.1038/nature00870"]
    crossref = next(row for row in nature_rows if row["provider"] == "CROSSREF")
    assert crossref["raw_status"]["update-to_present"] is False
    assert "retraction" in {item["type"] for item in crossref["raw_status"]["updated-by"]}
    esearch = next(row for row in nature_rows if row["query_class"] == "PMID_RESOLUTION")
    assert esearch["raw_status"]["retraction_field_present"] is False
    esummary = next(row for row in nature_rows if row["query_class"] == "PUBMED_ESUMMARY_PUBTYPE")
    assert "Retracted Publication" in esummary["raw_status"]["pubtype"]
    assert esummary["returned_id"] == "12077603"
    lamport_pubmed = [
        row for row in pack["receipts"]
        if row["canonical_doi"] == "10.1145/359545.359563" and row["provider"] == "PUBMED"
    ]
    assert len(lamport_pubmed) == 1
    assert lamport_pubmed[0]["hit_count"] == 0
    assert lamport_pubmed[0]["returned_id"] is None
    gautret_crossref = next(
        row for row in pack["receipts"]
        if row["canonical_doi"] == "10.1016/j.ijantimicag.2020.105949" and row["provider"] == "CROSSREF"
    )
    assert "retraction" in {item["type"] for item in gautret_crossref["raw_status"]["update-to"]}
