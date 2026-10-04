"""R4 task 6: scoped live identity bindings are not promotion."""

from __future__ import annotations

import json
from pathlib import Path

from spe_runtime.grounding.live_fabric import LIVE_INDEX, LIVE_RETRACTION
from spe_runtime.grounding.live_identity_scope import (
    evaluate_live_identity_scope,
    ncbi_family_count,
    qualifying_doi_providers,
)

_EVIDENCE = Path("evidence/r4-task6/live_identity_bindings.json")


def _row(**overrides):
    base = {
        "canonical_doi": "10.1038/nature00870",
        "provider": "OPENALEX",
        "query_class": "ADAPTER_DIRECT_DOI",
        "supplemental": False,
        "http_status": 200,
        "status": "DOI_MATCH",
        "returned_doi": "10.1038/nature00870",
        "returned_id": "https://openalex.org/W2158048826",
        "timestamp_ist": "2026-10-04T08:40:00+05:30",
        "query": "https://api.openalex.org/works/https://doi.org/10.1038/nature00870",
        "response_sha256": "a" * 64,
        "retraction_observation": {"is_retracted": True},
    }
    base.update(overrides)
    return base


def test_product_constants_stay_hold_when_scope_passes():
    pack = {
        "bindings": [
            _row(),
            _row(
                provider="CROSSREF",
                returned_id="10.1038/nature00870",
                query="https://api.crossref.org/works/10.1038/nature00870",
                response_sha256="b" * 64,
                retraction_observation={"update_types": ["retraction"]},
            ),
        ]
    }
    verdict = evaluate_live_identity_scope(pack)
    assert verdict["scoped_LIVE_INDEX"] == "PASS_WITHIN_TESTED_SCOPE"
    assert verdict["scoped_LIVE_RETRACTION"] == "HOLD"
    assert verdict["product_LIVE_INDEX"] == "HOLD"
    assert verdict["product_LIVE_RETRACTION"] == "HOLD"
    assert LIVE_INDEX == "HOLD"
    assert LIVE_RETRACTION == "HOLD"
    assert verdict["may_promote"] is False
    assert verdict["may_promote_index"] is False
    assert verdict["may_promote_retraction"] is False
    assert verdict["identities"]["10.1038/nature00870"]["live_verified"] is False


def test_writer_receipt_does_not_promote_even_if_flag_claimed():
    pack = {
        "independent_verifier_receipt": True,
        "bindings": [
            _row(),
            _row(provider="CROSSREF", returned_id="10.1038/nature00870",
                 query="https://api.crossref.org/works/10.1038/nature00870",
                 response_sha256="c" * 64),
        ],
    }
    verdict = evaluate_live_identity_scope(pack)
    assert verdict["may_promote"] is False
    assert verdict["independent_verifier_receipt"] is False
    assert "WRITER_RECEIPT_NOT_PROMOTION_PROOF" in verdict["reasons"]


def test_pubmed_and_pmc_same_pmid_are_not_two_providers():
    pack = {
        "bindings": [
            _row(
                provider="PUBMED",
                query_class="ADAPTER_QUOTED_ESEARCH",
                status="ID_WITHOUT_DOI",
                returned_doi=None,
                returned_id="12077603",
                query="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=%2210.1038%2Fnature00870%22",
            ),
            _row(
                provider="PMC",
                query_class="ADAPTER_QUOTED_ESEARCH_SAME_URL_AS_PUBMED",
                status="ID_WITHOUT_DOI",
                returned_doi=None,
                returned_id="12077603",
                query="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=%2210.1038%2Fnature00870%22",
            ),
        ]
    }
    assert qualifying_doi_providers(pack, "10.1038/nature00870") == ()
    assert ncbi_family_count(pack, "10.1038/nature00870") == 1
    verdict = evaluate_live_identity_scope(pack)
    assert verdict["scoped_LIVE_INDEX"] == "HOLD"
    ident = verdict["identities"]["10.1038/nature00870"]
    assert ident["independent_doi_provider_count"] == 0
    assert ident["ncbi_counts_as_extra_independent_provider"] is False


def test_missing_digest_drops_provider_and_holds_index():
    pack = {"bindings": [_row(response_sha256="not-a-digest"), _row(provider="CROSSREF", returned_id="10.1038/nature00870", query="https://api.crossref.org/works/10.1038/nature00870", response_sha256="d" * 64)]}
    assert qualifying_doi_providers(pack, "10.1038/nature00870") == ("CROSSREF",)
    assert evaluate_live_identity_scope(pack)["scoped_LIVE_INDEX"] == "HOLD"


def test_quoted_zero_is_not_not_retracted():
    pack = {
        "bindings": [
            _row(
                canonical_doi="10.1145/359545.359563",
                provider="PUBMED",
                query_class="ADAPTER_QUOTED_ESEARCH",
                status="ZERO_HITS",
                returned_doi=None,
                returned_id=None,
                hit_count=0,
                query="https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?term=%2210.1145%2F359545.359563%22",
                retraction_observation={"field": None},
            )
        ]
    }
    ident = evaluate_live_identity_scope(pack)["identities"]["10.1145/359545.359563"]
    assert ident["retraction_observation"] == "NO_SIGNAL_IN_QUERIED_SOURCES"
    assert ident["not_retracted"] is False
    assert ident["index_status"] == "HOLD"


def test_committed_live_bindings_match_evaluator():
    pack = json.loads(_EVIDENCE.read_text())
    stored = pack.pop("verdict")
    fresh = evaluate_live_identity_scope(pack)
    assert fresh == stored
    assert fresh["scoped_LIVE_INDEX"] == "PASS_WITHIN_TESTED_SCOPE"
    assert fresh["scoped_LIVE_RETRACTION"] == "HOLD"
    assert fresh["product_LIVE_INDEX"] == "HOLD"
    assert fresh["may_promote"] is False
    assert fresh["FINAL"] == "R4_T6_LIVE_INDEX_PASS_WITHIN_TESTED_SCOPE_RETRACTION_HOLD"
    for doi, ident in fresh["identities"].items():
        assert ident["independent_doi_providers"] == ["CROSSREF", "OPENALEX"]
        assert ident["ncbi_family_count"] == 1
        assert ident["live_verified"] is False
        assert doi
    # Lamport quoted PubMed esearch is a real zero, not a DOI identity.
    lamport = [
        row for row in pack["bindings"]
        if row["canonical_doi"] == "10.1145/359545.359563"
        and row["provider"] == "PUBMED"
        and row["query_class"] == "ADAPTER_QUOTED_ESEARCH"
    ]
    assert lamport[0]["status"] == "ZERO_HITS"
    assert lamport[0]["hit_count"] == 0
    # Quoted nature query returned a PMID and no DOI. Not zero, not a DOI provider.
    nature = [
        row for row in pack["bindings"]
        if row["canonical_doi"] == "10.1038/nature00870"
        and row["provider"] == "PUBMED"
        and row["query_class"] == "ADAPTER_QUOTED_ESEARCH"
    ]
    assert nature[0]["status"] == "ID_WITHOUT_DOI"
    assert nature[0]["returned_id"] == "12077603"
    assert nature[0]["returned_doi"] is None
    ambiguous = [
        row for row in pack["bindings"]
        if row["status"] == "IDENTIFIER_AMBIGUOUS"
    ]
    assert len(ambiguous) == 1
    assert ambiguous[0]["provider"] == "PMC"
    assert ambiguous[0]["canonical_doi"] == "10.1016/j.ijantimicag.2020.105949"
